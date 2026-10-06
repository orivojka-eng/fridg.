import { Router } from 'express';
import { z } from 'zod';
import { visibleTo } from '../recipes/access.js';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { body, params, wrap } from '../../middleware/validate.js';

export const collectionsRouter = Router();
collectionsRouter.use(requireVerified);

const uuid = z.string().uuid();
const serialize = (c: { id: string; title: string; tagline: string | null; recipes: { recipeId: string }[] }) => ({ id: c.id, title: c.title, tagline: c.tagline ?? '', recipeIds: c.recipes.map((r) => r.recipeId) });

collectionsRouter.get(
  '/',
  wrap(async (req, res) => {
    const rows = await prisma.collection.findMany({ where: { userId: authUser(req).id }, include: { recipes: { orderBy: { addedAt: 'desc' } } }, orderBy: { createdAt: 'asc' } });
    res.json({ collections: rows.map(serialize) });
  }),
);

collectionsRouter.post(
  '/',
  body(z.object({ title: z.string().trim().min(1).max(60), tagline: z.string().trim().max(120).optional() })),
  wrap(async (req, res) => {
    const c = await prisma.collection.create({ data: { userId: authUser(req).id, ...req.body }, include: { recipes: true } });
    res.status(201).json({ collection: serialize(c) });
  }),
);

collectionsRouter.patch(
  '/:id',
  params(z.object({ id: uuid })),
  body(z.object({ title: z.string().trim().min(1).max(60).optional(), tagline: z.string().trim().max(120).optional() })),
  wrap(async (req, res) => {
    const { count } = await prisma.collection.updateMany({ where: { id: req.params.id, userId: authUser(req).id }, data: req.body });
    if (!count) throw AppError.notFound('Collection');
    const c = await prisma.collection.findUniqueOrThrow({ where: { id: req.params.id }, include: { recipes: true } });
    res.json({ collection: serialize(c) });
  }),
);

collectionsRouter.delete(
  '/:id',
  params(z.object({ id: uuid })),
  wrap(async (req, res) => {
    const { count } = await prisma.collection.deleteMany({ where: { id: req.params.id, userId: authUser(req).id } });
    if (!count) throw AppError.notFound('Collection');
    res.json({ ok: true });
  }),
);

collectionsRouter.post(
  '/:id/recipes/:recipeId',
  params(z.object({ id: uuid, recipeId: uuid })),
  wrap(async (req, res) => {
    const c = await prisma.collection.findFirst({ where: { id: req.params.id, userId: authUser(req).id } });
    if (!c) throw AppError.notFound('Collection');
    if (!(await prisma.recipe.findFirst({ where: { id: req.params.recipeId, ...visibleTo(c.userId) }, select: { id: true } }))) throw AppError.notFound('Recipe');
    await prisma.collectionRecipe.upsert({ where: { collectionId_recipeId: { collectionId: c.id, recipeId: req.params.recipeId } }, create: { collectionId: c.id, recipeId: req.params.recipeId }, update: {} });
    res.json({ ok: true });
  }),
);

collectionsRouter.delete(
  '/:id/recipes/:recipeId',
  params(z.object({ id: uuid, recipeId: uuid })),
  wrap(async (req, res) => {
    await prisma.collectionRecipe.deleteMany({ where: { collectionId: req.params.id, recipeId: req.params.recipeId, collection: { userId: authUser(req).id } } });
    res.json({ ok: true });
  }),
);
