import { api } from './client';
import type { FridgeCategory, FridgeItem } from '../types';

export interface ServerFridgeItem extends FridgeItem {
  quantityValue: number;
  unit: string;
  expiresAt: string | null;
  addedVia: string;
  scanConfidence: number | null;
  foodId: string | null;
}

export interface FridgeItemInput {
  name: string;
  category?: FridgeCategory;
  quantity?: number;
  unit?: string;
  daysToExpiry?: number;
  addedVia?: 'manual' | 'scan' | 'import';
  scanConfidence?: number;
}

export interface ScanCandidate {
  name: string;
  category: FridgeCategory;
  quantity: number;
  unit: string;
  confidence: number;
  daysToExpiry: number;
  foodId?: string;
  brand?: string;
  notes?: string;
  suggested: boolean;
}

/** "450 g" → { quantity: 450, unit: 'g' }; "3 pcs" → { 3, 'pcs' }; "1 bunch" → { 1, 'bunch' }. */
export const parseQuantity = (q: string): { quantity: number; unit: string } => {
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { quantity: 1, unit: 'pcs' };
  const n = parseFloat(m[1].replace(',', '.'));
  const unit = (m[2] || 'pcs').trim().toLowerCase().replace(/^pieces?$/, 'pcs').slice(0, 12);
  if (unit === 'kg') return { quantity: n * 1000, unit: 'g' };
  if (unit === 'l') return { quantity: n * 1000, unit: 'ml' };
  return { quantity: n, unit };
};

export const fridgeApi = {
  list: () => api.get<{ items: ServerFridgeItem[] }>('/fridge').then((r) => r.items),
  add: (items: FridgeItemInput[]) => api.post<{ added: ServerFridgeItem[]; items: ServerFridgeItem[] }>('/fridge/items', { items }),
  update: (id: string, patch: Partial<FridgeItemInput>) => api.patch<{ item: ServerFridgeItem }>(`/fridge/items/${id}`, patch).then((r) => r.item),
  remove: (id: string) => api.delete(`/fridge/items/${id}`),
  clear: () => api.delete('/fridge'),

  uploadUrl: (ext: 'jpg' | 'png' | 'webp' = 'jpg') => api.post<{ upload: { key: string; url: string; contentType: string; method: 'PUT' } | null; inline: boolean; maxBytes?: number }>('/fridge/scan/upload-url', { ext }),
  scan: (input: { imageKey?: string; imageBase64?: string; mediaType?: 'image/jpeg' | 'image/png' | 'image/webp'; detailed?: boolean }) => api.post<{ scanId: string; isFood: boolean; sceneNote?: string; items: ScanCandidate[] }>('/fridge/scan', input),
  confirmScan: (scanId: string | undefined, items: Array<{ name: string; category?: FridgeCategory; quantity: number; unit: string; daysToExpiry?: number; confidence?: number }>) =>
    api.post<{ added: number; merged: number; items: ServerFridgeItem[] }>('/fridge/scan/confirm', { scanId, items }),
};
