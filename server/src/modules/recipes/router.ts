import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { pageQuery, paginate } from '../../lib/pagination.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { body, params, query, wrap } from '../../middleware/validate.js';
import { resolveFood } from '../foods/service.js';
import { matchRecipe } from './matching.js';
import { allergensFromNames } from '../../ai/personalization.js';
import { recipeInclude, serializeRecipe } from './serialize.js';
import { canSee, visibleTo } from './access.js';

export const recipesRouter = Router();
recipesRouter.use(requireVerified);

const uuid = z.string().uuid();

const ingredientInput = z.object({ name: z.string().trim().min(1).max(80), amount: z.string().trim().max(40).default(''), isOptional: z.boolean().default(false) });
const stepInput = z.object({ phase: z.string().trim().max(40).optional(), instruction: z.string().trim().min(1).max(1000), timerSec: z.number().int().min(0).max(24 * 3600).optional(), ingredients: z.array(z.string().max(80)).max(20).default([]) });

export const recipeInput = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional(),
  imageUrl: z.string().url().max(500).optional(),
  tone: z.enum(['cream', 'sage', 'blush']).optional(),
  cuisine: z.string().trim().max(40).optional(),
  effort: z.enum(['Easy', 'Medium', 'Cheffy']).default('Easy'),
  style: z.enum(['Bowl', 'Traybake', 'Salad']).optional(),
  prepTimeMin: z.number().int().min(1).max(600),
  servings: z.number().int().min(1).max(24).default(2),
  kcal: z.number().int().min(0).max(5000).optional(),
  proteinG: z.number().int().min(0).max(500).optional(),
  carbsG: z.number().int().min(0).max(800).optional(),
  fatG: z.number().int().min(0).max(500).optional(),
  ingredients: z.array(ingredientInput).min(1).max(60),
  steps: z.array(stepInput).min(1).max(40),
  visibility: z.enum(['private', 'public']).default('private'),
});
export type RecipeInput = z.infer<typeof recipeInput>;

async function userFridge(userId: string) {
  return prisma.fridgeItem.findMany({ where: { userId }, select: { name: true, foodId: true } });
}

async function userFlags(userId: string, recipeIds: string[]) {
  const [saved, liked, ratings] = await Promise.all([
    prisma.savedRecipe.findMany({ where: { userId, recipeId: { in: recipeIds } }, select: { recipeId: true } }),
    prisma.like.findMany({ where: { userId, recipeId: { in: recipeIds } }, select: { recipeId: true } }),
    prisma.recipeRating.findMany({ where: { userId, recipeId: { in: recipeIds } }, select: { recipeId: true, rating: true } }),
  ]);
  return {
    saved: new Set(saved.map((s) => s.recipeId)),
    liked: new Set(liked.map((l) => l.recipeId)),
    ratings: new Map(ratings.map((r) => [r.recipeId, r.rating])),
  };
}

/** Serialises a list of recipes with per-user flags and fridge match. */
export async function decorateRecipes(userId: string, recipes: Parameters<typeof serializeRecipe>[0][]) {
  const [fridge, flags] = await Promise.all([userFridge(userId), userFlags(userId, recipes.map((r) => r.id))]);
  return recipes.map((r) => {
    const m = matchRecipe(r.ingredients, fridge);
    return serializeRecipe(r, { isSaved: flags.saved.has(r.id), isLiked: flags.liked.has(r.id), myRating: flags.ratings.get(r.id) ?? null, matchPercent: m.matchPercent, missingCount: m.missingCount });
  });
}

/** Writes ingredients + steps, resolving foods and deriving allergens. */
export async function createRecipeRecord(data: { authorId: string | null; origin: 'user_created' | 'ai_generated' | 'imported' | 'adapted' | 'seeded'; input: RecipeInput; aiGenerationId?: string; adaptedFromId?: string }) {
  const { ingredients, steps, ...fields } = data.input;
  const resolved = await Promise.all(ingredients.map((i) => resolveFood(i.name)));
  const allergens = new Set<string>();
  let dairy = false;
  resolved.forEach((f) => {
    f?.allergens.forEach((a) => allergens.add(a));
    if (f?.isDairy) dairy = true;
  });
  allergensFromNames(ingredients.map((i) => i.name)).forEach((x) => allergens.add(x));
  if (allergens.has('dairy')) dairy = true;
  return prisma.recipe.create({
    data: {
      ...fields,
      authorId: data.authorId,
      origin: data.origin,
      aiGenerationId: data.aiGenerationId,
      adaptedFromId: data.adaptedFromId,
      allergens: [...allergens],
      isDairyFree: !dairy,
      nutritionSource: fields.kcal != null ? 'user' : undefined,
      publishedAt: fields.visibility === 'public' ? new Date() : null,
      ingredients: { create: ingredients.map((i, idx) => ({ name: i.name, amount: i.amount, isOptional: i.isOptional, position: idx, foodId: resolved[idx]?.id })) },
      steps: { create: steps.map((s, idx) => ({ stepNumber: idx + 1, phase: s.phase, instruction: s.instruction, timerSec: s.timerSec, ingredients: s.ingredients })) },
    },
    include: recipeInclude,
  });
}


/* ------------------------------------------------------------------ catalogue & saved */
recipesRouter.get(
  '/catalog',
  query(pageQuery),
  wrap(async (req, res) => {
    const { id } = authUser(req);
    const { limit, cursor } = req.query as unknown as z.infer<typeof pageQuery>;
    const rows = await prisma.recipe.findMany({
      where: { OR: [{ visibility: 'public' }, { authorId: id }] },
      include: recipeInclude,
      orderBy: [{ createdAt: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = paginate(rows, limit);
    res.json({ recipes: await decorateRecipes(id, page.items), nextCursor: page.nextCursor });
  }),
);

recipesRouter.get(
  '/saved',
  wrap(async (req, res) => {
    const { id } = authUser(req);
    const saved = await prisma.savedRecipe.findMany({ where: { userId: id }, include: { recipe: { include: recipeInclude } }, orderBy: { createdAt: 'desc' } });
    res.json({ recipes: await decorateRecipes(id, saved.map((s) => s.recipe)) });
  }),
);

recipesRouter.get(
  '/mine',
  wrap(async (req, res) => {
    const { id } = authUser(req);
    const rows = await prisma.recipe.findMany({ where: { authorId: id }, include: recipeInclude, orderBy: { createdAt: 'desc' } });
    res.json({ recipes: await decorateRecipes(id, rows) });
  }),
);

recipesRouter.get(
  '/match',
  query(z.object({ ids: z.string().transform((s) => s.split(',').filter(Boolean)).pipe(z.array(uuid).max(100)) })),
  wrap(async (req, res) => {
    const { id } = authUser(req);
    const ids = req.query.ids as unknown as string[];
    const [rows, fridge] = await Promise.all([prisma.recipe.findMany({ where: { id: { in: ids }, ...visibleTo(id) }, select: { id: true, ingredients: { select: { name: true, foodId: true, isOptional: true } } } }), userFridge(id)]);
    res.json({ matches: Object.fromEntries(rows.map((r) => [r.id, matchRecipe(r.ingredients, fridge)])) });
  }),
);


/* ------------------------------------------------------------------ single recipe */
recipesRouter.get(
  '/:id',
  params(z.object({ id: uuid })),
  wrap(async (req, res) => {
    const { id: userId } = authUser(req);
    const r = await prisma.recipe.findUnique({ where: { id: req.params.id }, include: recipeInclude });
    if (!r || !canSee(r, userId)) throw AppError.notFound('Recipe');
    const [recipe] = await decorateRecipes(userId, [r]);
    // Viewing is a weak signal used for ranking, never shown to anyone.
    prisma.userSignal.create({ data: { userId, kind: 'viewed', recipeId: r.id, cuisine: r.cuisine?.toLowerCase() } }).catch(() => undefined);
    res.json({ recipe });
  }),
);

recipesRouter.post(
  '/',
  body(recipeInput),
  wrap(async (req, res) => {
    const { id } = authUser(req);
    const r = await createRecipeRecord({ authorId: id, origin: 'user_created', input: req.body });
    const [recipe] = await decorateRecipes(id, [r]);
    res.status(201).json({ recipe });
  }),
);

recipesRouter.patch(
  '/:id',
  params(z.object({ id: uuid })),
  body(recipeInput.partial()),
  wrap(async (req, res) => {
    const { id: userId } = authUser(req);
    const existing = await prisma.recipe.findFirst({ where: { id: req.params.id, authorId: userId } });
    if (!existing) throw AppError.notFound('Recipe');
    const { ingredients, steps, ...fields } = req.body as Partial<RecipeInput>;
    await prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id: existing.id },
        data: { ...fields, ...(fields.visibility === 'public' && !existing.publishedAt ? { publishedAt: new Date() } : {}) },
      });
      if (ingredients) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: existing.id } });
        const resolved = await Promise.all(ingredients.map((i) => resolveFood(i.name)));
        await tx.recipeIngredient.createMany({ data: ingredients.map((i, idx) => ({ recipeId: existing.id, name: i.name, amount: i.amount, isOptional: i.isOptional, position: idx, foodId: resolved[idx]?.id })) });
      }
      if (steps) {
        await tx.recipeStep.deleteMany({ where: { recipeId: existing.id } });
        await tx.recipeStep.createMany({ data: steps.map((s, idx) => ({ recipeId: existing.id, stepNumber: idx + 1, phase: s.phase, instruction: s.instruction, timerSec: s.timerSec, ingredients: s.ingredients })) });
      }
    });
    const r = await prisma.recipe.findUniqueOrThrow({ where: { id: existing.id }, include: recipeInclude });
    const [recipe] = await decorateRecipes(userId, [r]);
    res.json({ recipe });
  }),
);

recipesRouter.delete(
  '/:id',
  params(z.object({ id: uuid })),
  wrap(async (req, res) => {
    const { count } = await prisma.recipe.deleteMany({ where: { id: req.params.id, authorId: authUser(req).id } });
    if (!count) throw AppError.notFound('Recipe');
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ save / rate */
recipesRouter.post(
  '/:id/save',
  params(z.object({ id: uuid })),
  wrap(async (req, res) => {
    const { id: userId } = authUser(req);
    const r = await prisma.recipe.findUnique({ where: { id: req.params.id }, select: { id: true, visibility: true, authorId: true, origin: true, cuisine: true } });
    if (!r || !canSee(r, userId)) throw AppError.notFound('Recipe');
    await prisma.$transaction([
      prisma.savedRecipe.upsert({ where: { userId_recipeId: { userId, recipeId: r.id } }, create: { userId, recipeId: r.id }, update: {} }),
      prisma.recipe.update({ where: { id: r.id }, data: { savesCount: { increment: 1 } } }),
      prisma.userSignal.create({ data: { userId, kind: 'saved', recipeId: r.id, cuisine: r.cuisine?.toLowerCase() } }),
    ]);
    res.json({ ok: true, isSaved: true });
  }),
);

recipesRouter.delete(
  '/:id/save',
  params(z.object({ id: uuid })),
  wrap(async (req, res) => {
    const { id: userId } = authUser(req);
    const { count } = await prisma.savedRecipe.deleteMany({ where: { userId, recipeId: req.params.id } });
    if (count) {
      await prisma.recipe.update({ where: { id: req.params.id }, data: { savesCount: { decrement: 1 } } }).catch(() => undefined);
      await prisma.userSignal.create({ data: { userId, kind: 'unsaved', recipeId: req.params.id } });
    }
    res.json({ ok: true, isSaved: false });
  }),
);

recipesRouter.post(
  '/:id/rate',
  params(z.object({ id: uuid })),
  body(z.object({ rating: z.number().int().min(1).max(5), note: z.string().trim().max(300).optional() })),
  wrap(async (req, res) => {
    const { id: userId } = authUser(req);
    const r = await prisma.recipe.findUnique({ where: { id: req.params.id }, select: { id: true, visibility: true, authorId: true, origin: true, cuisine: true } });
    if (!r || !canSee(r, userId)) throw AppError.notFound('Recipe');
    await prisma.recipeRating.upsert({
      where: { userId_recipeId: { userId, recipeId: r.id } },
      create: { userId, recipeId: r.id, rating: req.body.rating, note: req.body.note },
      update: { rating: req.body.rating, note: req.body.note },
    });
    const agg = await prisma.recipeRating.aggregate({ where: { recipeId: r.id }, _avg: { rating: true }, _count: true });
    await prisma.recipe.update({ where: { id: r.id }, data: { ratingAvg: agg._avg.rating, ratingCount: agg._count } });
    await prisma.userSignal.create({ data: { userId, kind: 'rated', recipeId: r.id, cuisine: r.cuisine?.toLowerCase(), value: req.body.rating } });
    res.json({ ok: true, ratingAvg: agg._avg.rating, ratingCount: agg._count });
  }),
);
