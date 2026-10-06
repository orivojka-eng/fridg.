import { create } from 'zustand';
import { Recipe, Collection, FridgeItem, RecipeEffort, RecipeStyle } from '../types';
import { computeMatch, normalize, slugify } from "../lib/matching";
import { useUserStore } from "./useUserStore";
import { env } from '../config/env';
import { recipesApi, isServerId, type ServerRecipe } from '../api/recipes';

export interface GenerationRequest {
  prompt: string;
  ingredientNames: string[];
  servings: number;
  effort: RecipeEffort;
  style: RecipeStyle;
}

export interface GenerationResult extends GenerationRequest {
  recipeIds: string[];
  generatedAt: number;
}

interface RecipeState {
  recipes: Recipe[];
  collections: Collection[];
  savedRecipeIds: string[];
  likedRecipeIds: string[];
  madeRecipeIds: string[];
  followedAuthors: string[];
  ratings: Record<string, number>;
  generatorServings: number;
  generatorEffort: RecipeEffort;
  generatorStyle: RecipeStyle;
  selectedGeneratorIngredients: string[];
  lastGeneration: GenerationResult | null;
  /** Server user ids the user follows (backend mode); `followedAuthors` keeps the names the UI shows. */
  followedAuthorIds: string[];
  hydrated: boolean;
  /** Load catalogue, saved, likes, collections and follows from the API (backend mode). */
  hydrate: () => Promise<void>;
  /** Merge server recipes into the catalogue and sync per-user flags. */
  upsertServerRecipes: (recipes: ServerRecipe[]) => void;
  /** Real generation through the API (backend) or the local ranker (mock). Resolves with the result. */
  generateRecipesAsync: (request: GenerationRequest, fridge: FridgeItem[]) => Promise<GenerationResult>;
  /** Creates a recipe (POST in backend mode). */
  createRecipeAsync: (recipe: Omit<Recipe, 'id' | 'createdAt'>) => Promise<Recipe>;
  /** Finds or creates a collection by title (POST in backend mode). */
  ensureCollection: (title: string, tagline?: string) => Promise<Collection>;

  getRecipeById: (id: string) => Recipe | undefined;
  addRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt'>) => Recipe;
  toggleSaveRecipe: (id: string) => void;
  toggleLikeRecipe: (id: string) => void;
  toggleFollowAuthor: (author: string) => void;
  markMade: (id: string, rating?: number) => void;
  addCollection: (title: string, tagline?: string) => Collection;
  addRecipeToCollection: (collectionId: string, recipeId: string) => void;
  setGeneratorServings: (servings: number) => void;
  setGeneratorEffort: (effort: RecipeEffort) => void;
  setGeneratorStyle: (style: RecipeStyle) => void;
  setGeneratorIngredients: (names: string[]) => void;
  toggleGeneratorIngredient: (ingredient: string) => void;
  /** Ranks the catalogue against the request and stores the result for the results screen. */
  generateRecipes: (request: GenerationRequest, fridge: FridgeItem[]) => GenerationResult;
  /** Drop saved/liked/made/followed state but keep the catalogue (new account). */
  resetUserData: () => void;
}

const mockRecipes: Recipe[] = [
  {
    id: 'r1',
    title: 'Harissa chicken & charred pepper bowl',
    description: 'The bowl that got me through marathon training. Charring the peppers is the whole trick.',
    imageKey: 'harissa-bowl.jpg',
    imageUrl: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=900&q=80',
    tone: 'cream',
    prepTimeMin: 25,
    calories: 540,
    proteinG: 42,
    carbsG: 38,
    fatG: 21,
    servings: 2,
    authorName: 'Nadia Benali',
    authorHandle: '@nadiacooks',
    authorTag: 'Levantine • 41k followers',
    authorRating: '4.8 ★ (312)',
    effort: 'Easy',
    style: 'Bowl',
    cuisine: 'Levantine',
    likes: 1200,
    comments: 184,
    ingredients: [
      { id: 'i1', name: 'Chicken breast', amount: '450 g' },
      { id: 'i2', name: 'Red peppers', amount: '3 pcs' },
      { id: 'i3', name: 'Brown rice', amount: '200 g' },
      { id: 'i4', name: 'Greek yoghurt', amount: '4 tbsp' },
      { id: 'i5', name: 'Spring onion', amount: '2 stalks' },
      { id: 'i6', name: 'Olive oil', amount: '2 tbsp' },
      { id: 'i7', name: 'Garlic', amount: '3 cloves' },
      { id: 'i8', name: 'Harissa paste', amount: '2 tbsp' },
      { id: 'i9', name: 'Lemon', amount: '1 pc' },
    ],
    steps: [
      { stepNumber: 1, phase: 'PREP', instruction: 'Pat the chicken dry, then rub with harissa, oil and salt. Let it sit while the pan heats.', ingredients: ['Chicken breast', 'Harissa', 'Olive oil'] },
      { stepNumber: 2, phase: 'SEAR', instruction: 'Sear the chicken 4 minutes a side in a hot dry pan until deeply coloured. Don\'t move it around.', timerSec: 240, ingredients: ['Chicken breast'] },
      { stepNumber: 3, phase: 'CHAR', instruction: 'Add the peppers cut-side down. Char hard for 5 minutes until blistered at the edges.', timerSec: 300, ingredients: ['Red peppers'] },
      { stepNumber: 4, phase: 'RICE', instruction: 'Warm the rice through with lemon zest and a splash of the pan juices.', ingredients: ['Brown rice', 'Lemon'] },
      { stepNumber: 5, phase: 'REST', instruction: 'Rest the chicken 3 minutes, then slice thick against the grain.', timerSec: 180, ingredients: ['Chicken breast'] },
      { stepNumber: 6, phase: 'PLATE', instruction: 'Build the bowl: rice, peppers, chicken, yoghurt, spring onion. Squeeze over lemon.', ingredients: ['Greek yoghurt', 'Spring onion'] },
    ],
  },
  {
    id: 'r2',
    title: 'Ten-minute yoghurt chilli eggs',
    description: 'Turkish-style eggs on garlicky yoghurt. The whole thing is faster than toast.',
    imageKey: 'chilli-eggs.jpg',
    imageUrl: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=900&q=80',
    tone: 'cream',
    prepTimeMin: 10,
    calories: 380,
    proteinG: 26,
    carbsG: 14,
    fatG: 22,
    servings: 1,
    authorName: 'Sofia Marchetti',
    authorHandle: '@sofiacooks',
    authorTag: 'Fitness-focused foodie',
    authorRating: '4.6 ★ (98)',
    effort: 'Easy',
    style: 'Bowl',
    cuisine: 'Turkish',
    likes: 640,
    comments: 52,
    ingredients: [
      { id: 'i20', name: 'Eggs', amount: '3 pcs' },
      { id: 'i21', name: 'Greek yoghurt', amount: '150 g' },
      { id: 'i22', name: 'Garlic', amount: '1 clove' },
      { id: 'i23', name: 'Olive oil', amount: '1 tbsp' },
      { id: 'i24', name: 'Sourdough', amount: '2 slices', isOptional: true },
    ],
    steps: [
      { stepNumber: 1, phase: 'PREP', instruction: 'Grate the garlic into the yoghurt with a pinch of salt and spread it over a warm plate.', ingredients: ['Greek yoghurt', 'Garlic'] },
      { stepNumber: 2, phase: 'FRY', instruction: 'Fry the eggs in hot oil until the edges are crisp and lacy but the yolks still run.', timerSec: 180, ingredients: ['Eggs', 'Olive oil'] },
      { stepNumber: 3, phase: 'SIZZLE', instruction: 'Warm the remaining oil with a big pinch of chilli flakes for 30 seconds.', timerSec: 30, ingredients: ['Olive oil'] },
      { stepNumber: 4, phase: 'PLATE', instruction: 'Slide the eggs onto the yoghurt, spoon over the chilli oil and eat with toasted sourdough.', ingredients: ['Eggs', 'Sourdough'] },
    ],
  },
  {
    id: 'r3',
    title: 'Spinach, feta & lemon rice',
    description: 'A one-pan Greek spanakorizo. Wilts a whole bag of spinach into something you actually want to eat.',
    imageKey: 'lemon-rice.jpg',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&q=80',
    tone: 'sage',
    prepTimeMin: 30,
    calories: 470,
    proteinG: 19,
    carbsG: 52,
    fatG: 18,
    servings: 2,
    authorName: 'Eleni Papadakis',
    authorHandle: '@elenieats',
    authorTag: 'Greek home cooking',
    authorRating: '4.7 ★ (140)',
    effort: 'Easy',
    style: 'Traybake',
    cuisine: 'Greek',
    likes: 410,
    comments: 37,
    ingredients: [
      { id: 'i30', name: 'Spinach', amount: '180 g' },
      { id: 'i31', name: 'Feta cheese', amount: '150 g' },
      { id: 'i32', name: 'Brown rice', amount: '200 g' },
      { id: 'i33', name: 'Spring onion', amount: '3 stalks' },
      { id: 'i34', name: 'Garlic', amount: '2 cloves' },
      { id: 'i35', name: 'Olive oil', amount: '3 tbsp' },
      { id: 'i36', name: 'Lemon', amount: '1 pc' },
    ],
    steps: [
      { stepNumber: 1, phase: 'SOFTEN', instruction: 'Soften the spring onion and garlic in olive oil over a low heat for 3 minutes.', timerSec: 180, ingredients: ['Spring onion', 'Garlic', 'Olive oil'] },
      { stepNumber: 2, phase: 'TOAST', instruction: 'Stir in the rice and toast it for a minute so every grain is coated.', timerSec: 60, ingredients: ['Brown rice'] },
      { stepNumber: 3, phase: 'SIMMER', instruction: 'Add 500 ml of water and a pinch of salt. Cover and simmer for 20 minutes.', timerSec: 1200, ingredients: ['Brown rice'] },
      { stepNumber: 4, phase: 'WILT', instruction: 'Fold in the spinach in handfuls until it collapses, then rest off the heat for 5 minutes.', timerSec: 300, ingredients: ['Spinach'] },
      { stepNumber: 5, phase: 'PLATE', instruction: 'Crumble over the feta, add lemon zest and juice, and a final glug of oil.', ingredients: ['Feta cheese', 'Lemon'] },
    ],
  },
  {
    id: 'r4',
    title: 'Crispy chickpea power salad',
    description: 'Roasted chickpeas add the crunch; the feta and peppers do the rest.',
    imageKey: 'chickpea-salad.jpg',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&q=80',
    tone: 'sage',
    prepTimeMin: 15,
    calories: 410,
    proteinG: 22,
    carbsG: 45,
    fatG: 14,
    servings: 2,
    authorName: 'Nadia Benali',
    authorHandle: '@nadiacooks',
    authorTag: 'Levantine • 41k followers',
    authorRating: '4.5 ★ (77)',
    effort: 'Easy',
    style: 'Salad',
    cuisine: 'Levantine',
    likes: 880,
    comments: 61,
    ingredients: [
      { id: 'i40', name: 'Chickpeas', amount: '400 g tin' },
      { id: 'i41', name: 'Cherry tomatoes', amount: '250 g' },
      { id: 'i42', name: 'Spinach', amount: '100 g' },
      { id: 'i43', name: 'Red peppers', amount: '1 pc' },
      { id: 'i44', name: 'Feta cheese', amount: '80 g' },
      { id: 'i45', name: 'Olive oil', amount: '2 tbsp' },
      { id: 'i46', name: 'Garlic', amount: '1 clove' },
    ],
    steps: [
      { stepNumber: 1, phase: 'ROAST', instruction: 'Dry the chickpeas well, toss with oil, salt and paprika, and roast at 220°C for 12 minutes until crisp.', timerSec: 720, ingredients: ['Chickpeas', 'Olive oil'] },
      { stepNumber: 2, phase: 'CHOP', instruction: 'Halve the tomatoes and dice the pepper while the chickpeas roast.', ingredients: ['Cherry tomatoes', 'Red peppers'] },
      { stepNumber: 3, phase: 'DRESS', instruction: 'Whisk the grated garlic with oil, lemon and salt for a sharp dressing.', ingredients: ['Garlic', 'Olive oil'] },
      { stepNumber: 4, phase: 'PLATE', instruction: 'Toss the spinach with the dressing, pile on the veg, chickpeas and crumbled feta.', ingredients: ['Spinach', 'Feta cheese'] },
    ],
  },
  {
    id: 'r5',
    title: 'Miso butter salmon traybake',
    description: 'Everything on one tray. The miso butter does all the work.',
    imageKey: 'miso-salmon.jpg',
    imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=900&q=80',
    tone: 'blush',
    prepTimeMin: 28,
    calories: 610,
    proteinG: 45,
    carbsG: 20,
    fatG: 34,
    servings: 2,
    authorName: 'Sam Okafor',
    authorHandle: '@kitchenbysam',
    authorTag: 'Imported from TikTok • 2.1M views',
    authorRating: '4.9 ★ (508)',
    importedFrom: 'TikTok',
    viewsCount: '2.1M views',
    effort: 'Cheffy',
    style: 'Traybake',
    cuisine: 'Japanese',
    likes: 2300,
    comments: 240,
    ingredients: [
      { id: 'i50', name: 'Salmon fillets', amount: '2 pcs' },
      { id: 'i51', name: 'Miso', amount: '1 tbsp' },
      { id: 'i52', name: 'Butter', amount: '30 g' },
      { id: 'i53', name: 'Red peppers', amount: '2 pcs' },
      { id: 'i54', name: 'Spring onion', amount: '3 stalks' },
      { id: 'i55', name: 'Brown rice', amount: '200 g' },
      { id: 'i56', name: 'Garlic', amount: '2 cloves' },
    ],
    steps: [
      { stepNumber: 1, phase: 'MIX', instruction: 'Mash the miso into the soft butter with the grated garlic.', ingredients: ['Miso', 'Butter', 'Garlic'] },
      { stepNumber: 2, phase: 'TRAY', instruction: 'Spread the peppers over a tray, sit the salmon on top and dot everything with miso butter.', ingredients: ['Red peppers', 'Salmon fillets'] },
      { stepNumber: 3, phase: 'ROAST', instruction: 'Roast at 200°C for 14 minutes until the salmon flakes and the butter has bubbled.', timerSec: 840, ingredients: ['Salmon fillets'] },
      { stepNumber: 4, phase: 'PLATE', instruction: 'Serve over rice with the tray juices and a shower of spring onion.', ingredients: ['Brown rice', 'Spring onion'] },
    ],
  },
  {
    id: 'r6',
    title: 'Tomato & white bean braise',
    description: 'Beans, tomatoes and garlic cooked down into something you mop up with sourdough.',
    imageKey: 'bean-braise.jpg',
    imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=900&q=80',
    tone: 'blush',
    prepTimeMin: 22,
    calories: 360,
    proteinG: 18,
    carbsG: 48,
    fatG: 10,
    servings: 2,
    authorName: 'Eleni Papadakis',
    authorHandle: '@elenieats',
    authorTag: 'Greek home cooking',
    authorRating: '4.4 ★ (63)',
    effort: 'Easy',
    style: 'Bowl',
    cuisine: 'Italian',
    likes: 350,
    comments: 24,
    ingredients: [
      { id: 'i60', name: 'Cherry tomatoes', amount: '250 g' },
      { id: 'i61', name: 'White beans', amount: '400 g tin' },
      { id: 'i62', name: 'Garlic', amount: '3 cloves' },
      { id: 'i63', name: 'Olive oil', amount: '3 tbsp' },
      { id: 'i64', name: 'Spinach', amount: '80 g' },
      { id: 'i65', name: 'Sourdough', amount: '2 slices' },
    ],
    steps: [
      { stepNumber: 1, phase: 'SIZZLE', instruction: 'Slice the garlic and fry gently in the oil until golden at the edges.', timerSec: 120, ingredients: ['Garlic', 'Olive oil'] },
      { stepNumber: 2, phase: 'BURST', instruction: 'Add the tomatoes and cook until they burst and turn jammy, about 8 minutes.', timerSec: 480, ingredients: ['Cherry tomatoes'] },
      { stepNumber: 3, phase: 'BRAISE', instruction: 'Tip in the beans with their liquid, season, and simmer 6 minutes.', timerSec: 360, ingredients: ['White beans'] },
      { stepNumber: 4, phase: 'PLATE', instruction: 'Wilt in the spinach and serve with toasted sourdough rubbed with garlic.', ingredients: ['Spinach', 'Sourdough'] },
    ],
  },
  {
    id: 'r7',
    title: 'Crispy gochujang salmon rice bowl',
    description: 'Crispy-skinned salmon glazed in gochujang over rice with a jammy egg.',
    imageKey: 'gochujang-salmon.jpg',
    imageUrl: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=900&q=80',
    tone: 'cream',
    prepTimeMin: 24,
    calories: 640,
    proteinG: 41,
    carbsG: 58,
    fatG: 24,
    servings: 2,
    authorName: 'Sam Okafor',
    authorHandle: '@kitchenbysam',
    authorTag: 'Imported from TikTok • 2.1M views',
    authorRating: '4.9 ★ (1.2k)',
    importedFrom: 'TikTok',
    sourceUrl: 'https://tiktok.com/@kitchenbysam/video/7421',
    viewsCount: '2.1M views',
    effort: 'Medium',
    style: 'Bowl',
    cuisine: 'Korean',
    likes: 3100,
    comments: 412,
    ingredients: [
      { id: 'i70', name: 'Salmon fillets', amount: '2 pcs' },
      { id: 'i71', name: 'Brown rice', amount: '300 g' },
      { id: 'i72', name: 'Gochujang', amount: '2 tbsp' },
      { id: 'i73', name: 'Mirin', amount: '1 tbsp' },
      { id: 'i74', name: 'Spring onion', amount: '3 stalks' },
      { id: 'i75', name: 'Sesame oil', amount: '1 tsp' },
      { id: 'i76', name: 'Eggs', amount: '2 pcs' },
      { id: 'i77', name: 'Garlic', amount: '2 cloves' },
      { id: 'i78', name: 'Olive oil', amount: '1 tbsp' },
    ],
    steps: [
      { stepNumber: 1, phase: 'GLAZE', instruction: 'Whisk the gochujang, mirin, sesame oil and grated garlic into a glossy glaze.', ingredients: ['Gochujang', 'Mirin', 'Sesame oil', 'Garlic'] },
      { stepNumber: 2, phase: 'EGGS', instruction: 'Lower the eggs into boiling water for 7 minutes, then straight into cold water.', timerSec: 420, ingredients: ['Eggs'] },
      { stepNumber: 3, phase: 'SEAR', instruction: 'Salmon skin-side down in a hot oiled pan. Press flat and leave it for 4 minutes until the skin is shatteringly crisp.', timerSec: 240, ingredients: ['Salmon fillets', 'Olive oil'] },
      { stepNumber: 4, phase: 'FLIP', instruction: 'Flip, brush on the glaze and cook 2 more minutes until sticky.', timerSec: 120, ingredients: ['Salmon fillets'] },
      { stepNumber: 5, phase: 'RICE', instruction: 'Fluff the rice with a splash of the leftover glaze.', ingredients: ['Brown rice'] },
      { stepNumber: 6, phase: 'PLATE', instruction: 'Rice, salmon, halved egg, spring onion. Spoon over any glaze left in the pan.', ingredients: ['Spring onion', 'Eggs'] },
    ],
  },
];

const mockCollections: Collection[] = [
  { id: 'c1', title: 'Weeknight 20s', tagline: 'fast and forgiving', recipeIds: ['r2', 'r4', 'r6'] },
  { id: 'c2', title: 'High-protein dinners', tagline: '40g+ each', recipeIds: ['r1', 'r5', 'r7'] },
  { id: 'c3', title: 'Imported from TikTok', tagline: 'auto-extracted', recipeIds: ['r5'] },
  { id: 'c4', title: 'Sunday meal prep', tagline: 'cook once, eat five', recipeIds: ['r3', 'r6'] },
];

let recipeCounter = 100;
let collectionCounter = 100;

/** Simple keyword extraction so the prompt actually influences the ranking. */
const scoreRecipe = (recipe: Recipe, request: GenerationRequest, fridge: FridgeItem[]): number => {
  const selected = fridge.filter((f) => request.ingredientNames.includes(f.name));
  const pool = selected.length > 0 ? selected : fridge;
  const match = computeMatch(recipe, pool);
  let score = match.matchPercent;

  if (recipe.style === request.style) score += 15;
  if (recipe.effort === request.effort) score += 10;
  else if (request.effort === 'Easy' && recipe.effort === 'Cheffy') score -= 10;

  const prompt = normalize(request.prompt);
  if (prompt) {
    if (/protein/.test(prompt)) score += recipe.proteinG / 2;
    if (/(quick|fast|20 minutes|under 20|minutes)/.test(prompt)) score += recipe.prepTimeMin <= 20 ? 20 : -10;
    if (/(light|low cal)/.test(prompt)) score += recipe.calories <= 420 ? 15 : 0;
    // Ingredient mentioned in the prompt ("use up my spinach").
    recipe.ingredients.forEach((ing) => {
      const key = normalize(ing.name).split(' ').pop() || '';
      if (key.length > 3 && prompt.includes(key)) score += 25;
    });
  }
  return score;
};

const backend = () => env.USE_BACKEND;

/** Strip server-only flags so the catalogue keeps the app's `Recipe` shape. */
const toRecipe = (r: ServerRecipe): Recipe => {
  const { isSaved: _s, isLiked: _l, myRating: _r, matchPercent: _m, missingCount: _mc, ...rest } = r;
  return rest;
};

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: backend() ? [] : mockRecipes,
  collections: backend() ? [] : mockCollections,
  savedRecipeIds: backend() ? [] : ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'],
  likedRecipeIds: backend() ? [] : ['r1'],
  madeRecipeIds: backend() ? [] : ['r1', 'r2'],
  followedAuthors: backend() ? [] : ['Nadia Benali', 'Sam Okafor'],
  followedAuthorIds: [],
  ratings: {},
  hydrated: !backend(),

  upsertServerRecipes: (incoming) =>
    set((state) => {
      const byId = new Map(state.recipes.map((r) => [r.id, r]));
      incoming.forEach((r) => byId.set(r.id, { ...byId.get(r.id), ...toRecipe(r) }));
      const saved = new Set(state.savedRecipeIds);
      const liked = new Set(state.likedRecipeIds);
      const ratings = { ...state.ratings };
      incoming.forEach((r) => {
        if (r.isSaved !== undefined) (r.isSaved ? saved.add(r.id) : saved.delete(r.id));
        if (r.isLiked !== undefined) (r.isLiked ? liked.add(r.id) : liked.delete(r.id));
        if (r.myRating) ratings[r.id] = r.myRating;
      });
      return { recipes: [...byId.values()], savedRecipeIds: [...saved], likedRecipeIds: [...liked], ratings };
    }),

  hydrate: async () => {
    if (!backend()) return;
    const [catalog, saved, mine, collections, followingIds] = await Promise.all([
      recipesApi.catalog().then((r) => r.recipes),
      recipesApi.saved(),
      recipesApi.mine(),
      recipesApi.collections(),
      recipesApi.following().catch(() => [] as string[]),
    ]);
    const all = [...catalog, ...saved, ...mine];
    const names = new Set<string>();
    all.forEach((r) => {
      if (r.authorId && followingIds.includes(r.authorId) && r.authorName) names.add(r.authorName);
    });
    set({ savedRecipeIds: saved.map((r) => r.id), collections, followedAuthorIds: followingIds, followedAuthors: [...names], madeRecipeIds: all.filter((r) => r.myRating).map((r) => r.id), hydrated: true });
    get().upsertServerRecipes(all);
  },

  generateRecipesAsync: async (request, fridge) => {
    if (!backend()) return get().generateRecipes(request, fridge);
    const recipes = await recipesApi.generate({ prompt: request.prompt, ingredientNames: request.ingredientNames, servings: request.servings, effort: request.effort, style: request.style });
    get().upsertServerRecipes(recipes);
    const result: GenerationResult = { ...request, recipeIds: recipes.map((r) => r.id), generatedAt: Date.now() };
    set({ lastGeneration: result });
    return result;
  },

  createRecipeAsync: async (recipe) => {
    if (!backend()) return get().addRecipe(recipe);
    const created = await recipesApi.create({
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      tone: recipe.tone,
      cuisine: recipe.cuisine,
      effort: recipe.effort ?? 'Easy',
      style: recipe.style,
      prepTimeMin: recipe.prepTimeMin,
      servings: recipe.servings ?? 2,
      kcal: recipe.calories || undefined,
      proteinG: recipe.proteinG || undefined,
      carbsG: recipe.carbsG || undefined,
      fatG: recipe.fatG || undefined,
      ingredients: recipe.ingredients.map((i) => ({ name: i.name, amount: i.amount, isOptional: !!i.isOptional })),
      steps: recipe.steps.map((s) => ({ phase: s.phase, instruction: s.instruction, timerSec: s.timerSec, ingredients: s.ingredients })),
      visibility: 'public',
    });
    get().upsertServerRecipes([created]);
    return toRecipe(created);
  },

  ensureCollection: async (title, tagline = 'new collection') => {
    const existing = get().collections.find((c) => c.title === title);
    if (existing) return existing;
    if (!backend()) return get().addCollection(title, tagline);
    const created = await recipesApi.createCollection(title, tagline);
    set((state) => ({ collections: [...state.collections, created] }));
    return created;
  },
  generatorServings: 2,
  generatorEffort: 'Easy',
  generatorStyle: 'Bowl',
  selectedGeneratorIngredients: [],
  lastGeneration: null,

  getRecipeById: (id) => get().recipes.find((r) => r.id === id),

  resetUserData: () =>
    set({
      savedRecipeIds: [],
      likedRecipeIds: [],
      madeRecipeIds: [],
      followedAuthors: [],
      ratings: {},
      collections: [],
      followedAuthorIds: [],
      selectedGeneratorIngredients: [],
      lastGeneration: null,
      generatorServings: 2,
      generatorEffort: "Easy",
      generatorStyle: "Bowl",
    }),

  addRecipe: (recipe) => {
    const created: Recipe = {
      ...recipe,
      id: `r${recipeCounter++}`,
      imageKey: recipe.imageKey || `${slugify(recipe.title)}.jpg`,
      createdAt: Date.now(),
    };
    set((state) => ({ recipes: [created, ...state.recipes] }));
    return created;
  },

  toggleSaveRecipe: (id) => {
    const r = get().recipes.find((x) => x.id === id);
    const wasSaved = get().savedRecipeIds.includes(id);
    if (r && !wasSaved) useUserStore.getState().recordSignal("saved", r.cuisine, id);
    if (backend() && isServerId(id)) (wasSaved ? recipesApi.unsave(id) : recipesApi.save(id)).catch(() => undefined);
    set((state) => ({
      savedRecipeIds: state.savedRecipeIds.includes(id)
        ? state.savedRecipeIds.filter((rId) => rId !== id)
        : [...state.savedRecipeIds, id],
    }));
  },

  toggleLikeRecipe: (id) => {
    const r = get().recipes.find((x) => x.id === id);
    const wasLiked = get().likedRecipeIds.includes(id);
    if (r && !wasLiked) useUserStore.getState().recordSignal("liked", r.cuisine, id);
    if (backend() && isServerId(id)) {
      (wasLiked ? recipesApi.unlike(id) : recipesApi.like(id))
        .then((res) => set((state) => ({ recipes: state.recipes.map((x) => (x.id === id ? { ...x, likes: res.likes } : x)) })))
        .catch(() => undefined);
    }
    set((state) => ({
      likedRecipeIds: state.likedRecipeIds.includes(id)
        ? state.likedRecipeIds.filter((rId) => rId !== id)
        : [...state.likedRecipeIds, id],
    }));
  },

  toggleFollowAuthor: (author) => {
    const following = get().followedAuthors.includes(author);
    if (backend()) {
      const authorId = (get().recipes.find((r) => r.authorName === author) as ServerRecipe | undefined)?.authorId;
      if (authorId) {
        (following ? recipesApi.unfollow(authorId) : recipesApi.follow(authorId)).catch(() => undefined);
        set((state) => ({ followedAuthorIds: following ? state.followedAuthorIds.filter((i) => i !== authorId) : [...state.followedAuthorIds, authorId] }));
      }
    }
    set((state) => ({
      followedAuthors: following ? state.followedAuthors.filter((a) => a !== author) : [...state.followedAuthors, author],
    }));
  },

  markMade: (id, rating) => {
    const r = get().recipes.find((x) => x.id === id);
    if (r) {
      useUserStore.getState().recordSignal("cooked", r.cuisine, id);
      if (r.style) useUserStore.getState().recordSignal("cooked", r.style);
    }
    if (backend() && isServerId(id)) {
      // A completed cooking session is the strongest signal: rating + streak live on the server.
      recipesApi
        .startCooking(id)
        .then((session) => recipesApi.completeCooking(session.id, rating))
        .catch(() => (rating ? recipesApi.rate(id, rating).catch(() => undefined) : undefined));
    }
    set((state) => ({
      madeRecipeIds: state.madeRecipeIds.includes(id) ? state.madeRecipeIds : [...state.madeRecipeIds, id],
      ratings: rating ? { ...state.ratings, [id]: rating } : state.ratings,
    }));
  },

  addCollection: (title, tagline = 'new collection') => {
    const created: Collection = { id: `c${collectionCounter++}`, title: title.trim(), tagline, recipeIds: [] };
    set((state) => ({ collections: [...state.collections, created] }));
    return created;
  },

  addRecipeToCollection: (collectionId, recipeId) => {
    if (backend() && isServerId(collectionId) && isServerId(recipeId)) recipesApi.addToCollection(collectionId, recipeId).catch(() => undefined);
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId && !c.recipeIds.includes(recipeId) ? { ...c, recipeIds: [...c.recipeIds, recipeId] } : c,
      ),
    }));
  },

  setGeneratorServings: (servings) => set({ generatorServings: servings }),
  setGeneratorEffort: (effort) => set({ generatorEffort: effort }),
  setGeneratorStyle: (style) => set({ generatorStyle: style }),
  setGeneratorIngredients: (names) => set({ selectedGeneratorIngredients: names }),
  toggleGeneratorIngredient: (ingredient) =>
    set((state) => ({
      selectedGeneratorIngredients: state.selectedGeneratorIngredients.includes(ingredient)
        ? state.selectedGeneratorIngredients.filter((i) => i !== ingredient)
        : [...state.selectedGeneratorIngredients, ingredient],
    })),

  generateRecipes: (request, fridge) => {
    const ranked = [...get().recipes]
      .map((r) => ({ r, score: scoreRecipe(r, request, fridge) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ r }) => r.id);
    const result: GenerationResult = { ...request, recipeIds: ranked, generatedAt: Date.now() };
    set({ lastGeneration: result });
    return result;
  },
}));

/** Pantry swaps FRIDGR can suggest when an ingredient is missing. */
export const SUBSTITUTIONS: Record<string, { swap: string; why: string }> = {
  gochujang: { swap: 'Sriracha + honey', why: 'Heat and sweetness land in the same place.' },
  mirin: { swap: 'Rice vinegar + 1 tsp sugar', why: 'Close enough for the glaze — nobody will taste the difference.' },
  'harissa paste': { swap: 'Smoked paprika + chilli + garlic', why: 'Builds the same smoky heat from the spice rack.' },
  lemon: { swap: 'A splash of vinegar', why: 'You only need the acidity here.' },
  'salmon fillets': { swap: 'Chicken breast', why: 'Same glaze, same timings, slightly leaner.' },
  chickpeas: { swap: 'Eggs, soft-boiled', why: 'Keeps the protein without a trip to the shop.' },
  'white beans': { swap: 'Chickpeas', why: 'Braises the same way and holds its shape.' },
  miso: { swap: 'Soy sauce + tahini', why: 'Salty and nutty, which is what miso brings.' },
  butter: { swap: 'Olive oil', why: 'You have it, and it roasts just as well.' },
  'sesame oil': { swap: 'Olive oil + toasted seeds', why: 'You lose a little aroma, nothing else.' },
};

export const findSubstitution = (ingredientName: string) => {
  const n = normalize(ingredientName);
  const key = Object.keys(SUBSTITUTIONS).find((k) => n.includes(k) || k.includes(n));
  return key ? SUBSTITUTIONS[key] : undefined;
};
