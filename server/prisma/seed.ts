/* eslint-disable no-console */
/**
 * FRIDGR seed — idempotent. Run with `npm run db:seed` (uses DATABASE_URL).
 *  1. food categories + ~150 normalised foods with aliases, allergens, shelf life and per-100 g nutrition (USDA-derived estimates)
 *  2. four creator accounts and the seven launch recipes (public)
 *  3. an App Review demo account with a stocked fridge and shopping list
 */
import 'dotenv/config';
import { PrismaClient, type FoodCategoryKind } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

type FoodSeed = [name: string, category: FoodCategoryKind, unit: string, shelfDays: number, allergens: string[], kcal: number, protein: number, carbs: number, fat: number, aliases?: string[]];

// name is the canonical lower-case key; displayName is derived.
const FOODS: FoodSeed[] = [
  // ---- protein
  ['chicken breast', 'Protein', 'g', 3, [], 165, 31, 0, 3.6, ['chicken', 'chicken fillet', 'chicken breasts']],
  ['chicken thigh', 'Protein', 'g', 3, [], 209, 26, 0, 11, ['chicken thighs']],
  ['minced beef', 'Protein', 'g', 2, [], 250, 26, 0, 15, ['ground beef', 'beef mince']],
  ['beef steak', 'Protein', 'g', 3, [], 271, 25, 0, 19, ['steak', 'sirloin']],
  ['pork loin', 'Protein', 'g', 3, [], 242, 27, 0, 14, ['pork chop', 'pork chops']],
  ['bacon', 'Protein', 'g', 7, [], 541, 37, 1.4, 42, ['streaky bacon']],
  ['sausages', 'Protein', 'pcs', 3, ['gluten'], 301, 12, 3, 27, ['sausage']],
  ['salmon fillets', 'Protein', 'pcs', 2, ['fish'], 208, 20, 0, 13, ['salmon', 'salmon fillet']],
  ['cod', 'Protein', 'g', 2, ['fish'], 82, 18, 0, 0.7, ['white fish', 'cod fillet']],
  ['tuna', 'Protein', 'g', 365, ['fish'], 116, 26, 0, 1, ['tinned tuna', 'canned tuna']],
  ['prawns', 'Protein', 'g', 2, ['shellfish'], 99, 24, 0.2, 0.3, ['shrimp', 'king prawns']],
  ['eggs', 'Protein', 'pcs', 21, ['eggs'], 155, 13, 1.1, 11, ['egg', 'free range eggs']],
  ['tofu', 'Protein', 'g', 5, ['soy'], 76, 8, 1.9, 4.8, ['firm tofu']],
  ['tempeh', 'Protein', 'g', 7, ['soy'], 192, 20, 8, 11],
  ['chickpeas', 'Protein', 'g', 730, [], 139, 7.3, 22, 2.6, ['chickpea', 'tinned chickpeas', 'garbanzo beans']],
  ['white beans', 'Protein', 'g', 730, [], 114, 7, 20, 0.4, ['cannellini beans', 'butter beans', 'haricot beans']],
  ['black beans', 'Protein', 'g', 730, [], 132, 8.9, 24, 0.5],
  ['kidney beans', 'Protein', 'g', 730, [], 127, 8.7, 23, 0.5],
  ['red lentils', 'Protein', 'g', 365, [], 116, 9, 20, 0.4, ['lentils', 'lentil']],
  ['green lentils', 'Protein', 'g', 365, [], 116, 9, 20, 0.4, ['puy lentils']],
  ['edamame', 'Protein', 'g', 180, ['soy'], 121, 12, 9, 5, ['edamame beans']],
  ['turkey mince', 'Protein', 'g', 2, [], 149, 19, 0, 8, ['ground turkey']],
  ['lamb', 'Protein', 'g', 3, [], 294, 25, 0, 21, ['lamb mince', 'lamb chops']],
  // ---- dairy
  ['greek yoghurt', 'Dairy', 'g', 10, ['dairy'], 97, 9, 3.6, 5, ['greek yogurt', 'yoghurt', 'yogurt', 'natural yoghurt']],
  ['milk', 'Dairy', 'ml', 7, ['dairy'], 64, 3.4, 4.8, 3.6, ['whole milk', 'semi skimmed milk']],
  ['butter', 'Dairy', 'g', 60, ['dairy'], 717, 0.9, 0.1, 81, ['salted butter', 'unsalted butter']],
  ['feta cheese', 'Dairy', 'g', 14, ['dairy'], 264, 14, 4, 21, ['feta']],
  ['cheddar cheese', 'Dairy', 'g', 21, ['dairy'], 403, 25, 1.3, 33, ['cheddar', 'mature cheddar']],
  ['parmesan', 'Dairy', 'g', 60, ['dairy'], 431, 38, 4, 29, ['parmesan cheese', 'parmigiano', 'grana padano']],
  ['mozzarella', 'Dairy', 'g', 7, ['dairy'], 280, 28, 3, 17, ['mozzarella cheese']],
  ['halloumi', 'Dairy', 'g', 21, ['dairy'], 321, 22, 2, 25],
  ['cream cheese', 'Dairy', 'g', 14, ['dairy'], 342, 6, 4, 34],
  ['double cream', 'Dairy', 'ml', 7, ['dairy'], 449, 1.7, 2.7, 48, ['heavy cream', 'cream']],
  ['sour cream', 'Dairy', 'g', 10, ['dairy'], 198, 2.4, 4.6, 19, ['creme fraiche']],
  ['ricotta', 'Dairy', 'g', 7, ['dairy'], 174, 11, 3, 13],
  ['oat milk', 'Dairy', 'ml', 7, ['gluten'], 43, 1, 6.7, 1.5],
  ['coconut yoghurt', 'Dairy', 'g', 10, [], 130, 1, 6, 11, ['coconut yogurt']],
  // ---- veg
  ['spinach', 'Veg', 'g', 4, [], 23, 2.9, 3.6, 0.4, ['baby spinach']],
  ['kale', 'Veg', 'g', 5, [], 49, 4.3, 9, 0.9],
  ['red peppers', 'Veg', 'pcs', 7, [], 31, 1, 6, 0.3, ['red pepper', 'bell pepper', 'bell peppers', 'peppers', 'capsicum']],
  ['yellow pepper', 'Veg', 'pcs', 7, [], 27, 1, 6, 0.2],
  ['broccoli', 'Veg', 'g', 5, [], 34, 2.8, 7, 0.4, ['tenderstem broccoli']],
  ['cauliflower', 'Veg', 'g', 7, [], 25, 1.9, 5, 0.3],
  ['courgette', 'Veg', 'pcs', 7, [], 17, 1.2, 3.1, 0.3, ['zucchini', 'courgettes']],
  ['aubergine', 'Veg', 'pcs', 7, [], 25, 1, 6, 0.2, ['eggplant']],
  ['carrots', 'Veg', 'g', 21, [], 41, 0.9, 10, 0.2, ['carrot']],
  ['onion', 'Veg', 'pcs', 30, [], 40, 1.1, 9, 0.1, ['onions', 'brown onion', 'yellow onion']],
  ['red onion', 'Veg', 'pcs', 30, [], 40, 1.1, 9, 0.1, ['red onions']],
  ['spring onion', 'Veg', 'pcs', 7, [], 32, 1.8, 7, 0.2, ['spring onions', 'scallions', 'green onion', 'green onions']],
  ['leek', 'Veg', 'pcs', 10, [], 61, 1.5, 14, 0.3, ['leeks']],
  ['celery', 'Veg', 'pcs', 14, ['celery'], 16, 0.7, 3, 0.2],
  ['mushrooms', 'Veg', 'g', 5, [], 22, 3.1, 3.3, 0.3, ['mushroom', 'chestnut mushrooms', 'button mushrooms']],
  ['sweet potato', 'Veg', 'pcs', 21, [], 86, 1.6, 20, 0.1, ['sweet potatoes']],
  ['potatoes', 'Veg', 'g', 21, [], 77, 2, 17, 0.1, ['potato', 'new potatoes', 'baby potatoes']],
  ['green beans', 'Veg', 'g', 5, [], 31, 1.8, 7, 0.2],
  ['peas', 'Veg', 'g', 180, [], 81, 5.4, 14, 0.4, ['frozen peas', 'garden peas']],
  ['sweetcorn', 'Veg', 'g', 365, [], 86, 3.3, 19, 1.4, ['corn', 'sweet corn']],
  ['cabbage', 'Veg', 'pcs', 14, [], 25, 1.3, 6, 0.1, ['white cabbage', 'savoy cabbage']],
  ['pak choi', 'Veg', 'pcs', 4, [], 13, 1.5, 2.2, 0.2, ['bok choy']],
  ['asparagus', 'Veg', 'g', 4, [], 20, 2.2, 3.9, 0.1],
  ['butternut squash', 'Veg', 'pcs', 30, [], 45, 1, 12, 0.1, ['squash']],
  ['beetroot', 'Veg', 'g', 14, [], 43, 1.6, 10, 0.2, ['beets']],
  ['cucumber', 'Veg', 'pcs', 7, [], 15, 0.7, 3.6, 0.1],
  ['lettuce', 'Veg', 'pcs', 5, [], 15, 1.4, 2.9, 0.2, ['salad leaves', 'mixed leaves', 'romaine', 'little gem']],
  ['rocket', 'Veg', 'g', 4, [], 25, 2.6, 3.7, 0.7, ['arugula']],
  ['ginger', 'Veg', 'g', 21, [], 80, 1.8, 18, 0.8, ['fresh ginger', 'root ginger']],
  ['red chilli', 'Veg', 'pcs', 10, [], 40, 1.9, 9, 0.4, ['chilli', 'chili', 'fresh chilli', 'chillies']],
  // ---- produce (fruit, herbs, aromatics)
  ['garlic', 'Produce', 'pcs', 30, [], 149, 6.4, 33, 0.5, ['garlic cloves', 'garlic clove', 'garlic bulb']],
  ['cherry tomatoes', 'Produce', 'g', 6, [], 18, 0.9, 3.9, 0.2, ['cherry tomato', 'tomatoes', 'tomato', 'vine tomatoes']],
  ['lemon', 'Produce', 'pcs', 21, [], 29, 1.1, 9, 0.3, ['lemons']],
  ['lime', 'Produce', 'pcs', 21, [], 30, 0.7, 11, 0.2, ['limes']],
  ['avocado', 'Produce', 'pcs', 4, [], 160, 2, 9, 15, ['avocados']],
  ['banana', 'Produce', 'pcs', 5, [], 89, 1.1, 23, 0.3, ['bananas']],
  ['apple', 'Produce', 'pcs', 21, [], 52, 0.3, 14, 0.2, ['apples']],
  ['blueberries', 'Produce', 'g', 7, [], 57, 0.7, 14, 0.3],
  ['strawberries', 'Produce', 'g', 3, [], 32, 0.7, 7.7, 0.3],
  ['mango', 'Produce', 'pcs', 5, [], 60, 0.8, 15, 0.4],
  ['orange', 'Produce', 'pcs', 14, [], 47, 0.9, 12, 0.1, ['oranges']],
  ['pomegranate', 'Produce', 'pcs', 14, [], 83, 1.7, 19, 1.2, ['pomegranate seeds']],
  ['flat-leaf parsley', 'Produce', 'pcs', 5, [], 36, 3, 6, 0.8, ['parsley', 'fresh parsley']],
  ['coriander', 'Produce', 'pcs', 5, [], 23, 2.1, 3.7, 0.5, ['cilantro', 'fresh coriander']],
  ['basil', 'Produce', 'pcs', 4, [], 23, 3.2, 2.7, 0.6, ['fresh basil']],
  ['mint', 'Produce', 'pcs', 5, [], 44, 3.3, 8, 0.7, ['fresh mint']],
  ['dill', 'Produce', 'pcs', 5, [], 43, 3.5, 7, 1.1],
  ['thyme', 'Produce', 'pcs', 10, [], 101, 5.6, 24, 1.7, ['fresh thyme']],
  ['rosemary', 'Produce', 'pcs', 10, [], 131, 3.3, 21, 5.9],
  // ---- pantry
  ['brown rice', 'Pantry', 'g', 365, [], 112, 2.6, 24, 0.9, ['rice', 'wholegrain rice']],
  ['basmati rice', 'Pantry', 'g', 365, [], 130, 2.7, 28, 0.3, ['white rice', 'jasmine rice', 'long grain rice']],
  ['sushi rice', 'Pantry', 'g', 365, [], 130, 2.4, 29, 0.2, ['short grain rice']],
  ['quinoa', 'Pantry', 'g', 365, [], 120, 4.4, 21, 1.9],
  ['couscous', 'Pantry', 'g', 365, ['gluten'], 112, 3.8, 23, 0.2],
  ['bulgur wheat', 'Pantry', 'g', 365, ['gluten'], 83, 3.1, 19, 0.2, ['bulgur']],
  ['pasta', 'Pantry', 'g', 365, ['gluten'], 131, 5, 25, 1.1, ['spaghetti', 'penne', 'fusilli', 'linguine', 'rigatoni']],
  ['noodles', 'Pantry', 'g', 365, ['gluten', 'eggs'], 138, 4.5, 25, 2.1, ['egg noodles', 'ramen noodles']],
  ['rice noodles', 'Pantry', 'g', 365, [], 109, 0.9, 25, 0.2],
  ['oats', 'Pantry', 'g', 365, ['gluten'], 389, 17, 66, 7, ['porridge oats', 'rolled oats']],
  ['sourdough', 'Pantry', 'pcs', 4, ['gluten'], 260, 9, 51, 1.5, ['sourdough bread', 'bread', 'loaf']],
  ['tortillas', 'Pantry', 'pcs', 14, ['gluten'], 312, 8, 51, 8, ['wraps', 'tortilla', 'flour tortillas']],
  ['pitta bread', 'Pantry', 'pcs', 5, ['gluten'], 275, 9, 55, 1.2, ['pitta', 'pita', 'flatbread']],
  ['plain flour', 'Pantry', 'g', 365, ['gluten'], 364, 10, 76, 1, ['flour', 'all purpose flour']],
  ['olive oil', 'Pantry', 'ml', 365, [], 884, 0, 0, 100, ['extra virgin olive oil', 'oil']],
  ['vegetable oil', 'Pantry', 'ml', 365, [], 884, 0, 0, 100, ['sunflower oil', 'rapeseed oil']],
  ['sesame oil', 'Pantry', 'ml', 365, ['sesame'], 884, 0, 0, 100, ['toasted sesame oil']],
  ['coconut milk', 'Pantry', 'ml', 730, [], 230, 2.3, 6, 24, ['tinned coconut milk']],
  ['chopped tomatoes', 'Pantry', 'g', 730, [], 32, 1.6, 7, 0.3, ['tinned tomatoes', 'canned tomatoes', 'passata']],
  ['tomato puree', 'Pantry', 'g', 60, [], 82, 4.3, 19, 0.5, ['tomato paste']],
  ['harissa paste', 'Pantry', 'g', 90, [], 70, 3, 10, 2, ['harissa', 'rose harissa']],
  ['gochujang', 'Pantry', 'g', 180, ['soy', 'gluten'], 190, 4, 40, 1.5, ['korean chilli paste']],
  ['miso', 'Pantry', 'g', 365, ['soy'], 199, 12, 26, 6, ['miso paste', 'white miso', 'red miso']],
  ['soy sauce', 'Pantry', 'ml', 365, ['soy', 'gluten'], 53, 8, 5, 0.6, ['light soy sauce', 'dark soy sauce', 'tamari']],
  ['mirin', 'Pantry', 'ml', 365, [], 241, 0.2, 43, 0],
  ['rice vinegar', 'Pantry', 'ml', 365, [], 18, 0, 0.6, 0, ['rice wine vinegar']],
  ['fish sauce', 'Pantry', 'ml', 365, ['fish'], 35, 5, 3.6, 0],
  ['sriracha', 'Pantry', 'ml', 365, [], 93, 2, 19, 1, ['hot sauce', 'chilli sauce']],
  ['tahini', 'Pantry', 'g', 180, ['sesame'], 595, 17, 21, 54],
  ['peanut butter', 'Pantry', 'g', 180, ['peanuts'], 588, 25, 20, 50],
  ['honey', 'Pantry', 'g', 730, [], 304, 0.3, 82, 0],
  ['maple syrup', 'Pantry', 'ml', 730, [], 260, 0, 67, 0],
  ['sugar', 'Pantry', 'g', 730, [], 387, 0, 100, 0, ['caster sugar', 'brown sugar']],
  ['salt', 'Pantry', 'g', 3650, [], 0, 0, 0, 0, ['sea salt', 'flaky salt']],
  ['black pepper', 'Pantry', 'g', 730, [], 251, 10, 64, 3.3, ['pepper', 'ground pepper']],
  ['chilli flakes', 'Pantry', 'g', 365, [], 318, 12, 57, 17, ['red pepper flakes', 'chili flakes']],
  ['smoked paprika', 'Pantry', 'g', 365, [], 282, 14, 54, 13, ['paprika']],
  ['cumin', 'Pantry', 'g', 365, [], 375, 18, 44, 22, ['ground cumin', 'cumin seeds']],
  ['coriander seeds', 'Pantry', 'g', 365, [], 298, 12, 55, 18, ['ground coriander']],
  ['turmeric', 'Pantry', 'g', 365, [], 312, 10, 67, 3.3],
  ['garam masala', 'Pantry', 'g', 365, [], 379, 15, 45, 15, ['curry powder']],
  ['cinnamon', 'Pantry', 'g', 365, [], 247, 4, 81, 1.2],
  ['oregano', 'Pantry', 'g', 365, [], 265, 9, 69, 4.3, ['dried oregano', 'mixed herbs']],
  ['bay leaves', 'Pantry', 'pcs', 365, [], 313, 7.6, 75, 8.4],
  ['stock cubes', 'Pantry', 'pcs', 365, ['celery'], 200, 10, 20, 10, ['stock cube', 'chicken stock cube', 'vegetable stock cube', 'beef stock cube', 'bouillon', 'oxo']],
  ['balsamic vinegar', 'Pantry', 'ml', 730, [], 88, 0.5, 17, 0],
  ['apple cider vinegar', 'Pantry', 'ml', 730, [], 21, 0, 0.9, 0, ['vinegar', 'white wine vinegar']],
  ['dijon mustard', 'Pantry', 'g', 365, [], 66, 4, 5, 3.3, ['mustard', 'wholegrain mustard']],
  ['mayonnaise', 'Pantry', 'g', 60, ['eggs'], 680, 1, 0.6, 75, ['mayo']],
  ['capers', 'Pantry', 'g', 365, [], 23, 2.4, 4.9, 0.9],
  ['olives', 'Pantry', 'g', 180, [], 115, 0.8, 6, 11, ['black olives', 'green olives', 'kalamata olives']],
  ['sun-dried tomatoes', 'Pantry', 'g', 180, [], 258, 14, 56, 3, ['sundried tomatoes']],
  ['almonds', 'Pantry', 'g', 180, ['treenuts'], 579, 21, 22, 50, ['flaked almonds', 'ground almonds']],
  ['walnuts', 'Pantry', 'g', 180, ['treenuts'], 654, 15, 14, 65],
  ['cashews', 'Pantry', 'g', 180, ['treenuts'], 553, 18, 30, 44, ['cashew nuts']],
  ['peanuts', 'Pantry', 'g', 180, ['peanuts'], 567, 26, 16, 49],
  ['sesame seeds', 'Pantry', 'g', 365, ['sesame'], 573, 18, 23, 50],
  ['pumpkin seeds', 'Pantry', 'g', 180, [], 559, 30, 11, 49, ['pepitas']],
  ['chia seeds', 'Pantry', 'g', 365, [], 486, 17, 42, 31],
  ['breadcrumbs', 'Pantry', 'g', 180, ['gluten'], 395, 13, 72, 5.3, ['panko', 'panko breadcrumbs']],
  ['dark chocolate', 'Pantry', 'g', 365, ['dairy', 'soy'], 546, 4.9, 61, 31, ['chocolate']],
  ['cocoa powder', 'Pantry', 'g', 365, [], 228, 20, 58, 14],
  ['baking powder', 'Pantry', 'g', 365, [], 53, 0, 28, 0],
  ['vanilla extract', 'Pantry', 'ml', 730, [], 288, 0.1, 13, 0.1],
  ['nori', 'Pantry', 'pcs', 365, [], 35, 5.8, 5, 0.3, ['seaweed', 'nori sheets']],
  ['kimchi', 'Pantry', 'g', 60, ['fish', 'shellfish'], 15, 1.1, 2.4, 0.5],
];

/**
 * Second batch: the ingredient names most often seen in the public recipe
 * library that the first list did not cover. Allergens matter most here
 * (Worcestershire = fish, oyster sauce = shellfish, pastry = gluten + dairy).
 */
const MORE_FOODS: FoodSeed[] = [
  ['water', 'Pantry', 'ml', 3650, [], 0, 0, 0, 0, ['boiling water', 'cold water', 'warm water', 'hot water', 'iced water', 'ice']],
  ['stock', 'Pantry', 'ml', 4, ['celery'], 6, 0.8, 0.5, 0.2, ['chicken stock', 'vegetable stock', 'beef stock', 'fish stock', 'broth', 'chicken broth', 'beef broth', 'vegetable broth']],
  ['cornflour', 'Pantry', 'g', 730, [], 381, 0.3, 91, 0.1, ['cornstarch', 'corn starch', 'corn flour']],
  ['lemon juice', 'Produce', 'ml', 7, [], 22, 0.4, 7, 0.2, ['juice of lemon', 'fresh lemon juice']],
  ['lime juice', 'Produce', 'ml', 7, [], 25, 0.4, 8, 0.1, ['juice of lime', 'fresh lime juice']],
  ['nutmeg', 'Pantry', 'g', 730, [], 525, 6, 49, 36, ['ground nutmeg', 'grated nutmeg']],
  ['yeast', 'Pantry', 'g', 365, [], 325, 40, 41, 7.6, ['instant yeast', 'dried yeast', 'dry yeast', 'fast action yeast']],
  ['chorizo', 'Protein', 'g', 30, [], 455, 24, 2, 38, ['chorizo sausage']],
  ['allspice', 'Pantry', 'g', 730, [], 263, 6, 72, 8.7, ['ground allspice']],
  ['raisins', 'Pantry', 'g', 365, [], 299, 3.1, 79, 0.5, ['sultanas', 'currants', 'dried fruit', 'mixed fruit']],
  ['cardamom', 'Pantry', 'g', 730, [], 311, 11, 68, 6.7, ['ground cardamom', 'ground cardomom', 'cardamom pods', 'cardomom']],
  ['shallot', 'Veg', 'pcs', 30, [], 72, 2.5, 17, 0.1, ['shallots', 'challots', 'banana shallot']],
  ['cloves', 'Pantry', 'g', 730, [], 274, 6, 66, 13, ['ground cloves', 'whole cloves']],
  ['chives', 'Produce', 'pcs', 5, [], 30, 3.3, 4.4, 0.7, ['fresh chives']],
  ['wine', 'Pantry', 'ml', 365, [], 82, 0.1, 2.6, 0, ['white wine', 'red wine', 'dry white wine', 'dry red wine', 'cooking wine', 'rice wine', 'shaoxing wine']],
  ['spirits', 'Pantry', 'ml', 3650, [], 231, 0, 0, 0, ['brandy', 'rum', 'dry sherry', 'sherry', 'cognac', 'vodka', 'whisky', 'marsala']],
  ['saffron', 'Pantry', 'g', 730, [], 310, 11, 65, 6, ['saffron threads']],
  ['pork mince', 'Protein', 'g', 2, [], 263, 17, 0, 21, ['ground pork', 'minced pork']],
  ['desiccated coconut', 'Pantry', 'g', 365, [], 660, 6.9, 24, 65, ['coconut', 'shredded coconut', 'coconut flakes']],
  ['chilli powder', 'Pantry', 'g', 365, [], 282, 13, 50, 14, ['chili powder', 'cayenne pepper', 'cayenne', 'kashmiri chilli powder']],
  ['puff pastry', 'Pantry', 'g', 30, ['gluten', 'dairy'], 551, 7.4, 45, 38, ['ready rolled puff pastry']],
  ['shortcrust pastry', 'Pantry', 'g', 30, ['gluten', 'dairy'], 521, 6.4, 54, 31, ['pastry', 'pie crust', 'filo pastry', 'filo']],
  ['lard', 'Pantry', 'g', 180, [], 902, 0, 0, 100, ['shortening', 'vegetable shortening', 'suet', 'beef dripping']],
  ['orange blossom water', 'Pantry', 'ml', 730, [], 0, 0, 0, 0, ['rose water', 'rosewater']],
  ['pumpkin', 'Veg', 'g', 30, [], 26, 1, 6.5, 0.1, ['pumpkin puree']],
  ['dulce de leche', 'Dairy', 'g', 90, ['dairy'], 315, 6.8, 55, 7.4, ['caramel', 'condensed milk', 'evaporated milk']],
  ['fennel', 'Veg', 'pcs', 10, [], 31, 1.2, 7.3, 0.2, ['fennel bulb', 'fennel seeds']],
  ['bean sprouts', 'Veg', 'g', 3, [], 30, 3, 6, 0.2, ['beansprouts']],
  ['garlic powder', 'Pantry', 'g', 730, [], 331, 17, 73, 0.7, ['garlic granules', 'onion powder']],
  ['worcestershire sauce', 'Pantry', 'ml', 730, ['fish'], 78, 0, 19, 0, ['worcester sauce', 'worcestershire']],
  ['oyster sauce', 'Pantry', 'ml', 365, ['shellfish', 'gluten'], 51, 1.4, 11, 0.3, []],
  ['raspberries', 'Produce', 'g', 3, [], 52, 1.2, 12, 0.7, ['raspberry']],
  ['blackberries', 'Produce', 'g', 3, [], 43, 1.4, 10, 0.5, ['blackberry']],
  ['cheese', 'Dairy', 'g', 21, ['dairy'], 402, 25, 1.3, 33, ['grated cheese', 'gruyere', 'emmental', 'goats cheese', 'blue cheese', 'monterey jack cheese', 'colby jack cheese', 'stilton', 'brie', 'camembert']],
  ['swede', 'Veg', 'g', 21, [], 37, 1.1, 8.6, 0.2, ['rutabaga', 'turnip']],
  ['tomato ketchup', 'Pantry', 'ml', 180, [], 112, 1.7, 26, 0.1, ['ketchup', 'tomato sauce', 'bbq sauce', 'barbecue sauce']],
  ['squid', 'Protein', 'g', 2, ['shellfish'], 92, 16, 3.1, 1.4, ['calamari', 'baby squid']],
  ['marjoram', 'Produce', 'pcs', 10, [], 271, 13, 61, 7, ['dried marjoram']],
  ['golden syrup', 'Pantry', 'ml', 730, [], 325, 0, 79, 0, ['molasses', 'treacle', 'black treacle', 'corn syrup']],
  ['pistachios', 'Pantry', 'g', 180, ['treenuts'], 560, 20, 28, 45, ['pistachio', 'pistachio nuts']],
  ['almond extract', 'Pantry', 'ml', 730, ['treenuts'], 288, 0, 13, 0, []],
  ['jalapeno', 'Veg', 'pcs', 10, [], 29, 0.9, 6.5, 0.4, ['jalapenos', 'green chilli', 'scotch bonnet', 'bird eye chilli', 'birds eye chilli', 'thai chilli']],
  ['bicarbonate of soda', 'Pantry', 'g', 3650, [], 0, 0, 0, 0, ['baking soda', 'bicarb']],
  ['ham', 'Protein', 'g', 5, [], 145, 21, 1.5, 6, ['cooked ham', 'parma ham', 'prosciutto', 'gammon']],
  ['pecans', 'Pantry', 'g', 180, ['treenuts'], 691, 9, 14, 72, ['pecan nuts', 'pecan']],
  ['mascarpone', 'Dairy', 'g', 10, ['dairy'], 429, 4.6, 4, 44, ['mascarpone cheese']],
  ['custard', 'Dairy', 'ml', 5, ['dairy', 'eggs'], 122, 3.5, 17, 4, ['custard powder']],
  ['tamarind paste', 'Pantry', 'g', 365, [], 239, 2.8, 63, 0.6, ['tamarind', 'tamarind pulp']],
  ['star anise', 'Pantry', 'g', 730, [], 337, 18, 50, 16, []],
  ['dried apricots', 'Pantry', 'g', 365, [], 241, 3.4, 63, 0.5, ['apricots']],
  ['semolina', 'Pantry', 'g', 365, ['gluten'], 360, 13, 73, 1, ['fine semolina', 'polenta', 'cornmeal']],
  ['vanilla extract', 'Pantry', 'ml', 730, [], 288, 0.1, 13, 0.1, ['vanilla', 'vanilla essence', 'vanilla pod', 'vanilla bean']],
  ['harissa spice', 'Pantry', 'g', 365, [], 282, 12, 50, 14, ['ras el hanout', 'baharat', 'za\'atar', 'zaatar', 'mixed spice', 'five spice', 'chinese five spice', 'cajun seasoning', 'all-purpose seasoning', 'italian seasoning']],
];

/** Extra names for foods already in the first list. */
const ALIAS_PATCH: Record<string, string[]> = {
  'coconut milk': ['coconut cream', 'creamed coconut', 'light coconut milk', 'coconut milk powder'],
  'oat milk': ['almond milk', 'soy milk', 'soya milk', 'plant milk'],
  'bay leaves': ['bay leaf', 'bay leafs', 'dried bay leaves'],
  'beef steak': ['beef', 'beef brisket', 'brisket', 'stewing beef', 'braising steak', 'beef shin', 'chuck steak', 'rump steak', 'beef fillet', 'ribeye'],
  'pork loin': ['pork', 'pork belly', 'pork shoulder', 'pork tenderloin'],
  eggs: ['egg yolks', 'egg yolk', 'egg white', 'egg whites', 'large eggs', 'medium eggs'],
  cinnamon: ['cinnamon stick', 'cinnamon sticks', 'ground cinnamon'],
  'sesame seeds': ['sesame seed', 'white sesame seeds'],
  basil: ['basil leaves', 'fresh basil leaves'],
  coriander: ['coriander leaves', 'fresh coriander leaves'],
  'chicken thigh': ['chicken legs', 'chicken leg', 'chicken drumsticks', 'chicken wings', 'chicken thighs'],
  aubergine: ['egg plants', 'egg plant', 'aubergines'],
  pasta: ['macaroni', 'lasagne sheets', 'farfalle', 'tagliatelle', 'pappardelle', 'orzo'],
  lemon: ['lemon zest', 'zest of lemon', 'lemon rind'],
  lime: ['lime zest'],
  orange: ['orange zest', 'orange juice'],
  sriracha: ['hotsauce', 'tabasco sauce', 'tabasco'],
  lamb: ['lamb leg', 'leg of lamb', 'lamb shoulder', 'lamb shanks', 'lamb loin chops'],
  'red chilli': ['red chillies', 'dried red chilli'],
  'plain flour': ['self-raising flour', 'self raising flour', 'strong white bread flour', 'bread flour'],
  sugar: ['granulated sugar', 'icing sugar', 'muscovado sugar', 'dark brown sugar', 'light brown sugar', 'demerara sugar'],
  'double cream': ['single cream', 'whipping cream', 'thickened cream'],
  'basmati rice': ['long grain rice', 'arborio rice', 'risotto rice', 'paella rice'],
  'chopped tomatoes': ['plum tomatoes', 'tinned tomatoes', 'canned tomatoes'],
  'vegetable oil': ['oil', 'canola oil', 'groundnut oil', 'peanut oil', 'cooking oil'],
};

const CATEGORY_LABELS: Record<FoodCategoryKind, string> = { Protein: 'Protein', Veg: 'Vegetables', Dairy: 'Dairy & alternatives', Pantry: 'Pantry', Produce: 'Fruit, herbs & aromatics' };

const titleCase = (s: string) => s.replace(/(^|\s|-)\S/g, (m) => m.toUpperCase());

async function seedFoods() {
  const categories = new Map<FoodCategoryKind, string>();
  for (const kind of Object.keys(CATEGORY_LABELS) as FoodCategoryKind[]) {
    const c = await prisma.foodCategory.upsert({ where: { kind }, create: { kind, label: CATEGORY_LABELS[kind] }, update: { label: CATEGORY_LABELS[kind] } });
    categories.set(kind, c.id);
  }
  let count = 0;
  const ALL_FOODS = [...FOODS, ...MORE_FOODS];
  // An alias equal to a food name is stale (e.g. "stock" became its own food).
  await prisma.foodAlias.deleteMany({ where: { alias: { in: ALL_FOODS.map((f) => f[0]) } } });
  for (const [name, category, unit, shelf, allergens, kcal, protein, carbs, fat, aliases = []] of ALL_FOODS) {
    const food = await prisma.food.upsert({
      where: { name },
      create: { name, displayName: titleCase(name), categoryId: categories.get(category)!, defaultUnit: unit, shelfLifeDays: shelf, allergens, isDairy: allergens.includes('dairy'), isAnimal: category === 'Protein' && !['chickpeas', 'white beans', 'black beans', 'kidney beans', 'red lentils', 'green lentils', 'tofu', 'tempeh', 'edamame'].includes(name), kcal, proteinG: protein, carbsG: carbs, fatG: fat, nutritionSource: 'usda' },
      update: { displayName: titleCase(name), categoryId: categories.get(category)!, defaultUnit: unit, shelfLifeDays: shelf, allergens, kcal, proteinG: protein, carbsG: carbs, fatG: fat },
    });
    for (const alias of aliases) {
      await prisma.foodAlias.upsert({ where: { alias }, create: { alias, foodId: food.id }, update: { foodId: food.id } });
    }
    count++;
  }
  for (const [foodName, aliases] of Object.entries(ALIAS_PATCH)) {
    const food = await prisma.food.findUnique({ where: { name: foodName } });
    if (!food) continue;
    for (const alias of aliases) await prisma.foodAlias.upsert({ where: { alias }, create: { alias, foodId: food.id }, update: { foodId: food.id } });
  }
  console.log(`foods: ${count}`);
}

/* ------------------------------------------------------------------ creators + recipes */
interface CreatorSeed { email: string; firstName: string; lastName: string; handle: string; bio: string; avatarIndex: number }
const CREATORS: CreatorSeed[] = [
  { email: 'nadia@creators.fridgr.app', firstName: 'Nadia', lastName: 'Benali', handle: 'nadiacooks', bio: 'Levantine • bowls that travel', avatarIndex: 1 },
  { email: 'sofia@creators.fridgr.app', firstName: 'Sofia', lastName: 'Marchetti', handle: 'sofiacooks', bio: 'Fitness-focused foodie', avatarIndex: 3 },
  { email: 'eleni@creators.fridgr.app', firstName: 'Eleni', lastName: 'Papadakis', handle: 'elenieats', bio: 'Greek home cooking', avatarIndex: 4 },
  { email: 'sam@creators.fridgr.app', firstName: 'Sam', lastName: 'Okafor', handle: 'kitchenbysam', bio: 'Crispy things, glossy sauces', avatarIndex: 5 },
];

interface RecipeSeed {
  key: string; author: string; title: string; description: string; imageUrl: string; tone: 'cream' | 'sage' | 'blush'; prepTimeMin: number; kcal: number; proteinG: number; carbsG: number; fatG: number; servings: number;
  effort: 'Easy' | 'Medium' | 'Cheffy'; style: 'Bowl' | 'Traybake' | 'Salad'; cuisine: string; likes: number; comments: number;
  ingredients: Array<[name: string, amount: string, optional?: boolean]>;
  steps: Array<{ phase: string; instruction: string; timerSec?: number; ingredients: string[] }>;
  imported?: { platform: string; url: string; creatorHandle: string; viewsLabel: string };
}

const RECIPES: RecipeSeed[] = [
  {
    key: 'harissa-chicken-bowl', author: 'nadiacooks', title: 'Harissa chicken & charred pepper bowl', description: 'The bowl that got me through marathon training. Charring the peppers is the whole trick.', imageUrl: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=900&q=80', tone: 'cream', prepTimeMin: 25, kcal: 540, proteinG: 42, carbsG: 38, fatG: 21, servings: 2, effort: 'Easy', style: 'Bowl', cuisine: 'Levantine', likes: 1200, comments: 184,
    ingredients: [['Chicken breast', '450 g'], ['Red peppers', '3 pcs'], ['Brown rice', '200 g'], ['Greek yoghurt', '4 tbsp'], ['Spring onion', '2 stalks'], ['Olive oil', '2 tbsp'], ['Garlic', '3 cloves'], ['Harissa paste', '2 tbsp'], ['Lemon', '1 pc']],
    steps: [
      { phase: 'PREP', instruction: 'Pat the chicken dry, then rub with harissa, oil and salt. Let it sit while the pan heats.', ingredients: ['Chicken breast', 'Harissa', 'Olive oil'] },
      { phase: 'SEAR', instruction: 'Sear the chicken 4 minutes a side in a hot dry pan until deeply coloured. Do not move it around.', timerSec: 240, ingredients: ['Chicken breast'] },
      { phase: 'CHAR', instruction: 'Add the peppers cut-side down. Char hard for 5 minutes until blistered at the edges.', timerSec: 300, ingredients: ['Red peppers'] },
      { phase: 'RICE', instruction: 'Warm the rice through with lemon zest and a splash of the pan juices.', ingredients: ['Brown rice', 'Lemon'] },
      { phase: 'REST', instruction: 'Rest the chicken 3 minutes, then slice thick against the grain.', timerSec: 180, ingredients: ['Chicken breast'] },
      { phase: 'PLATE', instruction: 'Build the bowl: rice, peppers, chicken, yoghurt, spring onion. Squeeze over lemon.', ingredients: ['Greek yoghurt', 'Spring onion'] },
    ],
  },
  {
    key: 'yoghurt-chilli-eggs', author: 'sofiacooks', title: 'Ten-minute yoghurt chilli eggs', description: 'Turkish-style eggs on garlicky yoghurt. The whole thing is faster than toast.', imageUrl: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=900&q=80', tone: 'cream', prepTimeMin: 10, kcal: 380, proteinG: 26, carbsG: 14, fatG: 22, servings: 1, effort: 'Easy', style: 'Bowl', cuisine: 'Turkish', likes: 640, comments: 52,
    ingredients: [['Eggs', '3 pcs'], ['Greek yoghurt', '150 g'], ['Garlic', '1 clove'], ['Olive oil', '1 tbsp'], ['Sourdough', '2 slices', true]],
    steps: [
      { phase: 'PREP', instruction: 'Grate the garlic into the yoghurt with a pinch of salt and spread it over a warm plate.', ingredients: ['Greek yoghurt', 'Garlic'] },
      { phase: 'FRY', instruction: 'Fry the eggs in hot oil until the edges are crisp and lacy but the yolks still run.', timerSec: 180, ingredients: ['Eggs', 'Olive oil'] },
      { phase: 'SIZZLE', instruction: 'Warm the remaining oil with a big pinch of chilli flakes for 30 seconds.', timerSec: 30, ingredients: ['Olive oil'] },
      { phase: 'PLATE', instruction: 'Slide the eggs onto the yoghurt, spoon over the chilli oil and eat with toasted sourdough.', ingredients: ['Eggs', 'Sourdough'] },
    ],
  },
  {
    key: 'spinach-feta-lemon-rice', author: 'elenieats', title: 'Spinach, feta & lemon rice', description: 'A one-pan Greek spanakorizo. Wilts a whole bag of spinach into something you actually want to eat.', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&q=80', tone: 'sage', prepTimeMin: 30, kcal: 470, proteinG: 19, carbsG: 52, fatG: 18, servings: 2, effort: 'Easy', style: 'Traybake', cuisine: 'Greek', likes: 410, comments: 37,
    ingredients: [['Spinach', '180 g'], ['Feta cheese', '150 g'], ['Brown rice', '200 g'], ['Spring onion', '3 stalks'], ['Garlic', '2 cloves'], ['Olive oil', '3 tbsp'], ['Lemon', '1 pc']],
    steps: [
      { phase: 'SOFTEN', instruction: 'Soften the spring onion and garlic in olive oil over a low heat for 3 minutes.', timerSec: 180, ingredients: ['Spring onion', 'Garlic', 'Olive oil'] },
      { phase: 'TOAST', instruction: 'Stir in the rice and toast it for a minute so every grain is coated.', timerSec: 60, ingredients: ['Brown rice'] },
      { phase: 'SIMMER', instruction: 'Add 500 ml of water and a pinch of salt. Cover and simmer for 20 minutes.', timerSec: 1200, ingredients: ['Brown rice'] },
      { phase: 'WILT', instruction: 'Fold in the spinach in handfuls until it collapses, then rest off the heat for 5 minutes.', timerSec: 300, ingredients: ['Spinach'] },
      { phase: 'PLATE', instruction: 'Crumble over the feta, add lemon zest and juice, and a final glug of oil.', ingredients: ['Feta cheese', 'Lemon'] },
    ],
  },
  {
    key: 'crispy-chickpea-salad', author: 'nadiacooks', title: 'Crispy chickpea power salad', description: 'Roasted chickpeas add the crunch; the feta and peppers do the rest.', imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&q=80', tone: 'sage', prepTimeMin: 15, kcal: 410, proteinG: 22, carbsG: 45, fatG: 14, servings: 2, effort: 'Easy', style: 'Salad', cuisine: 'Levantine', likes: 880, comments: 61,
    ingredients: [['Chickpeas', '400 g tin'], ['Cherry tomatoes', '250 g'], ['Spinach', '100 g'], ['Red peppers', '1 pc'], ['Feta cheese', '80 g'], ['Olive oil', '2 tbsp'], ['Garlic', '1 clove']],
    steps: [
      { phase: 'ROAST', instruction: 'Dry the chickpeas well, toss with oil, salt and paprika, and roast at 220°C for 12 minutes until crisp.', timerSec: 720, ingredients: ['Chickpeas', 'Olive oil'] },
      { phase: 'CHOP', instruction: 'Halve the tomatoes and dice the pepper while the chickpeas roast.', ingredients: ['Cherry tomatoes', 'Red peppers'] },
      { phase: 'DRESS', instruction: 'Whisk the grated garlic with oil, lemon and salt for a sharp dressing.', ingredients: ['Garlic', 'Olive oil'] },
      { phase: 'PLATE', instruction: 'Toss the spinach with the dressing, pile on the veg, chickpeas and crumbled feta.', ingredients: ['Spinach', 'Feta cheese'] },
    ],
  },
  {
    key: 'miso-butter-salmon', author: 'kitchenbysam', title: 'Miso butter salmon traybake', description: 'Everything on one tray. The miso butter does all the work.', imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=900&q=80', tone: 'blush', prepTimeMin: 28, kcal: 610, proteinG: 45, carbsG: 20, fatG: 34, servings: 2, effort: 'Cheffy', style: 'Traybake', cuisine: 'Japanese', likes: 2300, comments: 240,
    imported: { platform: 'tiktok', url: 'https://www.tiktok.com/@kitchenbysam/video/7311', creatorHandle: '@kitchenbysam', viewsLabel: '2.1M views' },
    ingredients: [['Salmon fillets', '2 pcs'], ['Miso', '1 tbsp'], ['Butter', '30 g'], ['Red peppers', '2 pcs'], ['Spring onion', '3 stalks'], ['Brown rice', '200 g'], ['Garlic', '2 cloves']],
    steps: [
      { phase: 'MIX', instruction: 'Mash the miso into the soft butter with the grated garlic.', ingredients: ['Miso', 'Butter', 'Garlic'] },
      { phase: 'TRAY', instruction: 'Spread the peppers over a tray, sit the salmon on top and dot everything with miso butter.', ingredients: ['Red peppers', 'Salmon fillets'] },
      { phase: 'ROAST', instruction: 'Roast at 200°C for 14 minutes until the salmon flakes and the butter has bubbled.', timerSec: 840, ingredients: ['Salmon fillets'] },
      { phase: 'PLATE', instruction: 'Serve over rice with the tray juices and a shower of spring onion.', ingredients: ['Brown rice', 'Spring onion'] },
    ],
  },
  {
    key: 'tomato-white-bean-braise', author: 'elenieats', title: 'Tomato & white bean braise', description: 'Beans, tomatoes and garlic cooked down into something you mop up with sourdough.', imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=900&q=80', tone: 'blush', prepTimeMin: 22, kcal: 360, proteinG: 18, carbsG: 48, fatG: 10, servings: 2, effort: 'Easy', style: 'Bowl', cuisine: 'Italian', likes: 350, comments: 24,
    ingredients: [['Cherry tomatoes', '250 g'], ['White beans', '400 g tin'], ['Garlic', '3 cloves'], ['Olive oil', '3 tbsp'], ['Spinach', '80 g'], ['Sourdough', '2 slices']],
    steps: [
      { phase: 'SIZZLE', instruction: 'Slice the garlic and fry gently in the oil until golden at the edges.', timerSec: 120, ingredients: ['Garlic', 'Olive oil'] },
      { phase: 'BURST', instruction: 'Add the tomatoes and cook until they burst and turn jammy, about 8 minutes.', timerSec: 480, ingredients: ['Cherry tomatoes'] },
      { phase: 'BRAISE', instruction: 'Tip in the beans with their liquid, season, and simmer 6 minutes.', timerSec: 360, ingredients: ['White beans'] },
      { phase: 'PLATE', instruction: 'Wilt in the spinach and serve with toasted sourdough rubbed with garlic.', ingredients: ['Spinach', 'Sourdough'] },
    ],
  },
  {
    key: 'gochujang-salmon-bowl', author: 'kitchenbysam', title: 'Crispy gochujang salmon rice bowl', description: 'Crispy-skinned salmon glazed in gochujang over rice with a jammy egg.', imageUrl: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=900&q=80', tone: 'cream', prepTimeMin: 24, kcal: 640, proteinG: 41, carbsG: 58, fatG: 24, servings: 2, effort: 'Medium', style: 'Bowl', cuisine: 'Korean', likes: 3100, comments: 412,
    imported: { platform: 'tiktok', url: 'https://www.tiktok.com/@kitchenbysam/video/7421', creatorHandle: '@kitchenbysam', viewsLabel: '2.1M views' },
    ingredients: [['Salmon fillets', '2 pcs'], ['Brown rice', '300 g'], ['Gochujang', '2 tbsp'], ['Mirin', '1 tbsp'], ['Spring onion', '3 stalks'], ['Sesame oil', '1 tsp'], ['Eggs', '2 pcs'], ['Garlic', '2 cloves'], ['Olive oil', '1 tbsp']],
    steps: [
      { phase: 'GLAZE', instruction: 'Whisk the gochujang, mirin, sesame oil and grated garlic into a glossy glaze.', ingredients: ['Gochujang', 'Mirin', 'Sesame oil', 'Garlic'] },
      { phase: 'EGGS', instruction: 'Lower the eggs into boiling water for 7 minutes, then straight into cold water.', timerSec: 420, ingredients: ['Eggs'] },
      { phase: 'SEAR', instruction: 'Salmon skin-side down in a hot oiled pan. Press flat and leave it for 4 minutes until the skin is shatteringly crisp.', timerSec: 240, ingredients: ['Salmon fillets', 'Olive oil'] },
      { phase: 'FLIP', instruction: 'Flip, brush on the glaze and cook 2 more minutes until sticky.', timerSec: 120, ingredients: ['Salmon fillets'] },
      { phase: 'RICE', instruction: 'Fluff the rice with a splash of the leftover glaze.', ingredients: ['Brown rice'] },
      { phase: 'PLATE', instruction: 'Rice, salmon, halved egg, spring onion. Spoon over any glaze left in the pan.', ingredients: ['Spring onion', 'Eggs'] },
    ],
  },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const singular = (w: string) => (w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.endsWith('oes') ? w.slice(0, -2) : w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

async function findFood(name: string) {
  const n = norm(name);
  const cands = [n, singular(n), n.split(' ').map(singular).join(' ')];
  const direct = await prisma.food.findFirst({ where: { name: { in: cands } } });
  if (direct) return direct;
  const alias = await prisma.foodAlias.findFirst({ where: { alias: { in: cands } }, include: { food: true } });
  return alias?.food ?? null;
}

async function seedCreatorsAndRecipes() {
  const creatorIds = new Map<string, string>();
  for (const c of CREATORS) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      create: { email: c.email, emailVerified: true, name: `${c.firstName} ${c.lastName}`, firstName: c.firstName, lastName: c.lastName, handle: c.handle, profile: { create: { bio: c.bio, avatarIndex: c.avatarIndex, onboardedAt: new Date() } }, foodProfile: { create: {} }, shoppingLists: { create: {} } },
      update: { firstName: c.firstName, lastName: c.lastName, profile: { upsert: { create: { bio: c.bio, avatarIndex: c.avatarIndex }, update: { bio: c.bio, avatarIndex: c.avatarIndex } } } },
    });
    creatorIds.set(c.handle, user.id);
  }
  console.log(`creators: ${creatorIds.size}`);

  for (const r of RECIPES) {
    const authorId = creatorIds.get(r.author)!;
    const existing = await prisma.recipe.findFirst({ where: { authorId, title: r.title }, select: { id: true } });
    if (existing) {
      console.log(`recipe exists: ${r.title}`);
      continue;
    }
    const resolved = await Promise.all(r.ingredients.map(([name]) => findFood(name)));
    const allergens = new Set<string>();
    let dairy = false;
    resolved.forEach((f) => {
      f?.allergens.forEach((a) => allergens.add(a));
      if (f?.isDairy) dairy = true;
    });
    const recipe = await prisma.recipe.create({
      data: {
        authorId, origin: 'seeded', visibility: 'public', title: r.title, description: r.description, imageUrl: r.imageUrl, tone: r.tone, cuisine: r.cuisine, effort: r.effort, style: r.style, prepTimeMin: r.prepTimeMin, servings: r.servings,
        kcal: r.kcal, proteinG: r.proteinG, carbsG: r.carbsG, fatG: r.fatG, nutritionSource: 'ai_estimate', nutritionConfidence: 0.7, allergens: [...allergens], isDairyFree: !dairy, likesCount: r.likes, commentsCount: 0, publishedAt: new Date(),
        ingredients: { create: r.ingredients.map(([name, amount, optional], idx) => ({ name, amount, isOptional: !!optional, position: idx, foodId: resolved[idx]?.id })) },
        steps: { create: r.steps.map((s, idx) => ({ stepNumber: idx + 1, phase: s.phase, instruction: s.instruction, timerSec: s.timerSec, ingredients: s.ingredients })) },
      },
    });
    if (r.imported) {
      const source = await prisma.socialImportSource.upsert({ where: { url: r.imported.url }, create: { platform: r.imported.platform, url: r.imported.url, creatorHandle: r.imported.creatorHandle, title: r.title, viewsLabel: r.imported.viewsLabel }, update: {} });
      await prisma.importedRecipe.create({ data: { recipeId: recipe.id, userId: authorId, sourceId: source.id, method: 'pasted_text' } });
    }
    console.log(`recipe: ${r.title}`);
  }
}

/* ------------------------------------------------------------------ App Review demo account */
async function seedDemoAccount() {
  const email = process.env.SEED_DEMO_EMAIL ?? 'review@fridgr.app';
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error('Set SEED_DEMO_PASSWORD in server/.env (App Review demo account password).');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, emailVerified: true, name: 'Alex Reviewer', firstName: 'Alex', lastName: 'Reviewer', handle: 'alexreviews', profile: { create: { bio: 'App Review demo', avatarIndex: 2, onboardedAt: new Date(), cookingTimeMin: 30, household: 'pair' } }, foodProfile: { create: { mainGoal: 'waste', eatingStyle: 'balanced', skill: 'home', cookTime: '30', cuisines: { create: [{ cuisine: 'japanese' }, { cuisine: 'levantine' }] } } }, shoppingLists: { create: {} } },
    update: { emailVerified: true, name: 'Alex Reviewer' },
  });
  // Better Auth keeps the password on a "credential" account (argon2id, same as the API).
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: user.id } },
    create: { accountId: user.id, providerId: 'credential', userId: user.id, password: passwordHash },
    update: { password: passwordHash },
  });
  const fridge: Array<[string, 'Protein' | 'Veg' | 'Dairy' | 'Pantry' | 'Produce', number, string, number]> = [
    ['Chicken breast', 'Protein', 450, 'g', 5], ['Greek yoghurt', 'Dairy', 500, 'g', 2], ['Red peppers', 'Veg', 3, 'pcs', 4], ['Spinach', 'Veg', 180, 'g', 2], ['Brown rice', 'Pantry', 1000, 'g', 30], ['Eggs', 'Protein', 8, 'pcs', 12],
    ['Cherry tomatoes', 'Produce', 250, 'g', 6], ['Feta cheese', 'Dairy', 200, 'g', 8], ['Spring onion', 'Produce', 1, 'pcs', 3], ['Olive oil', 'Pantry', 500, 'ml', 90], ['Garlic', 'Produce', 1, 'pcs', 14], ['Sourdough', 'Pantry', 1, 'pcs', 4],
  ];
  const have = await prisma.fridgeItem.count({ where: { userId: user.id } });
  if (have === 0) {
    for (const [name, category, quantity, unit, days] of fridge) {
      const food = await findFood(name);
      await prisma.fridgeItem.create({ data: { userId: user.id, foodId: food?.id, name, category, quantity, unit, expiresAt: new Date(Date.now() + days * 86_400_000) } });
    }
    const list = await prisma.shoppingList.findFirstOrThrow({ where: { userId: user.id, isDefault: true } });
    const shopping: Array<[string, 'PRODUCE' | 'PANTRY_SPICE', string, string, number]> = [
      ['Lemons', 'PRODUCE', '2 pcs', 'For the harissa bowl', 1.2], ['Flat-leaf parsley', 'PRODUCE', '1 bunch', 'Garnish', 1.2], ['Harissa paste', 'PANTRY_SPICE', '1 jar', 'Missing • 2 recipes', 3.2], ['Gochujang', 'PANTRY_SPICE', '1 tub', 'From imported recipe', 4.5],
    ];
    for (const [name, category, amount, source, estPrice] of shopping) {
      const food = await findFood(name);
      await prisma.shoppingItem.create({ data: { listId: list.id, foodId: food?.id, name, category, amount, source, estPrice } });
    }
    await prisma.notification.createMany({
      data: [
        { userId: user.id, kind: 'expiry', title: 'Spinach expires in 2 days', body: 'Three recipes use it up tonight — tap to see them.', link: '/recipe/results?use=Spinach' },
        { userId: user.id, kind: 'plan', title: 'Your weekly meal plan is ready', body: '6 dinners built around what is already in your fridge.', link: '/recipe/results' },
      ],
    });
  }
  console.log(`demo account: ${email} (password: SEED_DEMO_PASSWORD from server/.env)`);
}

async function main() {
  await seedFoods();
  await seedCreatorsAndRecipes();
  await seedDemoAccount();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
