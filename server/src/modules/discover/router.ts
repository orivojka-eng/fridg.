import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { query, wrap } from '../../middleware/validate.js';
import { decorateRecipes } from '../recipes/router.js';
import { recipeInclude } from '../recipes/serialize.js';

export const discoverRouter = Router();
discoverRouter.use(requireVerified);

const tabs = ['for-you', 'trending', 'following', 'quick', 'high-protein'] as const;

discoverRouter.get(
  '/feed',
  query(z.object({ tab: z.enum(tabs).default('for-you'), limit: z.coerce.number().int().min(1).max(60).default(30) })),
  wrap(async (req, res) => {
    const me = authUser(req).id;
    const tab = req.query.tab as (typeof tabs)[number];
    const limit = Number(req.query.limit);
    const base = { visibility: 'public' as const };

    let rows;
    if (tab === 'following') {
      const following = await prisma.follow.findMany({ where: { followerId: me }, select: { followingId: true } });
      rows = await prisma.recipe.findMany({ where: { ...base, authorId: { in: following.map((f) => f.followingId) } }, include: recipeInclude, orderBy: { publishedAt: 'desc' }, take: limit });
    } else if (tab === 'trending') {
      rows = await prisma.recipe.findMany({ where: base, include: recipeInclude, orderBy: [{ likesCount: 'desc' }, { savesCount: 'desc' }, { publishedAt: 'desc' }], take: limit });
    } else if (tab === 'quick') {
      rows = await prisma.recipe.findMany({ where: { ...base, prepTimeMin: { lte: 20 } }, include: recipeInclude, orderBy: [{ likesCount: 'desc' }], take: limit });
    } else if (tab === 'high-protein') {
      rows = await prisma.recipe.findMany({ where: { ...base, proteinG: { gte: 30 } }, include: recipeInclude, orderBy: [{ proteinG: 'desc' }], take: limit });
    } else {
      // For you: allergen-safe, cuisine-weighted by the Food Profile and behaviour, then by popularity.
      const [fp, cuisines] = await Promise.all([
        prisma.foodProfile.findUnique({ where: { userId: me }, include: { allergies: true, dislikes: true } }),
        prisma.userCuisine.findMany({ where: { userId: me } }),
      ]);
      const allergens = fp?.allergies.map((a) => a.allergen) ?? [];
      const candidates = await prisma.recipe.findMany({
        where: { ...base, ...(allergens.length ? { NOT: { allergens: { hasSome: allergens } } } : {}) },
        include: recipeInclude,
        orderBy: [{ publishedAt: 'desc' }],
        take: limit * 3,
      });
      const weight = new Map(cuisines.map((c) => [c.cuisine, c.weight]));
      const dislikes = fp?.dislikes.map((d) => d.food) ?? [];
      rows = candidates
        .filter((r) => !r.ingredients.some((i) => dislikes.some((d) => i.name.toLowerCase().includes(d))))
        .map((r) => ({ r, score: (weight.get(r.cuisine?.toLowerCase() ?? '') ?? 0) * 10 + Math.log1p(r.likesCount + r.savesCount * 2) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.r);
    }
    res.json({ tab, recipes: await decorateRecipes(me, rows) });
  }),
);

discoverRouter.get(
  '/search',
  query(z.object({ q: z.string().trim().min(1).max(60), limit: z.coerce.number().int().min(1).max(60).default(30) })),
  wrap(async (req, res) => {
    const me = authUser(req).id;
    const q = String(req.query.q);
    const rows = await prisma.recipe.findMany({
      where: { OR: [{ visibility: 'public' }, { authorId: me }], AND: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { cuisine: { contains: q, mode: 'insensitive' } }, { ingredients: { some: { name: { contains: q, mode: 'insensitive' } } } }] } },
      include: recipeInclude,
      orderBy: [{ likesCount: 'desc' }],
      take: Number(req.query.limit),
    });
    prisma.userSignal.create({ data: { userId: me, kind: 'searched', cuisine: q.toLowerCase().slice(0, 40) } }).catch(() => undefined);
    res.json({ recipes: await decorateRecipes(me, rows) });
  }),
);

discoverRouter.get(
  '/creators',
  wrap(async (req, res) => {
    const me = authUser(req).id;
    const rows = await prisma.user.findMany({
      where: { recipes: { some: { visibility: 'public' } }, NOT: { id: me } },
      select: { id: true, firstName: true, lastName: true, handle: true, profile: { select: { bio: true, avatarIndex: true } }, _count: { select: { recipes: { where: { visibility: 'public' } }, followers: true } } },
      orderBy: { followers: { _count: 'desc' } },
      take: 20,
    });
    const following = new Set((await prisma.follow.findMany({ where: { followerId: me }, select: { followingId: true } })).map((f) => f.followingId));
    res.json({
      creators: rows.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName.charAt(0)}.`.trim(), handle: `@${u.handle}`, bio: u.profile?.bio ?? '', avatarIndex: u.profile?.avatarIndex ?? 0, publishedCount: u._count.recipes, followersCount: u._count.followers, isFollowing: following.has(u.id) })),
    });
  }),
);
