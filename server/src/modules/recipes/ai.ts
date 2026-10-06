import { Router } from 'express';
import { z } from 'zod';
import { aiConfigured, structuredWithRetry } from '../../ai/client.js';
import { getJob, recordUsage, startJob } from '../../ai/jobs.js';
import { estimateNutrition } from '../../ai/nutrition.js';
import { buildPersonalContext, violations, type PersonalContext } from '../../ai/personalization.js';
import { aiRecipe, aiRecipeList, recipeJson, recipeListJson, type AiRecipe } from '../../ai/schemas.js';
import { config } from '../../config.js';
import { canSee } from './access.js';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { body, params, wrap } from '../../middleware/validate.js';
import { consumeQuota } from '../ai/quota.js';
import { createRecipeRecord, decorateRecipes, type RecipeInput } from './router.js';
import { recipeInclude } from './serialize.js';

export const recipesAiRouter = Router();
recipesAiRouter.use(requireVerified);

const generateInput = z.object({
  prompt: z.string().trim().max(300).default(''),
  ingredientNames: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  servings: z.number().int().min(1).max(12).optional(),
  effort: z.enum(['Easy', 'Medium', 'Cheffy']).default('Easy'),
  style: z.enum(['Bowl', 'Traybake', 'Salad']).optional(),
  count: z.number().int().min(1).max(6).default(4),
});

/** AI recipe → validated `RecipeInput` for `createRecipeRecord`, with nutrition resolved. */
async function toRecipeInput(r: AiRecipe): Promise<{ input: RecipeInput; nutritionSource: 'usda' | 'ai_estimate'; nutritionConfidence: number }> {
  const n = await estimateNutrition(r);
  return {
    input: {
      title: r.title,
      description: r.description,
      cuisine: r.cuisine,
      effort: r.effort,
      style: r.style,
      prepTimeMin: r.prepTimeMin,
      servings: r.servings,
      tone: r.tone,
      kcal: n.kcal,
      proteinG: n.proteinG,
      carbsG: n.carbsG,
      fatG: n.fatG,
      ingredients: r.ingredients.map((i) => ({ name: i.name, amount: i.amount, isOptional: !!i.isOptional })),
      steps: r.steps.map((s) => ({ phase: s.phase, instruction: s.instruction, timerSec: s.timerSec, ingredients: s.ingredients })),
      visibility: 'private',
    },
    nutritionSource: n.source,
    nutritionConfidence: n.confidence,
  };
}

async function persistAiRecipes(userId: string, jobId: string, recipes: AiRecipe[], origin: 'ai_generated' | 'adapted', adaptedFromId?: string) {
  const ids: string[] = [];
  for (const r of recipes) {
    const { input, nutritionSource, nutritionConfidence } = await toRecipeInput(r);
    const created = await createRecipeRecord({ authorId: userId, origin, input, aiGenerationId: jobId, adaptedFromId });
    await prisma.recipe.update({ where: { id: created.id }, data: { nutritionSource, nutritionConfidence } });
    ids.push(created.id);
  }
  return ids;
}

/** Drops unsafe recipes; asks the model once more if too few survive. */
async function generateSafe(ctx: PersonalContext, user: string, count: number, jobId: string): Promise<AiRecipe[]> {
  const first = await structuredWithRetry({ system: ctx.system, user, tool: { name: 'propose_recipes', description: 'Return the recipes the cook should make.', inputSchema: recipeListJson }, schema: aiRecipeList, maxTokens: 8000 });
  await recordUsage(jobId, first);
  let safe = first.data.recipes.filter((r) => {
    const v = violations(r, ctx.hardConstraints);
    if (v.length) logger.warn({ title: r.title, v }, 'rejected recipe (hard constraint)');
    return v.length === 0;
  });
  if (safe.length < Math.min(2, count)) {
    const retry = await structuredWithRetry({
      system: ctx.system,
      user: `${user}\n\nIMPORTANT: your previous answer included forbidden ingredients (${ctx.hardConstraints.allergens.join(', ') || ctx.hardConstraints.dislikes.join(', ')}). Propose ${count} different recipes that strictly avoid them.`,
      tool: { name: 'propose_recipes', description: 'Return the recipes the cook should make.', inputSchema: recipeListJson },
      schema: aiRecipeList,
      maxTokens: 8000,
    });
    await recordUsage(jobId, retry);
    safe = [...safe, ...retry.data.recipes.filter((r) => violations(r, ctx.hardConstraints).length === 0)];
  }
  if (!safe.length) throw new AppError(502, 'UPSTREAM', 'Could not build safe recipes from those ingredients. Try adding a few more.');
  return safe.slice(0, count);
}

/**
 * Retrieval for grounding: library / community recipes that share the most
 * ingredients with the fridge and break none of the hard constraints.
 */
async function provenMatches(pool: Array<{ name: string; foodId: string | null }>, ctx: PersonalContext) {
  const foodIds = pool.map((f) => f.foodId).filter((v): v is string => !!v);
  if (!foodIds.length) return [];
  const candidates = await prisma.recipe.findMany({
    where: {
      visibility: 'public',
      origin: { in: ['seeded', 'external', 'user_created'] },
      ingredients: { some: { foodId: { in: foodIds } } },
      ...(ctx.hardConstraints.allergens.length ? { NOT: { allergens: { hasSome: ctx.hardConstraints.allergens } } } : {}),
    },
    include: { ingredients: { orderBy: { position: 'asc' } }, steps: { orderBy: { stepNumber: 'asc' } } },
    take: 120,
  });
  const have = new Set(foodIds);
  return candidates
    .filter((r) => violations({ title: r.title, ingredients: r.ingredients.map((i) => ({ name: i.name, amount: i.amount })) }, ctx.hardConstraints).length === 0)
    .map((r) => {
      const req = r.ingredients.filter((i) => !i.isOptional);
      const hit = req.filter((i) => i.foodId && have.has(i.foodId)).length;
      const coverage = hit / Math.max(1, req.length);
      return { r, coverage, score: coverage + hit * 0.05 + (r.ratingAvg ?? 0) * 0.02 };
    })
    // Only recipes the fridge can mostly cover are worth showing next to the AI ideas.
    .filter((x) => x.coverage >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.r);
}

/* ------------------------------------------------------------------ generate */
recipesAiRouter.post(
  '/generate',
  aiLimiter,
  body(generateInput),
  wrap(async (req, res) => {
    const u = authUser(req);
    if (!aiConfigured()) throw AppError.notImplemented('Recipe generation');
    const input = req.body as z.infer<typeof generateInput>;
    await consumeQuota(u.id, u.isPremium, 'generations');
    const fridge = await prisma.fridgeItem.findMany({ where: { userId: u.id }, orderBy: { expiresAt: 'asc' } });
    const selected = input.ingredientNames.length ? fridge.filter((f) => input.ingredientNames.some((n) => n.toLowerCase() === f.name.toLowerCase())) : fridge;
    const pool = selected.length ? selected : fridge;
    const expiring = pool.filter((f) => f.expiresAt && f.expiresAt.getTime() - Date.now() < 3 * 86_400_000).map((f) => f.name);

    const jobId = await startJob({
      userId: u.id,
      feature: 'generate',
      quota: 'generations',
      model: config.AI_MODEL_PRIMARY,
      request: { ...input, fridge: pool.map((f) => f.name) },
      run: async (id) => {
        const ctx = await buildPersonalContext(u.id);
        const servings = input.servings ?? ctx.servings;
        const refs = await provenMatches(pool, ctx);
        const user = `Fridge contents to cook from (use as many as sensible, assume salt, pepper, oil and basic dried spices are always available):
${pool.map((f) => `- ${f.name} (${f.quantity} ${f.unit})`).join('\n') || '- (empty fridge: suggest store-cupboard recipes with a tiny shopping list)'}
${expiring.length ? `\nUse up first (expiring soon): ${expiring.join(', ')}` : ''}
${input.prompt ? `\nThe cook asked for: "${input.prompt}"` : ''}

Propose ${input.count} distinct recipes for ${servings} serving(s), effort level "${input.effort}"${input.style ? `, style "${input.style}"` : ''}, each within about ${ctx.cookingTimeMin} minutes. Prefer recipes that need at most 2 ingredients not in the fridge. Vary cuisines, favouring: ${ctx.cuisinePreference.join(', ') || 'anything'}.${refs.length ? `

PROVEN RECIPES from real cooks that match this fridge. Use them as references for techniques, ratios, timings and seasoning. Do not copy them; propose different dishes:
${refs.map((r) => `• ${r.title} (${r.cuisine ?? 'home'}): ${r.ingredients.map((i) => `${i.amount} ${i.name}`.trim()).join(', ')}. Method: ${r.steps.slice(0, 4).map((st) => st.instruction).join(' ').slice(0, 400)}`).join('\n')}` : ''}`;
        const recipes = await generateSafe(ctx, user, input.count, id);
        const recipeIds = await persistAiRecipes(u.id, id, recipes, 'ai_generated');
        // Real, proven matches from the library sit next to the new ideas.
        return { recipeIds: [...recipeIds, ...refs.slice(0, 2).map((r) => r.id)] };
      },
    });
    res.status(202).json({ jobId, status: 'running' });
  }),
);

recipesAiRouter.get(
  '/generate/:jobId',
  params(z.object({ jobId: z.string().uuid() })),
  wrap(async (req, res) => {
    const u = authUser(req);
    const job = await getJob(u.id, req.params.jobId, 'generate');
    if (job.status !== 'done') return res.json({ jobId: job.id, status: job.status, error: job.error ?? undefined });
    const ids = ((job.responseJson as { recipeIds?: string[] } | null)?.recipeIds ?? []) as string[];
    const rows = await prisma.recipe.findMany({ where: { id: { in: ids } }, include: recipeInclude });
    const ordered = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is (typeof rows)[number] => !!r);
    res.json({ jobId: job.id, status: 'done', recipes: await decorateRecipes(u.id, ordered) });
  }),
);

/* ------------------------------------------------------------------ adapt */
const adaptInput = z.object({
  swaps: z.array(z.object({ from: z.string().trim().min(1).max(80), to: z.string().trim().min(1).max(80) })).max(10).default([]),
  boost: z.enum(['protein', 'lighter', 'faster', 'vegetarian', 'dairy_free']).optional(),
  servings: z.number().int().min(1).max(12).optional(),
  note: z.string().trim().max(200).optional(),
});

recipesAiRouter.post(
  '/:id/adapt',
  aiLimiter,
  params(z.object({ id: z.string().uuid() })),
  body(adaptInput),
  wrap(async (req, res) => {
    const u = authUser(req);
    if (!aiConfigured()) throw AppError.notImplemented('Recipe adaptation');
    const input = req.body as z.infer<typeof adaptInput>;
    const source = await prisma.recipe.findUnique({ where: { id: req.params.id }, include: recipeInclude });
    if (!source || !canSee(source, u.id)) throw AppError.notFound('Recipe');
    await consumeQuota(u.id, u.isPremium, 'generations');

    const jobId = await startJob({
      userId: u.id,
      feature: 'adapt',
      quota: 'generations',
      model: config.AI_MODEL_PRIMARY,
      request: { recipeId: source.id, ...input },
      run: async (id) => {
        const ctx = await buildPersonalContext(u.id);
        const changes = [
          ...input.swaps.map((s) => `swap "${s.from}" for "${s.to}"`),
          input.boost === 'protein' ? 'raise protein per serving by at least 10 g without adding a whole new dish' : '',
          input.boost === 'lighter' ? 'reduce calories per serving by roughly 25 % while keeping it satisfying' : '',
          input.boost === 'faster' ? 'cut total time to 20 minutes or less' : '',
          input.boost === 'vegetarian' ? 'make it vegetarian' : '',
          input.boost === 'dairy_free' ? 'make it dairy-free' : '',
          input.servings ? `scale to ${input.servings} servings` : '',
          input.note ?? '',
        ].filter(Boolean);
        const user = `Adapt this recipe. Keep its character and everything that still works; change only what the requested adaptation needs and update timings, amounts and steps consistently.

ORIGINAL
Title: ${source.title}
Servings: ${source.servings}
Ingredients:
${source.ingredients.map((i) => `- ${i.name}: ${i.amount}${i.isOptional ? ' (optional)' : ''}`).join('\n')}
Steps:
${source.steps.map((s) => `${s.stepNumber}. [${s.phase ?? ''}] ${s.instruction}`).join('\n')}

REQUESTED CHANGES
${changes.map((c) => `- ${c}`).join('\n') || '- none stated: tidy the recipe and make it fit the cook better'}`;
        const result = await structuredWithRetry({ system: ctx.system, user, tool: { name: 'adapted_recipe', description: 'Return the adapted recipe.', inputSchema: recipeJson }, schema: aiRecipe, maxTokens: 4000 });
        await recordUsage(id, result);
        const v = violations(result.data, ctx.hardConstraints);
        if (v.length) throw new AppError(502, 'UPSTREAM', `The adaptation broke a dietary rule (${v[0]}). Try a different swap.`);
        const [recipeId] = await persistAiRecipes(u.id, id, [result.data], 'adapted', source.id);
        return { recipeIds: [recipeId] };
      },
    });
    res.status(202).json({ jobId, status: 'running' });
  }),
);

recipesAiRouter.get(
  '/adapt/:jobId',
  params(z.object({ jobId: z.string().uuid() })),
  wrap(async (req, res) => {
    const u = authUser(req);
    const job = await getJob(u.id, req.params.jobId, 'adapt');
    if (job.status !== 'done') return res.json({ jobId: job.id, status: job.status, error: job.error ?? undefined });
    const ids = ((job.responseJson as { recipeIds?: string[] } | null)?.recipeIds ?? []) as string[];
    const rows = await prisma.recipe.findMany({ where: { id: { in: ids } }, include: recipeInclude });
    const [recipe] = await decorateRecipes(u.id, rows);
    res.json({ jobId: job.id, status: 'done', recipe });
  }),
);

/* ------------------------------------------------------------------ substitutions (deterministic, no AI) */
export const SUBSTITUTIONS: Record<string, { swap: string; why: string }> = {
  gochujang: { swap: 'Sriracha + honey', why: 'Heat and sweetness land in the same place.' },
  mirin: { swap: 'Rice vinegar + 1 tsp sugar', why: 'Close enough for the glaze.' },
  'harissa paste': { swap: 'Smoked paprika + chilli + garlic', why: 'Builds the same smoky heat from the spice rack.' },
  lemon: { swap: 'A splash of vinegar', why: 'You only need the acidity here.' },
  'salmon fillets': { swap: 'Chicken breast', why: 'Same glaze, same timings, slightly leaner.' },
  chickpeas: { swap: 'Eggs, soft-boiled', why: 'Keeps the protein without a trip to the shop.' },
  'white beans': { swap: 'Chickpeas', why: 'Braises the same way and holds its shape.' },
  miso: { swap: 'Soy sauce + tahini', why: 'Salty and nutty, which is what miso brings.' },
  butter: { swap: 'Olive oil', why: 'Roasts just as well.' },
  'sesame oil': { swap: 'Olive oil + toasted seeds', why: 'You lose a little aroma, nothing else.' },
  'greek yoghurt': { swap: 'Coconut yoghurt', why: 'Same tang and body, dairy-free.' },
  'feta cheese': { swap: 'Olives + a squeeze of lemon', why: 'Salty and sharp without the dairy.' },
};
