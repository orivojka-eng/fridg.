import type { Prisma } from '@prisma/client';

/**
 * Who may read a recipe: everyone for public, seeded and library recipes;
 * only the author for private ones. Every endpoint that takes a recipe id
 * from the client goes through this, so private recipes cannot be read,
 * copied, commented on or cooked by guessing ids.
 */
export const canSee = (r: { visibility: string; authorId: string | null; origin: string }, userId: string) =>
  r.visibility === 'public' || r.authorId === userId || r.origin === 'seeded' || r.origin === 'external';

/** Same rule as a Prisma filter. */
export const visibleTo = (userId: string): Prisma.RecipeWhereInput => ({
  OR: [{ visibility: 'public' }, { authorId: userId }, { origin: { in: ['seeded', 'external'] } }],
});
