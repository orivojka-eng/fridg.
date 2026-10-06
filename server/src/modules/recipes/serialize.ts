import type { Prisma } from '@prisma/client';

export const recipeInclude = {
  ingredients: { orderBy: { position: 'asc' } },
  steps: { orderBy: { stepNumber: 'asc' } },
  author: { select: { id: true, firstName: true, lastName: true, handle: true, profile: { select: { avatarIndex: true, bio: true } } } },
  imported: { include: { source: true } },
} satisfies Prisma.RecipeInclude;

export type RecipeWithRelations = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;

const sourceLabel: Record<string, string> = { themealdb: 'via TheMealDB', spoonacular: 'via Spoonacular' };

const platformLabel: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook' };

/** Matches the mobile `Recipe` type so screens keep working unchanged. */
export function serializeRecipe(r: RecipeWithRelations, extra: { isSaved?: boolean; isLiked?: boolean; matchPercent?: number; missingCount?: number; myRating?: number | null } = {}) {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    tone: (r.tone as 'cream' | 'sage' | 'blush' | null) ?? undefined,
    prepTimeMin: r.prepTimeMin,
    calories: r.kcal ?? 0,
    proteinG: r.proteinG ?? 0,
    carbsG: r.carbsG ?? 0,
    fatG: r.fatG ?? 0,
    nutritionSource: r.nutritionSource ?? undefined,
    servings: r.servings,
    authorId: r.author?.id,
    authorName: r.author ? `${r.author.firstName} ${r.author.lastName.charAt(0)}.`.trim() : r.origin === 'ai_generated' ? 'FRIDGR AI' : r.origin === 'external' ? 'FRIDGR Library' : undefined,
    authorHandle: r.author ? `@${r.author.handle}` : undefined,
    authorTag: r.author?.profile?.bio ?? (r.origin === 'external' ? [r.cuisine, sourceLabel[r.externalSource ?? '']].filter(Boolean).join(' • ') : undefined),
    authorAvatarIndex: r.author?.profile?.avatarIndex,
    authorRating: r.ratingAvg ? r.ratingAvg.toFixed(1) : undefined,
    effort: r.effort,
    style: r.style ?? undefined,
    cuisine: r.cuisine ?? undefined,
    origin: r.origin,
    visibility: r.visibility,
    allergens: r.allergens,
    ingredients: r.ingredients.map((i) => ({ id: i.id, name: i.name, amount: i.amount, isOptional: i.isOptional, foodId: i.foodId ?? undefined })),
    steps: r.steps.map((s) => ({ stepNumber: s.stepNumber, phase: s.phase ?? '', instruction: s.instruction, timerSec: s.timerSec ?? undefined, ingredients: s.ingredients })),
    importedFrom: r.imported ? platformLabel[r.imported.source.platform] ?? r.imported.source.platform : undefined,
    sourceUrl: r.imported?.source.url ?? r.sourceUrl ?? undefined,
    videoUrl: r.videoUrl ?? undefined,
    externalSource: r.externalSource ?? undefined,
    sourceCreator: r.imported?.source.creatorHandle ?? undefined,
    viewsCount: r.imported?.source.viewsLabel ?? undefined,
    likes: r.likesCount,
    comments: r.commentsCount,
    saves: r.savesCount,
    createdAt: r.createdAt.getTime(),
    ...extra,
  };
}
