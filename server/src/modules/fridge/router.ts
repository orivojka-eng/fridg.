import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { body, params, wrap } from '../../middleware/validate.js';
import { normalizeName, resolveFood } from '../foods/service.js';

export const fridgeRouter = Router();
fridgeRouter.use(requireVerified);

const category = z.enum(['Protein', 'Veg', 'Dairy', 'Pantry', 'Produce']);

const DAY = 86_400_000;

export const serializeFridgeItem = (i: { id: string; name: string; category: string; quantity: number; unit: string; expiresAt: Date | null; addedVia: string; scanConfidence: number | null; foodId: string | null; createdAt: Date }) => ({
  id: i.id,
  name: i.name,
  category: i.category,
  quantity: i.unit === 'pcs' ? `${Number.isInteger(i.quantity) ? i.quantity : i.quantity.toFixed(1)}` : `${i.quantity} ${i.unit}`,
  quantityValue: i.quantity,
  unit: i.unit,
  daysToExpiry: i.expiresAt ? Math.max(-30, Math.ceil((i.expiresAt.getTime() - Date.now()) / DAY)) : 14,
  expiresAt: i.expiresAt,
  addedVia: i.addedVia,
  scanConfidence: i.scanConfidence,
  foodId: i.foodId,
  addedAt: i.createdAt.getTime(),
});

const itemInput = z.object({
  name: z.string().trim().min(1).max(60),
  category: category.optional(),
  quantity: z.number().positive().max(999).default(1),
  unit: z.string().trim().max(12).default('pcs'),
  daysToExpiry: z.number().int().min(-30).max(365).optional(),
  expiresAt: z.coerce.date().optional(),
  addedVia: z.enum(['manual', 'scan', 'import']).default('manual'),
  scanConfidence: z.number().min(0).max(1).optional(),
});
type ItemInput = z.infer<typeof itemInput>;

const categoryFromFood = (kind: string | undefined): z.infer<typeof category> => (kind && category.options.includes(kind as any) ? (kind as any) : 'Pantry');

/** Adds items for a user, merging with an existing item of the same normalised name. */
export async function addFridgeItems(userId: string, items: ItemInput[]) {
  const results = [];
  for (const raw of items) {
    const food = await resolveFood(raw.name);
    const foodWithCat = food ? await prisma.food.findUnique({ where: { id: food.id }, include: { category: true } }) : null;
    const name = food?.displayName ?? raw.name.trim();
    const cat = raw.category ?? categoryFromFood(foodWithCat?.category.kind);
    const days = raw.daysToExpiry ?? food?.shelfLifeDays ?? 7;
    const expiresAt = raw.expiresAt ?? new Date(Date.now() + days * DAY);
    const normalized = normalizeName(name);
    const existing = await prisma.fridgeItem.findFirst({ where: { userId, OR: [{ foodId: food?.id ?? undefined }, { name: { equals: name, mode: 'insensitive' } }] } });
    const matched = existing && normalizeName(existing.name) === normalized ? existing : existing?.foodId && food && existing.foodId === food.id ? existing : null;
    if (matched && matched.unit === raw.unit) {
      const updated = await prisma.fridgeItem.update({
        where: { id: matched.id },
        data: { quantity: matched.quantity + raw.quantity, expiresAt: matched.expiresAt && matched.expiresAt < expiresAt ? matched.expiresAt : expiresAt },
      });
      results.push(updated);
      continue;
    }
    results.push(
      await prisma.fridgeItem.create({
        data: { userId, foodId: food?.id, name, category: cat, quantity: raw.quantity, unit: raw.unit, expiresAt, addedVia: raw.addedVia, scanConfidence: raw.scanConfidence },
      }),
    );
  }
  return results;
}

fridgeRouter.get(
  '/',
  wrap(async (req, res) => {
    const items = await prisma.fridgeItem.findMany({ where: { userId: authUser(req).id }, orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }] });
    res.json({ items: items.map(serializeFridgeItem) });
  }),
);

fridgeRouter.post(
  '/items',
  body(z.object({ items: z.array(itemInput).min(1).max(60) })),
  wrap(async (req, res) => {
    const created = await addFridgeItems(authUser(req).id, req.body.items);
    const items = await prisma.fridgeItem.findMany({ where: { userId: authUser(req).id }, orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }] });
    res.status(201).json({ added: created.map(serializeFridgeItem), items: items.map(serializeFridgeItem) });
  }),
);

fridgeRouter.patch(
  '/items/:id',
  params(z.object({ id: z.string().uuid() })),
  body(itemInput.partial()),
  wrap(async (req, res) => {
    const { id: userId } = authUser(req);
    const item = await prisma.fridgeItem.findFirst({ where: { id: req.params.id, userId } });
    if (!item) throw AppError.notFound('Fridge item');
    const { daysToExpiry, ...rest } = req.body;
    const updated = await prisma.fridgeItem.update({
      where: { id: item.id },
      data: { ...rest, ...(daysToExpiry !== undefined ? { expiresAt: new Date(Date.now() + daysToExpiry * DAY) } : {}) },
    });
    res.json({ item: serializeFridgeItem(updated) });
  }),
);

fridgeRouter.delete(
  '/items/:id',
  params(z.object({ id: z.string().uuid() })),
  wrap(async (req, res) => {
    const { count } = await prisma.fridgeItem.deleteMany({ where: { id: req.params.id, userId: authUser(req).id } });
    if (!count) throw AppError.notFound('Fridge item');
    res.json({ ok: true });
  }),
);

fridgeRouter.delete(
  '/',
  wrap(async (req, res) => {
    await prisma.fridgeItem.deleteMany({ where: { userId: authUser(req).id } });
    res.json({ ok: true });
  }),
);
