import { namesOverlap } from '../foods/service.js';

export interface MatchResult {
  matchPercent: number;
  missingCount: number;
  missing: string[];
  matched: string[];
}

/**
 * Fridge coverage for a recipe. Optional ingredients don't count against the
 * user. Matching is by normalised Food id when both sides are resolved, and by
 * word overlap otherwise (mirrors the prototype's `src/lib/matching.ts`).
 */
export function matchRecipe(
  ingredients: Array<{ name: string; foodId: string | null; isOptional: boolean }>,
  fridge: Array<{ name: string; foodId: string | null }>,
): MatchResult {
  const required = ingredients.filter((i) => !i.isOptional);
  if (required.length === 0) return { matchPercent: 100, missingCount: 0, missing: [], matched: [] };
  const fridgeFoodIds = new Set(fridge.map((f) => f.foodId).filter(Boolean));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const ing of required) {
    const hit = (ing.foodId && fridgeFoodIds.has(ing.foodId)) || fridge.some((f) => namesOverlap(f.name, ing.name));
    (hit ? matched : missing).push(ing.name);
  }
  return { matchPercent: Math.round((matched.length / required.length) * 100), missingCount: missing.length, missing, matched };
}
