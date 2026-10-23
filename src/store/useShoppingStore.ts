import { create } from 'zustand';
import { ShoppingItem, ShoppingCategory, RecipeIngredient } from '../types';
import { namesMatch, normalize } from '../lib/matching';

export interface NewShoppingItem {
  name: string;
  category: ShoppingCategory;
  amount: string;
  source: string;
  estPrice?: number;
  sourceRecipeId?: string;
}

interface ShoppingState {
  items: ShoppingItem[];
  toggleItemCheck: (id: string) => void;
  addItem: (item: NewShoppingItem) => boolean;
  /** Returns how many were actually added (duplicates are skipped). */
  addMultipleItems: (items: NewShoppingItem[]) => number;
  addMissingIngredients: (ingredients: RecipeIngredient[], source: string, sourceRecipeId?: string) => number;
  removeItem: (id: string) => void;
  clearChecked: () => void;
  /** Empty the list (new account). */
  clear: () => void;
  getEstimatedCost: () => number;
  getRemainingCount: () => number;
  hasItem: (name: string) => boolean;
}

const PRODUCE_WORDS = [
  'lemon', 'lime', 'parsley', 'avocado', 'tomato', 'onion', 'garlic', 'pepper', 'spinach', 'herb', 'coriander',
  'basil', 'courgette', 'cucumber', 'apple', 'banana', 'salad', 'leaf', 'mint', 'chilli', 'edamame',
];

export const guessShoppingCategory = (name: string): ShoppingCategory =>
  PRODUCE_WORDS.some((w) => normalize(name).includes(w)) ? 'PRODUCE' : 'PANTRY & SPICE';

const PRICE_GUESS: Record<string, number> = {
  lemon: 0.6, parsley: 1.2, avocado: 1.5, harissa: 3.2, gochujang: 4.5, mirin: 3.9, salmon: 6.5, chickpea: 1.1,
  bean: 1.2, miso: 4.2, butter: 2.4, sesame: 3.0, edamame: 2.6,
};

export const guessPrice = (name: string): number => {
  const n = normalize(name);
  const hit = Object.keys(PRICE_GUESS).find((k) => n.includes(k));
  return hit ? PRICE_GUESS[hit] : 2.5;
};

const mockShoppingItems: ShoppingItem[] = [
  { id: 'sh1', name: 'Lemons', category: 'PRODUCE', amount: '2 pcs', source: 'For the harissa bowl', isChecked: false, estPrice: 1.2 },
  { id: 'sh2', name: 'Flat-leaf parsley', category: 'PRODUCE', amount: '1 bunch', source: 'Garnish', isChecked: false, estPrice: 1.2 },
  { id: 'sh3', name: 'Avocado', category: 'PRODUCE', amount: '2 pcs', source: 'Breakfast', isChecked: false, estPrice: 3.0 },
  { id: 'sh4', name: 'Harissa paste', category: 'PANTRY & SPICE', amount: '1 jar', source: 'Missing • 2 recipes', isChecked: false, estPrice: 3.2 },
  { id: 'sh5', name: 'Gochujang', category: 'PANTRY & SPICE', amount: '1 tub', source: 'From imported recipe', isChecked: false, estPrice: 4.5 },
  { id: 'sh6', name: 'Mirin', category: 'PANTRY & SPICE', amount: '250 ml', source: 'From imported recipe', isChecked: false, estPrice: 3.9 },
];

let counter = 100;

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  items: mockShoppingItems,

  toggleItemCheck: (id) => {
    const next = !get().items.find((i) => i.id === id)?.isChecked;
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, isChecked: next } : item)),
    }));
  },

  addItem: (item) => get().addMultipleItems([item]) > 0,

  addMultipleItems: (newItems) => {
    let added = 0;
    set((state) => {
      const items = [...state.items];
      newItems.forEach((incoming) => {
        if (!incoming.name.trim()) return;
        const existingIdx = items.findIndex((it) => namesMatch(it.name, incoming.name));
        if (existingIdx >= 0) {
          // Un-check it again if it was already bought; the user needs it now.
          items[existingIdx] = { ...items[existingIdx], isChecked: false };
          return;
        }
        added += 1;
        items.push({
          id: `sh${counter++}`,
          name: incoming.name.trim(),
          category: incoming.category,
          amount: incoming.amount,
          source: incoming.source,
          isChecked: false,
          estPrice: incoming.estPrice ?? guessPrice(incoming.name),
        });
      });
      return { items };
    });
    return added;
  },

  addMissingIngredients: (ingredients, source, sourceRecipeId) =>
    get().addMultipleItems(
      ingredients.map((ing) => ({
        name: ing.name,
        category: guessShoppingCategory(ing.name),
        amount: ing.amount,
        source,
        sourceRecipeId,
      })),
    ),

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },
  clearChecked: () => {
    set((state) => ({ items: state.items.filter((item) => !item.isChecked) }));
  },
  clear: () => set({ items: [] }),

  getEstimatedCost: () =>
    get()
      .items.filter((i) => !i.isChecked)
      .reduce((sum, i) => sum + (i.estPrice ?? 0), 0),

  getRemainingCount: () => get().items.filter((i) => !i.isChecked).length,
  hasItem: (name) => get().items.some((i) => namesMatch(i.name, name)),
}));
