import { ExpiryStatus, FridgeItem, Recipe, RecipeIngredient, RecipeMatch } from '../types';

/** Lower-case, strip punctuation, collapse whitespace. */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const singular = (s: string) => (s.endsWith('es') ? s.slice(0, -2) : s.endsWith('s') ? s.slice(0, -1) : s);

/** Words that are too generic to count as a match on their own. */
const STOP_WORDS = new Set(['fresh', 'large', 'small', 'fillet', 'fillets', 'paste', 'oil', 'sauce', 'of', 'and', 'the']);

const ALIASES: Record<string, string[]> = {
  yoghurt: ['yogurt', 'greek yoghurt', 'greek yogurt'],
  'spring onion': ['scallion', 'green onion'],
  courgette: ['zucchini'],
  coriander: ['cilantro'],
  'red pepper': ['bell pepper', 'capsicum', 'red peppers'],
  'cherry tomato': ['tomato', 'tomatoes'],
  rice: ['brown rice', 'short grain rice', 'white rice', 'basmati'],
  sourdough: ['bread', 'loaf'],
};

const expand = (name: string): string[] => {
  const n = normalize(name);
  const out = new Set<string>([n, singular(n)]);
  Object.entries(ALIASES).forEach(([key, list]) => {
    const group = [key, ...list].map(normalize);
    if (group.some((g) => g === n || singular(g) === singular(n))) {
      group.forEach((g) => out.add(g));
    }
  });
  return Array.from(out);
};

/** True when a recipe ingredient can be satisfied by a fridge item name. */
export function namesMatch(ingredientName: string, fridgeName: string): boolean {
  const a = expand(ingredientName);
  const b = expand(fridgeName);
  for (const x of a) {
    for (const y of b) {
      if (!x || !y) continue;
      if (x === y) return true;
      if (x.includes(y) || y.includes(x)) {
        // Guard against matching purely on a generic word like "oil".
        const shorter = x.length <= y.length ? x : y;
        if (!STOP_WORDS.has(shorter)) return true;
      }
    }
  }
  // Fall back to shared meaningful head word (e.g. "salmon fillets" vs "salmon").
  const headA = singular(normalize(ingredientName).split(' ').filter((w) => !STOP_WORDS.has(w)).pop() || '');
  const headB = singular(normalize(fridgeName).split(' ').filter((w) => !STOP_WORDS.has(w)).pop() || '');
  return headA.length > 3 && headA === headB;
}

export function ingredientInFridge(ingredient: RecipeIngredient | string, fridge: FridgeItem[]): boolean {
  const name = typeof ingredient === 'string' ? ingredient : ingredient.name;
  return fridge.some((f) => namesMatch(name, f.name));
}

/** Fridge items that would be used by a recipe. */
export function fridgeItemsUsedBy(recipe: Recipe, fridge: FridgeItem[]): FridgeItem[] {
  return fridge.filter((f) => recipe.ingredients.some((ing) => namesMatch(ing.name, f.name)));
}

export function computeMatch(recipe: Recipe, fridge: FridgeItem[]): RecipeMatch {
  const required = recipe.ingredients.filter((i) => !i.isOptional);
  const have: RecipeIngredient[] = [];
  const missing: RecipeIngredient[] = [];
  required.forEach((ing) => (ingredientInFridge(ing, fridge) ? have : missing).push(ing));
  const matchPercent = required.length === 0 ? 0 : Math.round((have.length / required.length) * 100);
  return { have, missing, matchPercent, missingCount: missing.length, total: required.length };
}

export function sortByMatch(recipes: Recipe[], fridge: FridgeItem[]): Recipe[] {
  return [...recipes].sort((a, b) => {
    const ma = computeMatch(a, fridge);
    const mb = computeMatch(b, fridge);
    if (mb.matchPercent !== ma.matchPercent) return mb.matchPercent - ma.matchPercent;
    return ma.missingCount - mb.missingCount;
  });
}

/** Share of fridge items that at least one recipe would use. */
export function fridgeUsagePercent(fridge: FridgeItem[], recipes: Recipe[]): number {
  if (fridge.length === 0) return 0;
  const used = fridge.filter((f) => recipes.some((r) => r.ingredients.some((ing) => namesMatch(ing.name, f.name))));
  return Math.round((used.length / fridge.length) * 100);
}

export const expiryStatus = (daysToExpiry: number): ExpiryStatus =>
  daysToExpiry <= 0 ? 'Expired' : daysToExpiry <= 2 ? 'Expiring' : 'Fresh';

export const isExpiring = (item: FridgeItem) => item.daysToExpiry <= 2;

const DAIRY = ['yoghurt', 'yogurt', 'feta', 'cheese', 'butter', 'milk', 'cream', 'halloumi', 'parmesan', 'mozzarella'];

export function isDairyFree(recipe: Recipe): boolean {
  return !recipe.ingredients.some((i) => DAIRY.some((d) => normalize(i.name).includes(d)));
}

/** Human tags shown on a recipe, derived from its data rather than hard-coded. */
export function recipeTags(recipe: Recipe): string[] {
  const tags: string[] = [];
  if (recipe.proteinG >= 30) tags.push('High protein');
  if (recipe.prepTimeMin <= 20) tags.push('Quick');
  if (isDairyFree(recipe)) tags.push('Dairy free');
  if (recipe.calories <= 400) tags.push('Light');
  return tags;
}

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`;

/** "just now", "2h ago", "3d ago". */
export const timeAgo = (ts: number | null, now = Date.now()): string => {
  if (!ts) return 'never';
  const diff = Math.max(0, now - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/** Natural list: "a", "a and b", "a, b and c". */
export const joinNatural = (items: string[]): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

export const slugify = (s: string) => normalize(s).replace(/\s+/g, '-');

export const initialsFor = (name: string) => name.trim().charAt(0).toUpperCase() || '?';
