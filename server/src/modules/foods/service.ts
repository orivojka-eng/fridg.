import { prisma } from '../../db.js';

export const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Singularise the last word roughly enough for ingredient matching. */
export const singular = (word: string) => (word.endsWith('ies') ? word.slice(0, -3) + 'y' : word.endsWith('oes') ? word.slice(0, -2) : word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);

/** Resolves a free-text ingredient name to a normalised Food row (by name or alias), or null. */
export async function resolveFood(name: string) {
  const n = normalizeName(name);
  if (!n) return null;
  const candidates = [n, singular(n), n.split(' ').map(singular).join(' ')];
  const direct = await prisma.food.findFirst({ where: { name: { in: candidates } } });
  if (direct) return direct;
  const alias = await prisma.foodAlias.findFirst({ where: { alias: { in: candidates } }, include: { food: true } });
  return alias?.food ?? null;
}

export async function resolveFoods(names: string[]) {
  const out = new Map<string, Awaited<ReturnType<typeof resolveFood>>>();
  for (const name of names) out.set(name, await resolveFood(name));
  return out;
}

/** True when one ingredient string refers to another (e.g. "chicken thighs" vs "chicken"). */
export const namesOverlap = (a: string, b: string) => {
  const na = normalizeName(a).split(' ').map(singular).filter((w) => w.length > 2);
  const nb = normalizeName(b).split(' ').map(singular).filter((w) => w.length > 2);
  if (!na.length || !nb.length) return false;
  return na.some((w) => nb.includes(w));
};

export interface CachedFood {
  id: string;
  name: string;
  displayName: string;
  defaultUnit: string;
  allergens: string[];
  isDairy: boolean;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/**
 * Loads every food and alias once and resolves names in memory. For bulk
 * work (recipe-database imports) where per-ingredient queries would be slow.
 */
export async function makeFoodResolver() {
  const foods = await prisma.food.findMany({ include: { aliases: true } });
  const byKey = new Map<string, CachedFood>();
  for (const f of foods) {
    const c: CachedFood = { id: f.id, name: f.name, displayName: f.displayName, defaultUnit: f.defaultUnit, allergens: f.allergens, isDairy: f.isDairy, kcal: f.kcal, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG };
    byKey.set(f.name, c);
    for (const a of f.aliases) byKey.set(a.alias, c);
  }
  return (raw: string): CachedFood | null => {
    const n = normalizeName(raw);
    if (!n) return null;
    const words = n.split(' ');
    const candidates = [n, singular(n), words.map(singular).join(' ')];
    // Also try dropping leading descriptors: "large free range eggs" -> "free range eggs" -> "eggs".
    for (let i = 1; i < words.length; i++) candidates.push(words.slice(i).join(' '), words.slice(i).map(singular).join(' '));
    for (const c of candidates) {
      const hit = byKey.get(c);
      if (hit) return hit;
    }
    return null;
  };
}
