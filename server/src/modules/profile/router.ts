import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { authUser, requireAuth } from '../../middleware/auth.js';
import { body, wrap } from '../../middleware/validate.js';
import { loadUser, serializeFoodProfile, serializeUser } from '../users/serialize.js';

export const profileRouter = Router();

const str = z.string().trim().max(80);
const strList = z.array(str).max(40);

/* ------------------------------------------------------------------ profile (non-dietary preferences) */
profileRouter.get(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ user: serializeUser(await loadUser(authUser(req).id)) });
  }),
);

profileRouter.patch(
  '/',
  requireAuth,
  body(
    z.object({
      bio: z.string().trim().max(160).optional(),
      avatarIndex: z.number().int().min(0).max(11).optional(),
      age: z.number().int().min(13).max(120).nullable().optional(),
      theme: z.enum(['light', 'dark']).optional(),
      household: z.enum(['solo', 'pair', 'family', 'large', 'shared']).nullable().optional(),
      defaultServings: z.number().int().min(1).max(12).optional(),
      cookingTimeMin: z.number().int().min(5).max(240).optional(),
      skillLevel: z.enum(['beginner', 'home', 'confident', 'chef']).nullable().optional(),
      equipment: strList.optional(),
      shoppingHabit: z.enum(['weekly', 'often', 'asneeded']).nullable().optional(),
      recipeSources: strList.optional(),
      notifPrefs: z.object({ expiry: z.boolean(), plan: z.boolean(), creators: z.boolean() }).partial().optional(),
      onboarded: z.boolean().optional(),
    }),
  ),
  wrap(async (req, res) => {
    const { id } = authUser(req);
    const { notifPrefs, onboarded, ...rest } = req.body;
    await prisma.userProfile.upsert({
      where: { userId: id },
      create: { userId: id },
      update: {
        ...rest,
        ...(notifPrefs?.expiry !== undefined ? { notifExpiry: notifPrefs.expiry } : {}),
        ...(notifPrefs?.plan !== undefined ? { notifPlan: notifPrefs.plan } : {}),
        ...(notifPrefs?.creators !== undefined ? { notifCreators: notifPrefs.creators } : {}),
        ...(onboarded ? { onboardedAt: new Date() } : {}),
      },
    });
    res.json({ user: serializeUser(await loadUser(id)) });
  }),
);

/* ------------------------------------------------------------------ food profile (dietary, sensitive) */
export const foodProfileSchema = z.object({
  mainGoal: str.nullable().optional(),
  eatingStyle: str.nullable().optional(),
  allergies: strList.optional(),
  dislikes: strList.optional(),
  cuisines: strList.optional(),
  skill: str.nullable().optional(),
  cookTime: str.nullable().optional(),
  household: str.nullable().optional(),
  priorities: strList.optional(),
  cravings: strList.optional(),
  adventurous: str.nullable().optional(),
  meals: strList.optional(),
  frequency: str.nullable().optional(),
  nutrition: str.nullable().optional(),
  become: str.nullable().optional(),
  mood: str.nullable().optional(),
  other: z.record(z.string().max(300)).optional(),
});

export const foodProfileRouter = Router();

foodProfileRouter.get(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const u = await loadUser(authUser(req).id);
    res.json({ foodProfile: serializeFoodProfile(u.foodProfile) });
  }),
);

foodProfileRouter.put(
  '/',
  requireAuth,
  body(foodProfileSchema),
  wrap(async (req, res) => {
    const { id } = authUser(req);
    const { allergies, dislikes, cuisines, other, ...scalars } = req.body as z.infer<typeof foodProfileSchema>;
    await prisma.$transaction(async (tx) => {
      await tx.foodProfile.upsert({
        where: { userId: id },
        create: { userId: id, ...scalars, otherAnswers: other },
        update: { ...scalars, ...(other ? { otherAnswers: other } : {}), version: { increment: 1 } },
      });
      if (allergies) {
        await tx.userAllergy.deleteMany({ where: { userId: id } });
        if (allergies.length) await tx.userAllergy.createMany({ data: allergies.map((allergen) => ({ userId: id, allergen: allergen.toLowerCase() })), skipDuplicates: true });
      }
      if (dislikes) {
        await tx.userDislike.deleteMany({ where: { userId: id } });
        if (dislikes.length) await tx.userDislike.createMany({ data: dislikes.map((food) => ({ userId: id, food: food.toLowerCase() })), skipDuplicates: true });
      }
      if (cuisines) {
        const existing = await tx.userCuisine.findMany({ where: { userId: id } });
        const keep = new Set(cuisines.map((c) => c.toLowerCase()));
        await tx.userCuisine.deleteMany({ where: { userId: id, cuisine: { notIn: [...keep] } } });
        const have = new Set(existing.map((e) => e.cuisine));
        const fresh = [...keep].filter((c) => !have.has(c));
        if (fresh.length) await tx.userCuisine.createMany({ data: fresh.map((cuisine) => ({ userId: id, cuisine })), skipDuplicates: true });
      }
    });
    const u = await loadUser(id);
    res.json({ foodProfile: serializeFoodProfile(u.foodProfile), user: serializeUser(u) });
  }),
);

/* ------------------------------------------------------------------ behaviour signals */
const signalKinds = ['viewed', 'saved', 'unsaved', 'cooked', 'skipped', 'rated', 'liked', 'searched', 'ingredient_used', 'ingredient_rejected'] as const;

foodProfileRouter.post(
  '/signals',
  requireAuth,
  body(
    z.object({
      signals: z
        .array(z.object({ kind: z.enum(signalKinds), recipeId: z.string().uuid().optional(), foodId: z.string().uuid().optional(), cuisine: str.optional(), value: z.number().optional() }))
        .min(1)
        .max(50),
    }),
  ),
  wrap(async (req, res) => {
    const { id } = authUser(req);
    const signals = req.body.signals as Array<{ kind: (typeof signalKinds)[number]; recipeId?: string; foodId?: string; cuisine?: string; value?: number }>;
    await prisma.userSignal.createMany({ data: signals.map((s) => ({ userId: id, ...s, cuisine: s.cuisine?.toLowerCase() })) });
    // Cuisine weight grows with positive behaviour so ranking follows what the user actually cooks.
    const positive = signals.filter((s) => s.cuisine && ['saved', 'cooked', 'liked', 'rated'].includes(s.kind));
    for (const s of positive) {
      await prisma.userCuisine.upsert({
        where: { userId_cuisine: { userId: id, cuisine: s.cuisine! } },
        create: { userId: id, cuisine: s.cuisine!, weight: 1 },
        update: { weight: { increment: s.kind === 'cooked' ? 2 : 1 } },
      });
    }
    res.status(202).json({ ok: true });
  }),
);
