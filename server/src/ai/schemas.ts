import { z } from 'zod';

/* ------------------------------------------------------------------ recipes */
export const aiIngredient = z.object({
  name: z.string().min(1).max(80),
  amount: z.string().max(40),
  quantity: z.number().min(0).max(5000).optional(),
  unit: z.string().max(12).optional(),
  grams: z.number().min(0).max(5000).optional(),
  isOptional: z.boolean().optional(),
});

export const aiStep = z.object({
  phase: z.string().max(20),
  instruction: z.string().min(3).max(600),
  timerSec: z.number().int().min(0).max(14400).optional(),
  ingredients: z.array(z.string().max(80)).max(12).default([]),
});

export const aiRecipe = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(280),
  cuisine: z.string().max(30),
  effort: z.enum(['Easy', 'Medium', 'Cheffy']),
  style: z.enum(['Bowl', 'Traybake', 'Salad']),
  prepTimeMin: z.number().int().min(3).max(240),
  servings: z.number().int().min(1).max(12),
  ingredients: z.array(aiIngredient).min(2).max(25),
  steps: z.array(aiStep).min(2).max(15),
  estimatedNutritionPerServing: z.object({ kcal: z.number().min(0).max(3000), proteinG: z.number().min(0).max(300), carbsG: z.number().min(0).max(400), fatG: z.number().min(0).max(300) }),
  usesFromFridge: z.array(z.string().max(80)).default([]),
  tone: z.enum(['cream', 'sage', 'blush']).optional(),
});
export type AiRecipe = z.infer<typeof aiRecipe>;

export const aiRecipeList = z.object({ recipes: z.array(aiRecipe).min(1).max(8) });

const ingredientJson = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Ingredient name, singular, no quantities (e.g. "Chicken breast")' },
    amount: { type: 'string', description: 'Display amount, e.g. "450 g", "2 pcs", "1 tbsp"' },
    quantity: { type: 'number' },
    unit: { type: 'string', description: 'g | ml | pcs | tbsp | tsp | cup | clove | slice' },
    grams: { type: 'number', description: 'Best estimate of the total weight in grams (for nutrition)' },
    isOptional: { type: 'boolean' },
  },
  required: ['name', 'amount'],
};

const stepJson = {
  type: 'object',
  properties: {
    phase: { type: 'string', description: 'One upper-case word: PREP, SEAR, ROAST, SIMMER, PLATE…' },
    instruction: { type: 'string', description: 'One or two sentences, imperative, concrete, with temperatures/timings' },
    timerSec: { type: 'integer', description: 'Only when the step is a timed wait' },
    ingredients: { type: 'array', items: { type: 'string' }, description: 'Ingredient names used in this step' },
  },
  required: ['phase', 'instruction', 'ingredients'],
};

export const recipeJson = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Appetising, specific, max 60 chars, sentence case' },
    description: { type: 'string', description: 'One friendly sentence about why it works, max 200 chars' },
    cuisine: { type: 'string', description: 'e.g. Levantine, Japanese, Italian, Mexican, British, Korean' },
    effort: { type: 'string', enum: ['Easy', 'Medium', 'Cheffy'] },
    style: { type: 'string', enum: ['Bowl', 'Traybake', 'Salad'] },
    prepTimeMin: { type: 'integer', description: 'Total hands-on + cooking minutes' },
    servings: { type: 'integer' },
    ingredients: { type: 'array', items: ingredientJson },
    steps: { type: 'array', items: stepJson },
    estimatedNutritionPerServing: {
      type: 'object',
      properties: { kcal: { type: 'number' }, proteinG: { type: 'number' }, carbsG: { type: 'number' }, fatG: { type: 'number' } },
      required: ['kcal', 'proteinG', 'carbsG', 'fatG'],
    },
    usesFromFridge: { type: 'array', items: { type: 'string' }, description: 'Which of the listed fridge items this recipe uses' },
    tone: { type: 'string', enum: ['cream', 'sage', 'blush'], description: 'Card tint: cream=warm/brown, sage=green/fresh, blush=red/pink dishes' },
  },
  required: ['title', 'description', 'cuisine', 'effort', 'style', 'prepTimeMin', 'servings', 'ingredients', 'steps', 'estimatedNutritionPerServing', 'usesFromFridge'],
};

export const recipeListJson = { type: 'object', properties: { recipes: { type: 'array', items: recipeJson } }, required: ['recipes'] };

/* ------------------------------------------------------------------ scan */
export const scanCandidate = z.object({
  name: z.string().min(1).max(60),
  category: z.enum(['Protein', 'Veg', 'Dairy', 'Pantry', 'Produce']),
  quantity: z.number().min(0).max(999),
  unit: z.string().max(12),
  confidence: z.number().min(0).max(1),
  estimatedDaysToExpiry: z.number().int().min(0).max(365).optional(),
  brand: z.string().max(60).optional(),
  notes: z.string().max(120).optional(),
});
export const scanResult = z.object({ items: z.array(scanCandidate).max(30), isFood: z.boolean(), sceneNote: z.string().max(200).optional() });
export type ScanResult = z.infer<typeof scanResult>;

export const scanJson = {
  type: 'object',
  properties: {
    isFood: { type: 'boolean', description: 'false when the image contains no food or groceries at all' },
    sceneNote: { type: 'string', description: 'Short note about the scene, e.g. "fridge top shelf, some items partly hidden"' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Generic food name as a shopper would say it, singular where natural ("Greek yoghurt", "Red peppers")' },
          category: { type: 'string', enum: ['Protein', 'Veg', 'Dairy', 'Pantry', 'Produce'] },
          quantity: { type: 'number', description: 'Visible count or estimated weight/volume' },
          unit: { type: 'string', description: 'pcs | g | ml | bunch | pack' },
          confidence: { type: 'number', description: '0–1: how sure you are this item is present and correctly named' },
          estimatedDaysToExpiry: { type: 'integer', description: 'Typical remaining shelf life for a fresh item of this kind; omit if unknown' },
          brand: { type: 'string' },
          notes: { type: 'string', description: 'e.g. "half used", "looks wilted"' },
        },
        required: ['name', 'category', 'quantity', 'unit', 'confidence'],
      },
    },
  },
  required: ['isFood', 'items'],
};

/* ------------------------------------------------------------------ import normalisation */
export const importResult = z.object({
  found: z.boolean(),
  reason: z.string().max(200).optional(),
  recipe: aiRecipe.optional(),
});
export const importJson = {
  type: 'object',
  properties: {
    found: { type: 'boolean', description: 'false when the text does not contain enough of a recipe (no ingredients or no method)' },
    reason: { type: 'string', description: 'Why not found, in one short sentence the user will read' },
    recipe: recipeJson,
  },
  required: ['found'],
};
