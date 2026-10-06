import { Router } from 'express';
import { z } from 'zod';
import { visibleTo } from '../recipes/access.js';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { body, params, wrap } from '../../middleware/validate.js';
import { namesOverlap, normalizeName, resolveFood } from '../foods/service.js';
import { matchRecipe } from '../recipes/matching.js';

export const shoppingRouter = Router();
shoppingRouter.use(requireVerified);

const category = z.enum(['PRODUCE', 'PANTRY_SPICE']);

const serialize = (i: { id: string; name: string; category: string; amount: string | null; source: string | null; isChecked: boolean; estPrice: number | null; sourceRecipeId: string | null }) => ({
  id: i.id,
  name: i.name,
  category: i.category === 'PRODUCE' ? 'PRODUCE' : 'PANTRY & SPICE',
  amount: i.amount ?? '',
  source: i.source ?? '',
  isChecked: i.isChecked,
  estPrice: i.estPrice ?? undefined,
  sourceRecipeId: i.sourceRecipeId ?? undefined,
});

async function defaultList(userId: string) {
  const list = await prisma.shoppingList.findFirst({ where: { userId, isDefault: true } });
  return list ?? prisma.shoppingList.create({ data: { userId, name: 'My list', isDefault: true } });
}

const itemInput = z.object({
  name: z.string().trim().min(1).max(60),
  category: category.optional(),
  amount: z.string().trim().max(40).optional(),
  source: z.string().trim().max(80).optional(),
  sourceRecipeId: z.string().uuid().optional(),
  estPrice: z.number().min(0).max(999).optional(),
});

const guessCategory = (kind?: string): 'PRODUCE' | 'PANTRY_SPICE' => (kind === 'Veg' || kind === 'Produce' ? 'PRODUCE' : 'PANTRY_SPICE');

/** Adds items to the default list, de-duplicating by normalised name. */
async function addItems(userId: string, inputs: z.infer<typeof itemInput>[]) {
  const list = await defaultList(userId);
  const existing = await prisma.shoppingItem.findMany({ where: { listId: list.id } });
  for (const input of inputs) {
    const dup = existing.find((e) => normalizeName(e.name) === normalizeName(input.name));
    if (dup) {
      if (dup.isChecked) await prisma.shoppingItem.update({ where: { id: dup.id }, data: { isChecked: false, source: input.source ?? dup.source } });
      continue;
    }
    const food = await resolveFood(input.name);
    const foodWithCat = food ? await prisma.food.findUnique({ where: { id: food.id }, include: { category: true } }) : null;
    const created = await prisma.shoppingItem.create({
      data: { listId: list.id, foodId: food?.id, name: food?.displayName ?? input.name, category: input.category ?? guessCategory(foodWithCat?.category.kind), amount: input.amount, source: input.source, sourceRecipeId: input.sourceRecipeId, estPrice: input.estPrice },
    });
    existing.push(created);
  }
  return prisma.shoppingItem.findMany({ where: { listId: list.id }, orderBy: [{ isChecked: 'asc' }, { createdAt: 'asc' }] });
}

shoppingRouter.get(
  '/',
  wrap(async (req, res) => {
    const list = await defaultList(authUser(req).id);
    const items = await prisma.shoppingItem.findMany({ where: { listId: list.id }, orderBy: [{ isChecked: 'asc' }, { createdAt: 'asc' }] });
    res.json({ listId: list.id, items: items.map(serialize) });
  }),
);

shoppingRouter.post(
  '/items',
  body(z.object({ items: z.array(itemInput).min(1).max(60) })),
  wrap(async (req, res) => {
    const items = await addItems(authUser(req).id, req.body.items);
    res.status(201).json({ items: items.map(serialize) });
  }),
);

shoppingRouter.post(
  '/from-recipe/:recipeId',
  params(z.object({ recipeId: z.string().uuid() })),
  wrap(async (req, res) => {
    const { id: userId } = authUser(req);
    const recipe = await prisma.recipe.findFirst({ where: { id: req.params.recipeId, ...visibleTo(userId) }, include: { ingredients: true } });
    if (!recipe) throw AppError.notFound('Recipe');
    const fridge = await prisma.fridgeItem.findMany({ where: { userId }, select: { name: true, foodId: true } });
    const { missing } = matchRecipe(recipe.ingredients, fridge);
    const inputs = recipe.ingredients
      .filter((i) => missing.includes(i.name) && !fridge.some((f) => namesOverlap(f.name, i.name)))
      .map((i) => ({ name: i.name, amount: i.amount, source: `Missing • ${recipe.title}`, sourceRecipeId: recipe.id }));
    const items = inputs.length ? await addItems(userId, inputs) : await prisma.shoppingItem.findMany({ where: { list: { userId, isDefault: true } } });
    res.status(201).json({ addedCount: inputs.length, items: items.map(serialize) });
  }),
);

shoppingRouter.patch(
  '/items/:id',
  params(z.object({ id: z.string().uuid() })),
  body(itemInput.partial().extend({ isChecked: z.boolean().optional() })),
  wrap(async (req, res) => {
    const item = await prisma.shoppingItem.findFirst({ where: { id: req.params.id, list: { userId: authUser(req).id } } });
    if (!item) throw AppError.notFound('Shopping item');
    const updated = await prisma.shoppingItem.update({ where: { id: item.id }, data: req.body });
    res.json({ item: serialize(updated) });
  }),
);

shoppingRouter.delete(
  '/items/:id',
  params(z.object({ id: z.string().uuid() })),
  wrap(async (req, res) => {
    const { count } = await prisma.shoppingItem.deleteMany({ where: { id: req.params.id, list: { userId: authUser(req).id } } });
    if (!count) throw AppError.notFound('Shopping item');
    res.json({ ok: true });
  }),
);

shoppingRouter.post(
  '/clear-checked',
  wrap(async (req, res) => {
    await prisma.shoppingItem.deleteMany({ where: { isChecked: true, list: { userId: authUser(req).id } } });
    res.json({ ok: true });
  }),
);

shoppingRouter.delete(
  '/',
  wrap(async (req, res) => {
    await prisma.shoppingItem.deleteMany({ where: { list: { userId: authUser(req).id } } });
    res.json({ ok: true });
  }),
);
