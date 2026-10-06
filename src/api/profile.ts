import { api } from './client';
import type { ServerUser } from './types';
import type { FoodProfile } from '../types';

export interface ProfilePatch {
  bio?: string;
  avatarIndex?: number;
  age?: number | null;
  theme?: 'light' | 'dark';
  household?: 'solo' | 'pair' | 'family' | 'large' | 'shared' | null;
  defaultServings?: number;
  cookingTimeMin?: number;
  skillLevel?: 'beginner' | 'home' | 'confident' | 'chef' | null;
  equipment?: string[];
  shoppingHabit?: 'weekly' | 'often' | 'asneeded' | null;
  recipeSources?: string[];
  notifPrefs?: Partial<{ expiry: boolean; plan: boolean; creators: boolean }>;
  onboarded?: boolean;
}

export type FoodProfilePut = Partial<Omit<FoodProfile, 'signals'>>;

export interface SignalInput {
  kind: 'viewed' | 'saved' | 'unsaved' | 'cooked' | 'skipped' | 'rated' | 'liked' | 'searched' | 'ingredient_used' | 'ingredient_rejected';
  recipeId?: string;
  foodId?: string;
  cuisine?: string;
  value?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const profileApi = {
  patch: (patch: ProfilePatch) => api.patch<{ user: ServerUser }>('/profile', patch).then((r) => r.user),
  putFoodProfile: (fp: FoodProfilePut) => api.put<{ user: ServerUser }>('/food-profile', fp).then((r) => r.user),
  updateAccount: (patch: { firstName?: string; lastName?: string }) => api.patch<{ user: ServerUser }>('/users/me', patch).then((r) => r.user),
  /** Batched, fire-and-forget. Mock recipe ids (r1…) are dropped: only server UUIDs are meaningful. */
  sendSignals: (signals: SignalInput[]) => {
    const clean = signals.map((s) => ({ ...s, recipeId: s.recipeId && UUID_RE.test(s.recipeId) ? s.recipeId : undefined }));
    return api.post('/food-profile/signals', { signals: clean });
  },
};

/** Debounced signal queue so a burst of taps becomes one request. */
let queue: SignalInput[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
export function queueSignal(signal: SignalInput) {
  queue.push(signal);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const batch = queue.splice(0, 50);
    timer = null;
    if (batch.length) profileApi.sendSignals(batch).catch(() => undefined);
  }, 1500);
}
