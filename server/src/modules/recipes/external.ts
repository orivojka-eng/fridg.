import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { query, wrap } from '../../middleware/validate.js';
import { makeFoodResolver, type CachedFood } from '../foods/service.js';
import { decorateRecipes } from './router.js';
import { allergensFromNames } from '../../ai/personalization.js';
import { recipeInclude } from './serialize.js';

/**
 * Real recipes from public recipe databases, normalised into FRIDGR's
 * format and cached in our own table (dedupe on source + id):
 *  - TheMealDB: free, no sign-up (test key "1"); ~300 recipes with photos,
 *    ingredients, instructions and often a YouTube video.
 *  - Spoonacular (optional key): 5,000+ recipes with times, servings and
 *    step-by-step instructions.
 * They fill Discover and the generator's "proven recipes" grounding.
 */

export interface ExternalRecipe {
  source: 'themealdb' | 'spoonacular';
  externalId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  cuisine?: string;
  category?: string;
  servings: number;
  prepTimeMin?: number;
  ingredients: Array<{ name: string; amount: string }>;
  steps: string[];
  sourceUrl?: string;
  videoUrl?: string;
  nutrition?: { kcal: number; proteinG: number; carbsG: number; fatG: number };
}

const UA = { 'user-agent': 'FRIDGR/1.0 (+https://fridgr.app)' };
const getJson = async <T>(url: string): Promise<T | null> => {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12_000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch (e) {
    logger.warn({ err: (e as Error).message, url: url.replace(/apiKey=[^&]+/, 'apiKey=***') }, 'recipe db fetch failed');
    return null;
  }
};

/* ------------------------------------------------------------------ TheMealDB */
type MealDbMeal = Record<string, string | null> & { idMeal: string; strMeal: string };
const MEALDB = () => `https://www.themealdb.com/api/json/v1/${config.MEALDB_API_KEY}`;

export function fromMealDb(m: MealDbMeal): ExternalRecipe {
  const ingredients: ExternalRecipe['ingredients'] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] ?? '').trim();
    if (!name) continue;
    ingredients.push({ name: name.charAt(0).toUpperCase() + name.slice(1), amount: (m[`strMeasure${i}`] ?? '').trim() || 'to taste' });
  }
  return {
    source: 'themealdb',
    externalId: m.idMeal,
    title: m.strMeal.trim(),
    imageUrl: m.strMealThumb ?? undefined,
    cuisine: m.strArea && m.strArea !== 'Unknown' ? m.strArea : undefined,
    category: m.strCategory ?? undefined,
    servings: 4,
    ingredients,
    steps: splitInstructions(m.strInstructions ?? ''),
    sourceUrl: m.strSource || undefined,
    videoUrl: m.strYoutube || undefined,
  };
}

export async function mealDbSearch(q: string) {
  const res = await getJson<{ meals: MealDbMeal[] | null }>(`${MEALDB()}/search.php?s=${encodeURIComponent(q)}`);
  return (res?.meals ?? []).map(fromMealDb);
}

export async function mealDbByLetter(letter: string) {
  const res = await getJson<{ meals: MealDbMeal[] | null }>(`${MEALDB()}/search.php?f=${encodeURIComponent(letter)}`);
  return (res?.meals ?? []).map(fromMealDb);
}

/** Recipes containing an ingredient (free tier filters on one ingredient; details need a lookup each). */
export async function mealDbByIngredient(ingredient: string, limit = 6) {
  const res = await getJson<{ meals: Array<{ idMeal: string }> | null }>(`${MEALDB()}/filter.php?i=${encodeURIComponent(ingredient.replace(/\s+/g, '_'))}`);
  const ids = (res?.meals ?? []).slice(0, limit).map((m) => m.idMeal);
  const full = await Promise.all(ids.map((id) => getJson<{ meals: MealDbMeal[] | null }>(`${MEALDB()}/lookup.php?i=${id}`)));
  return full.flatMap((r) => (r?.meals ?? []).map(fromMealDb));
}

/* ------------------------------------------------------------------ Spoonacular (optional) */
interface SpoonRecipe {
  id: number;
  title: string;
  image?: string;
  servings?: number;
  readyInMinutes?: number;
  cuisines?: string[];
  dishTypes?: string[];
  summary?: string;
  sourceUrl?: string;
  extendedIngredients?: Array<{ name: string; original: string; amount?: number; unit?: string }>;
  analyzedInstructions?: Array<{ steps: Array<{ step: string }> }>;
  instructions?: string;
  nutrition?: { nutrients?: Array<{ name: string; amount: number }> };
}

function fromSpoonacular(r: SpoonRecipe): ExternalRecipe {
  const n = (name: string) => Math.round(r.nutrition?.nutrients?.find((x) => x.name === name)?.amount ?? 0);
  const steps = r.analyzedInstructions?.[0]?.steps.map((s) => s.step.trim()).filter(Boolean) ?? splitInstructions(r.instructions ?? '');
  return {
    source: 'spoonacular',
    externalId: String(r.id),
    title: r.title,
    description: r.summary?.replace(/<[^>]+>/g, '').split('. ').slice(0, 1).join('. ').slice(0, 280),
    imageUrl: r.image,
    cuisine: r.cuisines?.[0],
    category: r.dishTypes?.[0],
    servings: r.servings ?? 2,
    prepTimeMin: r.readyInMinutes,
    ingredients: (r.extendedIngredients ?? []).map((i) => ({ name: i.name.charAt(0).toUpperCase() + i.name.slice(1), amount: [i.amount ? +i.amount.toFixed(2) : '', i.unit ?? ''].join(' ').trim() || 'to taste' })),
    steps,
    sourceUrl: r.sourceUrl,
    nutrition: r.nutrition ? { kcal: n('Calories'), proteinG: n('Protein'), carbsG: n('Carbohydrates'), fatG: n('Fat') } : undefined,
  };
}

export async function spoonacularSearch(q: string, ingredients: string[] = [], limit = 8) {
  if (!config.SPOONACULAR_API_KEY) return [];
  const params = new URLSearchParams({ apiKey: config.SPOONACULAR_API_KEY, number: String(limit), addRecipeInformation: 'true', fillIngredients: 'true', addRecipeNutrition: 'true', instructionsRequired: 'true' });
  if (q) params.set('query', q);
  if (ingredients.length) params.set('includeIngredients', ingredients.join(','));
  const res = await getJson<{ results?: SpoonRecipe[] }>(`https://api.spoonacular.com/recipes/complexSearch?${params}`);
  return (res?.results ?? []).map(fromSpoonacular);
}

/* ------------------------------------------------------------------ normalisation helpers */
export function splitInstructions(text: string): string[] {
  const lines = text
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(step\s*\d+[:.)]?|\d+[.)])\s*/i, '').trim())
    .filter((l) => l.length > 3 && !/^step\s*\d+$/i.test(l));
  const out: string[] = [];
  for (const line of lines.length ? lines : [text]) {
    // One long paragraph → two sentences per step.
    const sentences = line.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [line];
    if (line.length < 260 || sentences.length < 3) out.push(line);
    else for (let i = 0; i < sentences.length; i += 2) out.push(sentences.slice(i, i + 2).join(' '));
  }
  return out.slice(0, 15);
}

/** "for 10 minutes", "10-15 mins", "1 hour" → seconds (first match). */
export function timerFrom(step: string): number | undefined {
  const h = step.match(/(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(?:\d+\s*)?(?:hours?|hrs?)\b/i);
  if (h) return Math.round(parseFloat(h[1]!) * 3600);
  const m = step.match(/(\d+)\s*(?:-|to)?\s*(?:\d+\s*)?(?:minutes?|mins?)\b/i);
  if (m) return parseInt(m[1]!, 10) * 60;
  return undefined;
}

const FILLER = new Set(['in', 'on', 'into', 'next', 'then', 'now', 'once', 'when', 'while', 'meanwhile', 'finally', 'first', 'firstly', 'after', 'using', 'with', 'for', 'to', 'the', 'a', 'an', 'and', 'step', 'you', 'it', 'if', 'or', 'of', 'at', 'this', 'your', 'all', 'also', 'again', 'gently', 'carefully', 'quickly', 'slowly']);
/** First verb-like word of a step ("In a wok add broth…" → ADD). */
export const phaseFrom = (step: string) => {
  const words = step.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const w = words.find((x, i) => !FILLER.has(x) && x.length >= 3 && !(i > 0 && FILLER.has(words[i - 1] ?? '') && ['in', 'on', 'into', 'a', 'the'].includes(words[i - 1] ?? '')));
  return w && w.length <= 10 ? w.toUpperCase() : 'COOK';
};

const UNIT_G: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, ml: 1, l: 1000, litre: 1000, liter: 1000, oz: 28.35, lb: 453.6, lbs: 453.6, cup: 240, cups: 240, tbsp: 15, tbs: 15, tablespoon: 15, tablespoons: 15, tsp: 5, teaspoon: 5, teaspoons: 5, clove: 5, cloves: 5, slice: 30, slices: 30, pinch: 0.5, can: 400, tin: 400 };
const PIECE_G = 120;

/** "1 1/2 cups" → grams (best effort; 0 when unknown). */
export function gramsFrom(amount: string, food: CachedFood | null): number {
  const a = amount.toLowerCase().replace(/½/g, ' 1/2').replace(/¼/g, ' 1/4').replace(/¾/g, ' 3/4');
  const num = a.match(/(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:\.\d+)?)/);
  let qty = 0;
  if (num) qty = num[1] ? +num[1] + +num[2]! / +num[3]! : num[4] ? +num[4] / +num[5]! : parseFloat(num[6]!);
  if (!qty) return 0;
  const unit = a.replace(/[\d/.\s]+/, ' ').trim().split(/\s+/)[0]?.replace(/[^a-z]/g, '') ?? '';
  const direct = a.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb)\b/);
  if (direct) return parseFloat(direct[1]!) * (UNIT_G[direct[2]!] ?? 1);
  if (UNIT_G[unit]) return qty * UNIT_G[unit]!;
  return food?.defaultUnit === 'pcs' || ['large', 'medium', 'small', 'whole', ''].includes(unit) ? qty * PIECE_G : 0;
}

/** Writes (or returns the cached) external recipe. `resolve` maps ingredient names to foods. */
export async function upsertExternalRecipe(r: ExternalRecipe, resolve: (name: string) => CachedFood | null): Promise<string | null> {
  const existing = await prisma.recipe.findUnique({ where: { externalSource_externalId: { externalSource: r.source, externalId: r.externalId } }, select: { id: true } });
  if (existing) return existing.id;
  if (r.ingredients.length < 2 || r.steps.length < 1) return null;

  const resolved = r.ingredients.map((i) => resolve(i.name));
  const allergens = new Set<string>();
  let dairy = false;
  let kcal = 0, protein = 0, carbs = 0, fat = 0, covered = 0;
  resolved.forEach((f, idx) => {
    f?.allergens.forEach((a) => allergens.add(a));
    if (f?.isDairy) dairy = true;
    const g = gramsFrom(r.ingredients[idx]!.amount, f);
    if (f && f.kcal != null && g > 0) {
      const k = g / 100;
      kcal += f.kcal * k; protein += (f.proteinG ?? 0) * k; carbs += (f.carbsG ?? 0) * k; fat += (f.fatG ?? 0) * k;
      covered++;
    }
  });
  allergensFromNames(r.ingredients.map((i) => i.name)).forEach((a) => allergens.add(a));
  if (allergens.has('dairy')) dairy = true;
  const coverage = covered / r.ingredients.length;
  const servings = Math.max(1, r.servings);
  const nutrition = r.nutrition ?? (coverage >= 0.5 ? { kcal: Math.round(kcal / servings), proteinG: Math.round(protein / servings), carbsG: Math.round(carbs / servings), fatG: Math.round(fat / servings) } : undefined);

  const steps = r.steps.map((text, idx) => ({
    stepNumber: idx + 1,
    phase: phaseFrom(text),
    instruction: text.slice(0, 1000),
    timerSec: timerFrom(text),
    ingredients: r.ingredients.filter((i) => text.toLowerCase().includes(i.name.toLowerCase().split(' ').pop() ?? '~')).map((i) => i.name).slice(0, 8),
  }));
  const totalTimer = steps.reduce((s, x) => s + (x.timerSec ?? 0), 0) / 60;
  const prepTimeMin = r.prepTimeMin ?? Math.min(180, Math.max(10, Math.round(totalTimer + 8 + r.ingredients.length * 1.5)));
  const effort = steps.length > 12 || r.ingredients.length > 16 ? 'Cheffy' : steps.length > 7 || r.ingredients.length > 11 ? 'Medium' : 'Easy';
  const cat = (r.category ?? '').toLowerCase();
  const tone = /beef|lamb|pork|goat/.test(cat) ? 'blush' : /vegetarian|vegan|side|starter/.test(cat) ? 'sage' : 'cream';

  const created = await prisma.recipe.create({
    data: {
      origin: 'external',
      visibility: 'public',
      externalSource: r.source,
      externalId: r.externalId,
      title: r.title.slice(0, 120),
      description: r.description ?? (r.cuisine ? `${r.cuisine} ${r.category?.toLowerCase() ?? 'dish'} from the FRIDGR recipe library.` : undefined),
      imageUrl: r.imageUrl?.slice(0, 500),
      tone,
      cuisine: r.cuisine,
      effort,
      style: /salad/i.test(cat) || /salad/i.test(r.title) ? 'Salad' : undefined,
      prepTimeMin,
      servings,
      kcal: nutrition?.kcal || undefined,
      proteinG: nutrition?.proteinG || undefined,
      carbsG: nutrition?.carbsG || undefined,
      fatG: nutrition?.fatG || undefined,
      nutritionSource: r.nutrition ? 'ai_estimate' : nutrition ? 'usda' : undefined,
      nutritionConfidence: r.nutrition ? 0.8 : nutrition ? Math.round(coverage * 100) / 100 : undefined,
      allergens: [...allergens],
      isDairyFree: !dairy,
      sourceUrl: r.sourceUrl?.slice(0, 500),
      videoUrl: r.videoUrl?.slice(0, 500),
      publishedAt: new Date(),
      ingredients: { create: r.ingredients.map((i, idx) => ({ name: i.name.slice(0, 80), amount: i.amount.slice(0, 40), position: idx, foodId: resolved[idx]?.id })) },
      steps: { create: steps },
    },
    select: { id: true },
  });
  return created.id;
}

/* ------------------------------------------------------------------ routes */
export const externalRecipesRouter = Router();
externalRecipesRouter.use(requireVerified);

/**
 * Search the recipe databases; results are cached into our table and
 * returned in the app's recipe shape (with fridge match and per-user flags).
 */
externalRecipesRouter.get(
  '/search',
  query(z.object({ q: z.string().trim().max(60).default(''), ingredient: z.string().trim().max(40).optional(), limit: z.coerce.number().int().min(1).max(20).default(10) })),
  wrap(async (req, res) => {
    const u = authUser(req);
    const q = String(req.query.q ?? '');
    const ingredient = req.query.ingredient ? String(req.query.ingredient) : undefined;
    if (!q && !ingredient) throw AppError.badRequest('Search for a dish or an ingredient.');
    const limit = Number(req.query.limit);
    const [fromMeal, fromSpoon] = await Promise.all([ingredient ? mealDbByIngredient(ingredient, limit) : mealDbSearch(q), spoonacularSearch(q, ingredient ? [ingredient] : [], Math.min(limit, 8))]);
    const resolve = await makeFoodResolver();
    const ids: string[] = [];
    for (const r of [...fromSpoon, ...fromMeal].slice(0, limit)) {
      const id = await upsertExternalRecipe(r, resolve).catch((e) => {
        logger.warn({ err: (e as Error).message, title: r.title }, 'external recipe upsert failed');
        return null;
      });
      if (id) ids.push(id);
    }
    const rows = await prisma.recipe.findMany({ where: { id: { in: ids } }, include: recipeInclude });
    const ordered = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is (typeof rows)[number] => !!r);
    res.json({ recipes: await decorateRecipes(u.id, ordered), sources: { themealdb: fromMeal.length, spoonacular: fromSpoon.length } });
  }),
);
