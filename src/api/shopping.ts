import { api } from './client';
import type { ShoppingItem } from '../types';

export interface ShoppingItemInput {
  name: string;
  category?: 'PRODUCE' | 'PANTRY_SPICE';
  amount?: string;
  source?: string;
  sourceRecipeId?: string;
  estPrice?: number;
}

export const toServerCategory = (c: string): 'PRODUCE' | 'PANTRY_SPICE' => (c === 'PRODUCE' ? 'PRODUCE' : 'PANTRY_SPICE');

export const shoppingApi = {
  list: () => api.get<{ listId: string; items: ShoppingItem[] }>('/shopping').then((r) => r.items),
  add: (items: ShoppingItemInput[]) => api.post<{ items: ShoppingItem[] }>('/shopping/items', { items }).then((r) => r.items),
  fromRecipe: (recipeId: string) => api.post<{ addedCount: number; items: ShoppingItem[] }>(`/shopping/from-recipe/${recipeId}`),
  update: (id: string, patch: Partial<ShoppingItemInput> & { isChecked?: boolean }) => api.patch<{ item: ShoppingItem }>(`/shopping/items/${id}`, patch).then((r) => r.item),
  remove: (id: string) => api.delete(`/shopping/items/${id}`),
  clearChecked: () => api.post('/shopping/clear-checked'),
  clear: () => api.delete('/shopping'),
};
