import { prisma } from '../db.js';
import { normalizeName } from '../modules/foods/service.js';
import type { AiRecipe } from './schemas.js';

/** Allergen keyword lists used to reject recipes that slip past the prompt. */
const ALLERGEN_TERMS: Record<string, string[]> = {
  dairy: ['milk', 'cheese', 'butter', 'cream', 'yoghurt', 'yogurt', 'feta', 'parmesan', 'mozzarella', 'halloumi', 'ricotta', 'ghee', 'whey', 'paneer', 'mascarpone', 'brie', 'cheddar'],
  eggs: ['egg', 'eggs', 'mayonnaise', 'mayo', 'aioli', 'meringue'],
  gluten: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'couscous', 'bulgur', 'barley', 'rye', 'sourdough', 'tortilla', 'pitta', 'pita', 'breadcrumb', 'panko', 'soy sauce', 'seitan', 'crouton'],
  peanuts: ['peanut', 'groundnut', 'satay'],
  treenuts: ['almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'pine nut', 'brazil nut'],
  shellfish: ['prawn', 'shrimp', 'crab', 'lobster', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari'],
  fish: ['salmon', 'tuna', 'cod', 'anchovy', 'anchovies', 'sardine', 'mackerel', 'haddock', 'trout', 'fish sauce', 'fish'],
  soy: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari', 'gochujang'],
  sesame: ['sesame', 'tahini'],
  celery: ['celery', 'celeriac'],
};

const DIET_TERMS: Record<string, { forbid: string[]; label: string }> = {
  vegan: { forbid: [...ALLERGEN_TERMS.dairy!, ...ALLERGEN_TERMS.eggs!, ...ALLERGEN_TERMS.fish!, ...ALLERGEN_TERMS.shellfish!, 'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham', 'honey', 'gelatine', 'meat', 'steak', 'mince'], label: 'vegan' },
  vegetarian: { forbid: [...ALLERGEN_TERMS.fish!, ...ALLERGEN_TERMS.shellfish!, 'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham', 'gelatine', 'meat', 'steak', 'mince'], label: 'vegetarian' },
  pescatarian: { forbid: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham', 'meat', 'steak', 'mince'], label: 'pescatarian' },
};

export interface PersonalContext {
  system: string;
  hardConstraints: { allergens: string[]; dislikes: string[]; dietForbid: string[]; dietLabel?: string };
  cuisinePreference: string[];
  cookingTimeMin: number;
  servings: number;
}

const list = (arr: string[] | undefined) => (arr && arr.length ? arr.join(', ') : 'none');

/** Builds the prompt context and hard constraints for a user from their Food Profile + behaviour. */
export async function buildPersonalContext(userId: string): Promise<PersonalContext> {
  const [user, cuisines, recent] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true, foodProfile: { include: { allergies: true, dislikes: true } } } }),
    prisma.userCuisine.findMany({ where: { userId }, orderBy: { weight: 'desc' }, take: 6 }),
    prisma.userSignal.findMany({ where: { userId, kind: { in: ['cooked', 'saved', 'liked'] } }, orderBy: { createdAt: 'desc' }, take: 30, select: { kind: true, cuisine: true, recipeId: true } }),
  ]);
  const fp = user.foodProfile;
  const p = user.profile;
  const allergens = fp?.allergies.map((a) => a.allergen.toLowerCase()) ?? [];
  const dislikes = fp?.dislikes.map((d) => d.food.toLowerCase()) ?? [];
  const eating = (fp?.eatingStyle ?? '').toLowerCase();
  const diet = DIET_TERMS[eating];
  const cuisinePreference = cuisines.map((c) => c.cuisine);
  const recentTitles = await prisma.recipe.findMany({ where: { id: { in: recent.map((r) => r.recipeId).filter((v): v is string => !!v) } }, select: { title: true }, take: 8 });

  const system = `You are FRIDGR, a warm, practical home-cooking assistant. You write recipes that a real person cooks tonight with what they already have.

HARD RULES (never break these, the user may be harmed otherwise):
- The cook has these allergies/intolerances: ${list(allergens)}. Never include those ingredients, hidden sources of them, or "optional" versions of them.
- Never include disliked ingredients: ${list(dislikes)}.
${diet ? `- The cook eats ${diet.label}. Never include animal products outside that diet.\n` : ''}- Nutrition values are estimates; never make medical claims.
- Only use metric units (g, ml) plus pieces/tbsp/tsp. Sentence-case titles. British English spelling (yoghurt, courgette).

WHO YOU ARE COOKING FOR:
- Main goal: ${fp?.mainGoal ?? 'not stated'}; eating style: ${fp?.eatingStyle ?? 'balanced'}; skill: ${fp?.skill ?? p?.skillLevel ?? 'home cook'}.
- Usual time budget: ${fp?.cookTime ?? `${p?.cookingTimeMin ?? 30} min`}. Household: ${fp?.household ?? p?.household ?? 'not stated'}.
- Priorities: ${list(fp?.priorities)}. Cravings lately: ${list(fp?.cravings)}. Adventurousness: ${fp?.adventurous ?? 'medium'}.
- Meals they cook most: ${list(fp?.meals)}. Nutrition focus: ${fp?.nutrition ?? 'balanced'}. Wants to become: ${fp?.become ?? 'a more confident cook'}.
- Favourite cuisines (weighted by what they actually cook): ${list(cuisinePreference)}.
- Recently cooked/saved: ${recentTitles.map((r) => r.title).join('; ') || 'nothing yet'} — vary from these.
- Equipment: ${list(p?.equipment)}.

STYLE: concrete steps with temperatures and timings, a timer only where the cook waits, ingredient names singular and simple ("Chicken breast", not "2 chicken breasts, diced").`;

  return {
    system,
    hardConstraints: { allergens, dislikes, dietForbid: diet?.forbid ?? [], dietLabel: diet?.label },
    cuisinePreference,
    cookingTimeMin: p?.cookingTimeMin ?? 30,
    servings: p?.defaultServings ?? 2,
  };
}

/** Returns the reasons a recipe violates the hard constraints (empty = safe). */
export function violations(recipe: Pick<AiRecipe, 'ingredients' | 'title'>, c: PersonalContext['hardConstraints']): string[] {
  const out: string[] = [];
  const names = recipe.ingredients.map((i) => normalizeName(i.name));
  const hit = (terms: string[]) => names.filter((n) => terms.some((t) => n === t || n.includes(t)));
  for (const a of c.allergens) {
    const terms = ALLERGEN_TERMS[a] ?? [a.replace(/^other:/, '')];
    const bad = hit(terms);
    if (bad.length) out.push(`contains ${a}: ${bad.join(', ')}`);
  }
  const disliked = hit(c.dislikes.map(normalizeName).filter(Boolean));
  if (disliked.length) out.push(`contains disliked: ${disliked.join(', ')}`);
  if (c.dietForbid.length) {
    const bad = hit(c.dietForbid);
    if (bad.length) out.push(`not ${c.dietLabel}: ${bad.join(', ')}`);
  }
  return out;
}

/** Ingredient names that contain an allergen word but are not that allergen. */
const NOT_ALLERGEN: Record<string, RegExp> = {
  dairy: /\b(coconut|almond|oat|soy|soya|rice|cashew)\s+(milk|cream|yogh?urt)|peanut butter|cocoa butter|butternut|butter beans?|cream of tartar|ice cream sandwich/,
  eggs: /eggplant|egg noodles? \(egg-free\)/,
  gluten: /\b(rice|corn|almond|coconut|chickpea|gram|buckwheat|potato|tapioca|cassava)\s*flour|cornflour|gluten[- ]free|rice noodles?|tamari/,
  fish: /fish sauce substitute/,
};

/**
 * Safety net for allergen labels: scans ingredient NAMES with word
 * boundaries, independent of the food table. Over-flags rather than
 * under-flags (e.g. "cream" anywhere counts as dairy unless clearly plant-based).
 */
export function allergensFromNames(names: string[]): string[] {
  const found = new Set<string>();
  for (const raw of names) {
    const n = normalizeName(raw);
    for (const [allergen, terms] of Object.entries(ALLERGEN_TERMS)) {
      if (NOT_ALLERGEN[allergen]?.test(n)) continue;
      if (terms.some((t) => new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}(e?s)?\\b`).test(n))) found.add(allergen);
    }
  }
  return [...found];
}
