import { resolveFood } from '../modules/foods/service.js';
import type { AiRecipe } from './schemas.js';

export interface NutritionEstimate {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: 'usda' | 'ai_estimate';
  confidence: number;
}

// Rough gram weights for units when the model gave no grams.
const UNIT_GRAMS: Record<string, number> = { g: 1, ml: 1, tbsp: 15, tsp: 5, cup: 240, clove: 5, slice: 30, pcs: 120, pc: 120, piece: 120, bunch: 60, pack: 250, tin: 400, can: 400 };

/**
 * Per-serving nutrition. Uses the Food table (USDA-derived, per 100 g) for
 * every ingredient it can resolve with a weight; when coverage is below 60 %
 * of ingredients the model's own estimate is returned and labelled as such.
 */
export async function estimateNutrition(recipe: AiRecipe): Promise<NutritionEstimate> {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let covered = 0;
  const countable = recipe.ingredients.filter((i) => !i.isOptional);
  for (const ing of countable) {
    const grams = ing.grams ?? (ing.quantity && ing.unit ? ing.quantity * (UNIT_GRAMS[ing.unit.toLowerCase()] ?? 0) : 0);
    if (!grams) continue;
    const food = await resolveFood(ing.name);
    if (!food || food.kcal == null) continue;
    const f = grams / 100;
    kcal += food.kcal * f;
    protein += (food.proteinG ?? 0) * f;
    carbs += (food.carbsG ?? 0) * f;
    fat += (food.fatG ?? 0) * f;
    covered++;
  }
  const coverage = countable.length ? covered / countable.length : 0;
  const servings = Math.max(1, recipe.servings);
  if (coverage >= 0.6 && kcal > 0) {
    return { kcal: Math.round(kcal / servings), proteinG: Math.round(protein / servings), carbsG: Math.round(carbs / servings), fatG: Math.round(fat / servings), source: 'usda', confidence: Math.round(coverage * 100) / 100 };
  }
  const e = recipe.estimatedNutritionPerServing;
  return { kcal: Math.round(e.kcal), proteinG: Math.round(e.proteinG), carbsG: Math.round(e.carbsG), fatG: Math.round(e.fatG), source: 'ai_estimate', confidence: 0.5 };
}
