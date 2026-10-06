/* eslint-disable no-console */
/**
 * Test accounts (idempotent; run again any time to reset them):
 *   npm run db:demo
 *
 *   demo@fridgr.app  — set up, stocked fridge, shopping list, saved recipes, Premium ON
 *   new@fridgr.app   — confirmed email but never onboarded: shows onboarding + feature tour
 *
 * Both use the password in DEMO_PASSWORD (server/.env, never in source). Emails are already
 * confirmed, so no code is needed. Not for production: remove before launch
 * with `npm run db:demo -- --remove`.
 */
import 'dotenv/config';
import argon2 from 'argon2';
import { prisma } from '../src/db.js';
import { makeFoodResolver } from '../src/modules/foods/service.js';

const PASSWORD = process.env.DEMO_PASSWORD ?? '';
if (!PASSWORD) throw new Error('Set DEMO_PASSWORD in server/.env first.');
const DAY = 86_400_000;

type Cat = 'Protein' | 'Veg' | 'Dairy' | 'Pantry' | 'Produce';
const FRIDGE: Array<[string, Cat, number, string, number]> = [
  ['Chicken breast', 'Protein', 500, 'g', 2],
  ['Salmon fillets', 'Protein', 2, 'pcs', 1],
  ['Eggs', 'Protein', 10, 'pcs', 14],
  ['Greek yoghurt', 'Dairy', 500, 'g', 3],
  ['Feta cheese', 'Dairy', 200, 'g', 8],
  ['Spinach', 'Veg', 180, 'g', 1],
  ['Red peppers', 'Veg', 3, 'pcs', 4],
  ['Broccoli', 'Veg', 300, 'g', 3],
  ['Cherry tomatoes', 'Produce', 250, 'g', 5],
  ['Garlic', 'Produce', 1, 'pcs', 20],
  ['Lemon', 'Produce', 2, 'pcs', 12],
  ['Avocado', 'Produce', 2, 'pcs', 2],
  ['Brown rice', 'Pantry', 1000, 'g', 300],
  ['Pasta', 'Pantry', 500, 'g', 300],
  ['Chickpeas', 'Protein', 400, 'g', 300],
  ['Olive oil', 'Pantry', 500, 'ml', 200],
  ['Soy sauce', 'Pantry', 150, 'ml', 200],
];

async function upsertUser(opts: { email: string; first: string; last: string; handle: string; onboarded: boolean }) {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    create: { email: opts.email, emailVerified: true, name: `${opts.first} ${opts.last}`, firstName: opts.first, lastName: opts.last, handle: opts.handle },
    update: { emailVerified: true, name: `${opts.first} ${opts.last}`, firstName: opts.first, lastName: opts.last },
  });
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: user.id } },
    create: { accountId: user.id, providerId: 'credential', userId: user.id, password: passwordHash },
    update: { password: passwordHash },
  });
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, bio: opts.onboarded ? 'Testing every feature' : 'New in the kitchen', avatarIndex: opts.onboarded ? 2 : 0, onboardedAt: opts.onboarded ? new Date() : null, cookingTimeMin: 30, household: 'pair', streakDays: opts.onboarded ? 4 : 0 },
    update: { onboardedAt: opts.onboarded ? new Date() : null, streakDays: opts.onboarded ? 4 : 0 },
  });
  // Fresh start each run: sessions, fridge, lists, saves, notifications.
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.fridgeItem.deleteMany({ where: { userId: user.id } }),
    prisma.shoppingItem.deleteMany({ where: { list: { userId: user.id } } }),
    prisma.savedRecipe.deleteMany({ where: { userId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.aiUsageDay.deleteMany({ where: { userId: user.id } }),
    prisma.userAllergy.deleteMany({ where: { userId: user.id } }),
    prisma.userCuisine.deleteMany({ where: { userId: user.id } }),
  ]);
  await prisma.foodProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: { mainGoal: null, eatingStyle: null, skill: null, cookTime: null, priorities: [], cravings: [], meals: [] },
  });
  if (!(await prisma.shoppingList.findFirst({ where: { userId: user.id, isDefault: true } }))) {
    await prisma.shoppingList.create({ data: { userId: user.id, name: 'My list', isDefault: true } });
  }
  return user;
}

async function main() {
  if (process.argv.includes('--remove')) {
    const { count } = await prisma.user.deleteMany({ where: { email: { in: ['demo@fridgr.app', 'new@fridgr.app'] } } });
    console.log(`removed ${count} demo accounts`);
    return;
  }
  const resolve = await makeFoodResolver();

  /* ---- 1. fully set up, Premium */
  const demo = await upsertUser({ email: 'demo@fridgr.app', first: 'Dana', last: 'Demo', handle: 'danademo', onboarded: true });
  await prisma.foodProfile.update({
    where: { userId: demo.id },
    data: { mainGoal: 'fitness', eatingStyle: 'balanced', skill: 'home', cookTime: '30', household: 'pair', priorities: ['protein', 'quick'], cravings: ['spicy', 'fresh'], meals: ['dinner', 'lunch'], adventurous: 'medium', nutrition: 'high_protein' },
  });
  await prisma.userCuisine.createMany({ data: ['italian', 'japanese', 'levantine'].map((cuisine) => ({ userId: demo.id, cuisine, weight: 2 })) });
  for (const [name, category, quantity, unit, days] of FRIDGE) {
    await prisma.fridgeItem.create({ data: { userId: demo.id, foodId: resolve(name)?.id, name, category, quantity, unit, expiresAt: new Date(Date.now() + days * DAY) } });
  }
  const list = await prisma.shoppingList.findFirstOrThrow({ where: { userId: demo.id, isDefault: true } });
  for (const [name, category, amount, source, estPrice] of [
    ['Parmesan', 'PANTRY_SPICE', '1 block', 'For the pasta', 3.5],
    ['Fresh basil', 'PRODUCE', '1 bunch', 'Garnish', 1.2],
    ['Gochujang', 'PANTRY_SPICE', '1 tub', 'Missing • salmon bowl', 4.5],
  ] as const) {
    await prisma.shoppingItem.create({ data: { listId: list.id, foodId: resolve(name)?.id, name, category, amount, source, estPrice } });
  }
  const toSave = await prisma.recipe.findMany({ where: { visibility: 'public' }, orderBy: { likesCount: 'desc' }, take: 4, select: { id: true } });
  await prisma.savedRecipe.createMany({ data: toSave.map((r) => ({ userId: demo.id, recipeId: r.id })), skipDuplicates: true });
  await prisma.notification.createMany({
    data: [
      { userId: demo.id, kind: 'expiry', title: 'Salmon fillets expire tomorrow', body: 'Two recipes use them tonight — tap to see them.', link: '/recipe/results?use=Salmon%20fillets' },
      { userId: demo.id, kind: 'premium', title: 'Premium is on for testing', body: 'Unlimited AI recipes, imports and scans on this demo account.', link: '/(tabs)/profile' },
    ],
  });
  await prisma.subscription.upsert({
    where: { userId: demo.id },
    create: { userId: demo.id, rcAppUserId: `demo-${demo.id}`, status: 'active', productId: 'fridgr_premium_yearly', isActive: true, store: 'demo', currentPeriodEnd: new Date(Date.now() + 365 * DAY), willRenew: false },
    update: { status: 'active', isActive: true, currentPeriodEnd: new Date(Date.now() + 365 * DAY) },
  });

  /* ---- 2. brand new: onboarding + tour */
  const fresh = await upsertUser({ email: 'new@fridgr.app', first: 'Nico', last: 'New', handle: 'niconew', onboarded: false });
  await prisma.subscription.deleteMany({ where: { userId: fresh.id } });

  console.log('Demo accounts ready (password: DEMO_PASSWORD from server/.env)');
  console.log('  demo@fridgr.app  — set up, 17 fridge items, Premium on');
  console.log('  new@fridgr.app   — new user: onboarding + feature tour');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
