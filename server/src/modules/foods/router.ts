import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { params, query, wrap } from '../../middleware/validate.js';
import { normalizeName } from './service.js';

export const foodsRouter = Router();

const serialize = (f: { id: string; name: string; displayName: string; category: { kind: string }; defaultUnit: string; shelfLifeDays: number; allergens: string[]; kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; nutritionSource: string | null }) => ({
  id: f.id,
  name: f.displayName,
  key: f.name,
  category: f.category.kind,
  defaultUnit: f.defaultUnit,
  shelfLifeDays: f.shelfLifeDays,
  allergens: f.allergens,
  nutritionPer100g: f.kcal == null ? null : { kcal: f.kcal, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, source: f.nutritionSource },
});

foodsRouter.get(
  '/search',
  requireAuth,
  query(z.object({ q: z.string().trim().min(1).max(60), limit: z.coerce.number().int().min(1).max(30).default(12) })),
  wrap(async (req, res) => {
    const q = normalizeName(String(req.query.q));
    const limit = Number(req.query.limit);
    const foods = await prisma.food.findMany({
      where: { OR: [{ name: { startsWith: q } }, { name: { contains: q } }, { aliases: { some: { alias: { contains: q } } } }] },
      include: { category: true },
      orderBy: { name: 'asc' },
      take: limit,
    });
    // Prefix matches first.
    foods.sort((a, b) => Number(b.name.startsWith(q)) - Number(a.name.startsWith(q)));
    res.json({ foods: foods.map(serialize) });
  }),
);

foodsRouter.get(
  '/nutrition',
  requireAuth,
  query(z.object({ ids: z.string().transform((s) => s.split(',').filter(Boolean)).pipe(z.array(z.string().uuid()).max(60)) })),
  wrap(async (req, res) => {
    const foods = await prisma.food.findMany({ where: { id: { in: req.query.ids as unknown as string[] } }, include: { category: true } });
    res.json({ foods: foods.map(serialize) });
  }),
);

foodsRouter.get(
  '/:id',
  requireAuth,
  params(z.object({ id: z.string().uuid() })),
  wrap(async (req, res) => {
    const food = await prisma.food.findUnique({ where: { id: req.params.id }, include: { category: true, aliases: true } });
    if (!food) throw AppError.notFound('Food');
    res.json({ food: { ...serialize(food), aliases: food.aliases.map((a) => a.alias) } });
  }),
);
