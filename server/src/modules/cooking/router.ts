import { Router } from 'express';
import { z } from 'zod';
import { visibleTo } from '../recipes/access.js';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { body, params, wrap } from '../../middleware/validate.js';

export const cookingRouter = Router();
cookingRouter.use(requireVerified);

const uuid = z.string().uuid();

cookingRouter.post(
  '/sessions',
  body(z.object({ recipeId: uuid, adaptedSnapshot: z.any().optional() })),
  wrap(async (req, res) => {
    const me = authUser(req).id;
    const recipe = await prisma.recipe.findFirst({ where: { id: req.body.recipeId, ...visibleTo(me) }, select: { id: true } });
    if (!recipe) throw AppError.notFound('Recipe');
    await prisma.cookingSession.updateMany({ where: { userId: me, status: 'active' }, data: { status: 'abandoned' } });
    const session = await prisma.cookingSession.create({ data: { userId: me, recipeId: recipe.id, adaptedSnapshot: req.body.adaptedSnapshot } });
    res.status(201).json({ session });
  }),
);

cookingRouter.patch(
  '/sessions/:id',
  params(z.object({ id: uuid })),
  body(z.object({ currentStep: z.number().int().min(0).max(200) })),
  wrap(async (req, res) => {
    const { count } = await prisma.cookingSession.updateMany({ where: { id: req.params.id, userId: authUser(req).id, status: 'active' }, data: { currentStep: req.body.currentStep } });
    if (!count) throw AppError.notFound('Cooking session');
    res.json({ ok: true });
  }),
);

/**
 * Completing a cook: rate it, optionally consume fridge items, bump the streak,
 * and record the strongest personalisation signal we have.
 */
cookingRouter.post(
  '/sessions/:id/complete',
  params(z.object({ id: uuid })),
  body(z.object({ rating: z.number().int().min(1).max(5).optional(), consumedFridgeItemIds: z.array(uuid).max(60).default([]) })),
  wrap(async (req, res) => {
    const me = authUser(req).id;
    const session = await prisma.cookingSession.findFirst({ where: { id: req.params.id, userId: me }, include: { recipe: { select: { id: true, cuisine: true, title: true } } } });
    if (!session) throw AppError.notFound('Cooking session');
    if (session.status === 'completed') return res.json({ ok: true, alreadyCompleted: true });

    const consumed = req.body.consumedFridgeItemIds as string[];
    const profile = await prisma.userProfile.findUnique({ where: { userId: me }, select: { streakDays: true, lastCookedAt: true } });
    const last = profile?.lastCookedAt;
    const dayMs = 86_400_000;
    const sameDay = last && Math.floor(last.getTime() / dayMs) === Math.floor(Date.now() / dayMs);
    const consecutive = last && Math.floor(Date.now() / dayMs) - Math.floor(last.getTime() / dayMs) === 1;
    const streakDays = sameDay ? (profile?.streakDays ?? 0) : consecutive ? (profile?.streakDays ?? 0) + 1 : 1;

    await prisma.$transaction([
      prisma.cookingSession.update({ where: { id: session.id }, data: { status: 'completed', completedAt: new Date(), rating: req.body.rating, consumedFridgeItemIds: consumed } }),
      ...(consumed.length ? [prisma.fridgeItem.deleteMany({ where: { id: { in: consumed }, userId: me } })] : []),
      prisma.userProfile.update({ where: { userId: me }, data: { streakDays, lastCookedAt: new Date() } }),
      prisma.userSignal.create({ data: { userId: me, kind: 'cooked', recipeId: session.recipe.id, cuisine: session.recipe.cuisine?.toLowerCase(), value: req.body.rating } }),
      ...(req.body.rating
        ? [
            prisma.recipeRating.upsert({ where: { userId_recipeId: { userId: me, recipeId: session.recipe.id } }, create: { userId: me, recipeId: session.recipe.id, rating: req.body.rating }, update: { rating: req.body.rating } }),
          ]
        : []),
    ]);
    if (req.body.rating) {
      const agg = await prisma.recipeRating.aggregate({ where: { recipeId: session.recipe.id }, _avg: { rating: true }, _count: true });
      await prisma.recipe.update({ where: { id: session.recipe.id }, data: { ratingAvg: agg._avg.rating, ratingCount: agg._count } });
    }
    res.json({ ok: true, streakDays });
  }),
);

cookingRouter.get(
  '/history',
  wrap(async (req, res) => {
    const rows = await prisma.cookingSession.findMany({ where: { userId: authUser(req).id, status: 'completed' }, include: { recipe: { select: { id: true, title: true, imageUrl: true, cuisine: true } } }, orderBy: { completedAt: 'desc' }, take: 50 });
    res.json({ sessions: rows });
  }),
);
