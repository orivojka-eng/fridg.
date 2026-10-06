import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';

export const userInclude = {
  profile: true,
  foodProfile: { include: { allergies: true, dislikes: true, cuisines: true } },
  subscription: { select: { isActive: true, isTrial: true, status: true, productId: true, currentPeriodEnd: true, willRenew: true } },
  _count: { select: { saved: true, recipes: true, followers: true, following: true } },
} satisfies Prisma.UserInclude;

export type UserWithRelations = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export function serializeFoodProfile(fp: UserWithRelations['foodProfile']) {
  if (!fp) return null;
  return {
    mainGoal: fp.mainGoal ?? undefined,
    eatingStyle: fp.eatingStyle ?? undefined,
    allergies: fp.allergies.map((a) => a.allergen),
    dislikes: fp.dislikes.map((d) => d.food),
    cuisines: fp.cuisines.map((c) => c.cuisine),
    skill: fp.skill ?? undefined,
    cookTime: fp.cookTime ?? undefined,
    household: fp.household ?? undefined,
    priorities: fp.priorities,
    cravings: fp.cravings,
    adventurous: fp.adventurous ?? undefined,
    meals: fp.meals,
    frequency: fp.frequency ?? undefined,
    nutrition: fp.nutrition ?? undefined,
    become: fp.become ?? undefined,
    mood: fp.mood ?? undefined,
    other: (fp.otherAnswers as Record<string, string> | null) ?? {},
    updatedAt: fp.updatedAt,
  };
}

/** The shape the mobile app's `UserProfile` expects, plus account flags. */
export function serializeUser(u: UserWithRelations) {
  const p = u.profile;
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerified,
    firstName: u.firstName,
    lastName: u.lastName,
    name: `${u.firstName} ${u.lastName}`.trim(),
    handle: `@${u.handle}`,
    bio: p?.bio ?? '',
    age: p?.age ?? undefined,
    avatarIndex: p?.avatarIndex ?? 0,
    theme: p?.theme ?? 'light',
    household: p?.household ?? undefined,
    cookingTimeMin: p?.cookingTimeMin ?? 30,
    skillLevel: p?.skillLevel ?? undefined,
    equipment: p?.equipment ?? [],
    shoppingHabit: p?.shoppingHabit ?? undefined,
    recipeSources: p?.recipeSources ?? [],
    notifPrefs: { expiry: p?.notifExpiry ?? true, plan: p?.notifPlan ?? true, creators: p?.notifCreators ?? false },
    streakDays: p?.streakDays ?? 0,
    savedCount: u._count.saved,
    publishedCount: u._count.recipes,
    followersCount: u._count.followers,
    followingCount: u._count.following,
    hasOnboarded: !!p?.onboardedAt,
    isPremium: !!u.subscription?.isActive,
    subscription: u.subscription ?? null,
    foodProfile: serializeFoodProfile(u.foodProfile),
    createdAt: u.createdAt,
  };
}

export async function loadUser(id: string) {
  return prisma.user.findUniqueOrThrow({ where: { id }, include: userInclude });
}

export function serializePublicUser(u: { id: string; firstName: string; lastName: string; handle: string; profile: { bio: string | null; avatarIndex: number } | null; _count: { recipes: number; followers: number } }) {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName.charAt(0)}.`.trim(),
    handle: `@${u.handle}`,
    bio: u.profile?.bio ?? '',
    avatarIndex: u.profile?.avatarIndex ?? 0,
    publishedCount: u._count.recipes,
    followersCount: u._count.followers,
  };
}
