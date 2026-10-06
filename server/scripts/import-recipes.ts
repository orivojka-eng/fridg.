/* eslint-disable no-console */
/**
 * Loads the public recipe library into the database (idempotent).
 *   npm run db:import-recipes            -> all of TheMealDB (a–z, ~300 recipes)
 *   npm run db:import-recipes -- pasta   -> also search a term (TheMealDB + Spoonacular if keyed)
 */
import 'dotenv/config';
import { prisma } from '../src/db.js';
import { makeFoodResolver } from '../src/modules/foods/service.js';
import { mealDbByLetter, mealDbSearch, spoonacularSearch, upsertExternalRecipe, type ExternalRecipe } from '../src/modules/recipes/external.js';

async function main() {
  const terms = process.argv.slice(2);
  const resolve = await makeFoodResolver();
  const batches: ExternalRecipe[][] = [];
  if (terms.length) {
    for (const t of terms) batches.push(await mealDbSearch(t), await spoonacularSearch(t, [], 10));
  } else {
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') batches.push(await mealDbByLetter(letter));
  }
  const all = batches.flat();
  let added = 0, skipped = 0;
  const before = await prisma.recipe.count({ where: { origin: 'external' } });
  for (const r of all) {
    const id = await upsertExternalRecipe(r, resolve).catch((e) => {
      console.warn('skip', r.title, (e as Error).message);
      return null;
    });
    if (id) added++;
    else skipped++;
  }
  const after = await prisma.recipe.count({ where: { origin: 'external' } });
  console.log(`fetched ${all.length}, stored ${after - before} new (${after} external recipes total), skipped ${skipped}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
