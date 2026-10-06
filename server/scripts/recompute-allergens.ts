/* eslint-disable no-console */
/**
 * Recomputes allergen labels for every recipe from its ingredients (food
 * table + name scan). Run after the food table or the allergen rules change.
 *   npm run db:recompute-allergens
 */
import 'dotenv/config';
import { prisma } from '../src/db.js';
import { makeFoodResolver } from '../src/modules/foods/service.js';
import { allergensFromNames } from '../src/ai/personalization.js';

async function main() {
  // Alias fixes that must exist before resolving (idempotent).
  const coconut = await prisma.food.findUnique({ where: { name: 'coconut milk' } });
  if (coconut) for (const alias of ['coconut cream', 'creamed coconut', 'light coconut milk']) await prisma.foodAlias.upsert({ where: { alias }, create: { alias, foodId: coconut.id }, update: { foodId: coconut.id } });
  const resolve = await makeFoodResolver();
  const recipes = await prisma.recipe.findMany({ select: { id: true, allergens: true, ingredients: { select: { id: true, name: true, foodId: true } } } });
  let changed = 0;
  for (const r of recipes) {
    const set = new Set<string>();
    const relinks: Array<{ id: string; foodId: string }> = [];
    for (const i of r.ingredients) {
      const f = resolve(i.name);
      f?.allergens.forEach((a) => set.add(a));
      if (f && f.id !== i.foodId) relinks.push({ id: i.id, foodId: f.id });
    }
    allergensFromNames(r.ingredients.map((i) => i.name)).forEach((a) => set.add(a));
    const next = [...set].sort();
    const same = next.length === r.allergens.length && next.every((a) => r.allergens.includes(a));
    if (!same || relinks.length) {
      await prisma.$transaction([
        prisma.recipe.update({ where: { id: r.id }, data: { allergens: next, isDairyFree: !next.includes('dairy') } }),
        ...relinks.map((x) => prisma.recipeIngredient.update({ where: { id: x.id }, data: { foodId: x.foodId } })),
      ]);
      changed++;
    }
  }
  console.log(`checked ${recipes.length} recipes, updated ${changed}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
