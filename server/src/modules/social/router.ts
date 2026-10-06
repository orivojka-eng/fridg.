import { Router } from 'express';
import { z } from 'zod';
import { canSee, visibleTo } from '../recipes/access.js';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { body, params, query, wrap } from '../../middleware/validate.js';

export const socialRouter = Router();
socialRouter.use(requireVerified);

const uuid = z.string().uuid();

socialRouter.post(
  '/follow/:userId',
  params(z.object({ userId: uuid })),
  wrap(async (req, res) => {
    const me = authUser(req).id;
    if (me === req.params.userId) throw AppError.badRequest('You cannot follow yourself.');
    const target = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true } });
    if (!target) throw AppError.notFound('User');
    await prisma.follow.upsert({ where: { followerId_followingId: { followerId: me, followingId: target.id } }, create: { followerId: me, followingId: target.id }, update: {} });
    res.json({ ok: true, following: true });
  }),
);

socialRouter.delete(
  '/follow/:userId',
  params(z.object({ userId: uuid })),
  wrap(async (req, res) => {
    await prisma.follow.deleteMany({ where: { followerId: authUser(req).id, followingId: req.params.userId } });
    res.json({ ok: true, following: false });
  }),
);

socialRouter.get(
  '/following',
  wrap(async (req, res) => {
    const rows = await prisma.follow.findMany({ where: { followerId: authUser(req).id }, select: { followingId: true } });
    res.json({ userIds: rows.map((r) => r.followingId) });
  }),
);

socialRouter.post(
  '/like/:recipeId',
  params(z.object({ recipeId: uuid })),
  wrap(async (req, res) => {
    const me = authUser(req).id;
    const r = await prisma.recipe.findUnique({ where: { id: req.params.recipeId }, select: { id: true, cuisine: true, visibility: true, authorId: true, origin: true } });
    if (!r || !canSee(r, me)) throw AppError.notFound('Recipe');
    const existing = await prisma.like.findUnique({ where: { userId_recipeId: { userId: me, recipeId: r.id } } });
    if (!existing) {
      await prisma.$transaction([
        prisma.like.create({ data: { userId: me, recipeId: r.id } }),
        prisma.recipe.update({ where: { id: r.id }, data: { likesCount: { increment: 1 } } }),
        prisma.userSignal.create({ data: { userId: me, kind: 'liked', recipeId: r.id, cuisine: r.cuisine?.toLowerCase() } }),
      ]);
    }
    const likes = await prisma.recipe.findUnique({ where: { id: r.id }, select: { likesCount: true } });
    res.json({ ok: true, isLiked: true, likes: likes?.likesCount ?? 0 });
  }),
);

socialRouter.delete(
  '/like/:recipeId',
  params(z.object({ recipeId: uuid })),
  wrap(async (req, res) => {
    const me = authUser(req).id;
    const { count } = await prisma.like.deleteMany({ where: { userId: me, recipeId: req.params.recipeId } });
    if (count) await prisma.recipe.update({ where: { id: req.params.recipeId }, data: { likesCount: { decrement: 1 } } }).catch(() => undefined);
    const likes = await prisma.recipe.findUnique({ where: { id: req.params.recipeId }, select: { likesCount: true } });
    res.json({ ok: true, isLiked: false, likes: likes?.likesCount ?? 0 });
  }),
);

const serializeComment = (c: { id: string; body: string; createdAt: Date; user: { id: string; firstName: string; lastName: string; handle: string; profile: { avatarIndex: number } | null } }) => ({
  id: c.id,
  body: c.body,
  createdAt: c.createdAt,
  author: { id: c.user.id, name: `${c.user.firstName} ${c.user.lastName.charAt(0)}.`.trim(), handle: `@${c.user.handle}`, avatarIndex: c.user.profile?.avatarIndex ?? 0 },
});

socialRouter.get(
  '/comments/:recipeId',
  params(z.object({ recipeId: uuid })),
  query(z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) })),
  wrap(async (req, res) => {
    if (!(await prisma.recipe.findFirst({ where: { id: req.params.recipeId, ...visibleTo(authUser(req).id) }, select: { id: true } }))) throw AppError.notFound('Recipe');
    const rows = await prisma.comment.findMany({
      where: { recipeId: req.params.recipeId, deletedAt: null },
      include: { user: { select: { id: true, firstName: true, lastName: true, handle: true, profile: { select: { avatarIndex: true } } } } },
      orderBy: { createdAt: 'asc' },
      take: Number(req.query.limit),
    });
    res.json({ comments: rows.map(serializeComment) });
  }),
);

socialRouter.post(
  '/comments/:recipeId',
  params(z.object({ recipeId: uuid })),
  body(z.object({ body: z.string().trim().min(1).max(500) })),
  wrap(async (req, res) => {
    const me = authUser(req).id;
    const r = await prisma.recipe.findFirst({ where: { id: req.params.recipeId, ...visibleTo(me) }, select: { id: true, authorId: true, title: true } });
    if (!r) throw AppError.notFound('Recipe');
    const [comment] = await prisma.$transaction([
      prisma.comment.create({ data: { userId: me, recipeId: r.id, body: req.body.body }, include: { user: { select: { id: true, firstName: true, lastName: true, handle: true, profile: { select: { avatarIndex: true } } } } } }),
      prisma.recipe.update({ where: { id: r.id }, data: { commentsCount: { increment: 1 } } }),
    ]);
    if (r.authorId && r.authorId !== me) {
      await prisma.notification.create({ data: { userId: r.authorId, kind: 'reply', title: `${comment.user.firstName} commented on ${r.title}`, body: req.body.body.slice(0, 140), link: `/recipe/${r.id}` } });
    }
    res.status(201).json({ comment: serializeComment(comment) });
  }),
);

socialRouter.delete(
  '/comments/:id',
  params(z.object({ id: uuid })),
  wrap(async (req, res) => {
    const me = authUser(req).id;
    const c = await prisma.comment.findUnique({ where: { id: req.params.id }, include: { recipe: { select: { authorId: true } } } });
    if (!c || c.deletedAt) throw AppError.notFound('Comment');
    if (c.userId !== me && c.recipe.authorId !== me) throw AppError.forbidden();
    await prisma.$transaction([
      prisma.comment.update({ where: { id: c.id }, data: { deletedAt: new Date() } }),
      prisma.recipe.update({ where: { id: c.recipeId }, data: { commentsCount: { decrement: 1 } } }),
    ]);
    res.json({ ok: true });
  }),
);
