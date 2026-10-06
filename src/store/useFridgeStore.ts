import { create } from 'zustand';
import { FridgeItem } from '../types';
import { initialsFor, isExpiring, namesMatch } from '../lib/matching';
import { env } from '../config/env';
import { fridgeApi, parseQuantity, type ServerFridgeItem } from '../api/fridge';

export type NewFridgeItem = Omit<FridgeItem, 'id' | 'initials' | 'addedAt'> & { initials?: string; scanConfidence?: number; addedVia?: 'manual' | 'scan' | 'import' };

interface FridgeState {
  items: FridgeItem[];
  selectedCategory: string;
  lastScannedAt: number | null;
  /** True while the first server load is in flight (backend mode). */
  loading: boolean;
  hydrated: boolean;
  /** Replace local state with the server's fridge (backend mode). */
  hydrate: () => Promise<void>;
  setSelectedCategory: (category: string) => void;
  addItem: (item: NewFridgeItem) => void;
  /** Adds items, merging duplicates (same name) instead of creating a second row. */
  addMultipleItems: (items: NewFridgeItem[]) => { added: number; merged: number };
  removeItem: (id: string) => void;
  removeItems: (ids: string[]) => void;
  updateItem: (id: string, patch: Partial<FridgeItem>) => void;
  markScanned: () => void;
  /** Empty the fridge (new account). */
  clear: () => void;
  getExpiringCount: () => number;
  getFreshCount: () => number;
  getExpiringItems: () => FridgeItem[];
}

const seed = (items: Omit<FridgeItem, 'id' | 'initials' | 'addedAt'>[]): FridgeItem[] =>
  items.map((item, i) => ({
    ...item,
    id: `f${i + 1}`,
    initials: initialsFor(item.name),
    addedAt: Date.now() - (i + 1) * 3_600_000,
  }));

const initialFridgeItems: FridgeItem[] = seed([
  { name: 'Chicken breast', category: 'Protein', quantity: '450 g', daysToExpiry: 5 },
  { name: 'Greek yoghurt', category: 'Dairy', quantity: '500 g', daysToExpiry: 2 },
  { name: 'Red peppers', category: 'Veg', quantity: '3 pcs', daysToExpiry: 4 },
  { name: 'Spinach', category: 'Veg', quantity: '180 g', daysToExpiry: 2 },
  { name: 'Brown rice', category: 'Pantry', quantity: '1 kg', daysToExpiry: 30 },
  { name: 'Eggs', category: 'Protein', quantity: '8 pcs', daysToExpiry: 12 },
  { name: 'Cherry tomatoes', category: 'Produce', quantity: '250 g', daysToExpiry: 6 },
  { name: 'Feta cheese', category: 'Dairy', quantity: '200 g', daysToExpiry: 8 },
  { name: 'Spring onion', category: 'Produce', quantity: '1 bunch', daysToExpiry: 3 },
  { name: 'Olive oil', category: 'Pantry', quantity: '500 ml', daysToExpiry: 90 },
  { name: 'Garlic', category: 'Produce', quantity: '1 bulb', daysToExpiry: 14 },
  { name: 'Sourdough', category: 'Pantry', quantity: '1 loaf', daysToExpiry: 4 },
]);

let idCounter = 100;
const nextId = () => `f${idCounter++}`;

const backend = () => env.USE_BACKEND;

const fromServer = (i: ServerFridgeItem): FridgeItem => ({
  id: i.id,
  name: i.name,
  category: i.category,
  quantity: i.quantity,
  daysToExpiry: i.daysToExpiry,
  initials: initialsFor(i.name),
  addedAt: i.addedAt,
});

/** "2 pcs" + "3 pcs" => "5 pcs"; falls back to the newer quantity when units differ. */
const mergeQuantity = (a: string, b: string) => {
  const pa = a.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  const pb = b.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (pa && pb && pa[2].trim() === pb[2].trim()) {
    const sum = parseFloat(pa[1]) + parseFloat(pb[1]);
    return `${Number.isInteger(sum) ? sum : sum.toFixed(1)} ${pa[2]}`.trim();
  }
  return b;
};

export const useFridgeStore = create<FridgeState>((set, get) => ({
  items: backend() ? [] : initialFridgeItems,
  selectedCategory: 'All',
  lastScannedAt: backend() ? null : Date.now() - 2 * 3_600_000,
  loading: false,
  hydrated: !backend(),

  hydrate: async () => {
    if (!backend()) return;
    set({ loading: true });
    try {
      const items = await fridgeApi.list();
      set({ items: items.map(fromServer), hydrated: true });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedCategory: (category) => set({ selectedCategory: category }),

  addItem: (newItem) => {
    get().addMultipleItems([newItem]);
  },

  addMultipleItems: (newItems) => {
    let added = 0;
    let merged = 0;
    set((state) => {
      const items = [...state.items];
      newItems.forEach((incoming) => {
        const existingIdx = items.findIndex((it) => namesMatch(it.name, incoming.name));
        if (existingIdx >= 0) {
          merged += 1;
          const existing = items[existingIdx];
          items[existingIdx] = {
            ...existing,
            quantity: mergeQuantity(existing.quantity, incoming.quantity),
            // A restock resets the expiry to the fresher of the two.
            daysToExpiry: Math.max(existing.daysToExpiry, incoming.daysToExpiry),
          };
        } else {
          added += 1;
          items.unshift({
            ...incoming,
            id: nextId(),
            initials: incoming.initials || initialsFor(incoming.name),
            addedAt: Date.now(),
          });
        }
      });
      return { items };
    });
    if (backend()) {
      // The server merges by normalised food too; its list replaces the optimistic one.
      fridgeApi
        .add(newItems.map((i) => ({ name: i.name, category: i.category, ...parseQuantity(i.quantity), daysToExpiry: i.daysToExpiry, addedVia: i.addedVia, scanConfidence: i.scanConfidence })))
        .then((res) => set({ items: res.items.map(fromServer) }))
        .catch(() => get().hydrate().catch(() => undefined));
    }
    return { added, merged };
  },

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
    if (backend()) fridgeApi.remove(id).catch(() => get().hydrate().catch(() => undefined));
  },
  removeItems: (ids) => {
    set((state) => ({ items: state.items.filter((item) => !ids.includes(item.id)) }));
    if (backend()) Promise.all(ids.map((id) => fridgeApi.remove(id))).catch(() => get().hydrate().catch(() => undefined));
  },
  updateItem: (id, patch) => {
    set((state) => ({ items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
    if (backend()) {
      const q = patch.quantity ? parseQuantity(patch.quantity) : {};
      fridgeApi.update(id, { name: patch.name, category: patch.category, daysToExpiry: patch.daysToExpiry, ...q }).catch(() => get().hydrate().catch(() => undefined));
    }
  },

  markScanned: () => set({ lastScannedAt: Date.now() }),
  clear: () => set({ items: [], selectedCategory: "All", lastScannedAt: null }),

  getExpiringCount: () => get().items.filter(isExpiring).length,
  getFreshCount: () => get().items.filter((item) => !isExpiring(item)).length,
  getExpiringItems: () => get().items.filter(isExpiring),
}));
