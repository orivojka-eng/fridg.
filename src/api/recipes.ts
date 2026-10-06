import { api, ApiError, request } from './client';
import type { Recipe, RecipeEffort, RecipeStyle, Collection } from '../types';

export type ImportFoundVia = 'page_data' | 'linked_page' | 'video' | 'user_video' | 'screenshots' | 'caption' | 'pasted_text';

/** Server recipe = app `Recipe` plus per-user flags and fridge match. */
export interface ServerRecipe extends Recipe {
  authorId?: string;
  authorAvatarIndex?: number;
  origin?: 'seeded' | 'user_created' | 'ai_generated' | 'imported' | 'adapted';
  visibility?: 'private' | 'public';
  allergens?: string[];
  nutritionSource?: string;
  isSaved?: boolean;
  isLiked?: boolean;
  myRating?: number | null;
  matchPercent?: number;
  missingCount?: number;
  saves?: number;
  videoUrl?: string;
  externalSource?: string;
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatarIndex: number;
  publishedCount: number;
  followersCount: number;
  isFollowing: boolean;
}

export interface RecipeComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; handle: string; avatarIndex: number };
}

type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'rejected';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls a job endpoint until done/failed. Throws ApiError on failure or timeout. */
async function poll<T extends { status: JobStatus; error?: string }>(path: string, opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  const started = Date.now();
  const interval = opts.intervalMs ?? 1500;
  for (;;) {
    if (opts.signal?.aborted) throw new ApiError(0, 'INTERNAL', 'Cancelled.');
    const res = await api.get<T>(path, opts.signal);
    if (res.status === 'done') return res;
    if (res.status === 'failed' || res.status === 'rejected') throw new ApiError(502, 'UPSTREAM', res.error ?? 'That did not work. Try again.');
    if (Date.now() - started > (opts.timeoutMs ?? 90_000)) throw new ApiError(504, 'UPSTREAM', 'Taking longer than expected. Try again in a moment.');
    await sleep(interval);
  }
}

export const recipesApi = {
  catalog: (limit = 60) => api.get<{ recipes: ServerRecipe[]; nextCursor: string | null }>(`/recipes/catalog?limit=${limit}`),
  saved: () => api.get<{ recipes: ServerRecipe[] }>('/recipes/saved').then((r) => r.recipes),
  mine: () => api.get<{ recipes: ServerRecipe[] }>('/recipes/mine').then((r) => r.recipes),
  get: (id: string) => api.get<{ recipe: ServerRecipe }>(`/recipes/${id}`).then((r) => r.recipe),
  create: (input: object) => api.post<{ recipe: ServerRecipe }>('/recipes', input).then((r) => r.recipe),
  update: (id: string, input: object) => api.patch<{ recipe: ServerRecipe }>(`/recipes/${id}`, input).then((r) => r.recipe),
  remove: (id: string) => api.delete(`/recipes/${id}`),
  save: (id: string) => api.post(`/recipes/${id}/save`),
  unsave: (id: string) => api.delete(`/recipes/${id}/save`),
  rate: (id: string, rating: number, note?: string) => api.post<{ ratingAvg: number | null; ratingCount: number }>(`/recipes/${id}/rate`, { rating, note }),

  /** Starts generation and polls until the recipes exist. */
  async generate(input: { prompt: string; ingredientNames: string[]; servings: number; effort: RecipeEffort; style?: RecipeStyle; count?: number }, signal?: AbortSignal) {
    const { jobId } = await api.post<{ jobId: string }>('/recipes/generate', input);
    const res = await poll<{ status: JobStatus; error?: string; recipes?: ServerRecipe[] }>(`/recipes/generate/${jobId}`, { signal });
    return res.recipes ?? [];
  },

  async adapt(id: string, input: { swaps?: { from: string; to: string }[]; boost?: 'protein' | 'lighter' | 'faster' | 'vegetarian' | 'dairy_free'; servings?: number; note?: string }, signal?: AbortSignal) {
    const { jobId } = await api.post<{ jobId: string }>(`/recipes/${id}/adapt`, input);
    const res = await poll<{ status: JobStatus; error?: string; recipe?: ServerRecipe }>(`/recipes/adapt/${jobId}`, { signal });
    if (!res.recipe) throw new ApiError(502, 'UPSTREAM', 'No adapted recipe came back.');
    return res.recipe;
  },

  /** Uploads one saved video or screenshot for a media import; returns its upload id. */
  async uploadImportMedia(uri: string, mimeType: string) {
    const blob = await (await fetch(uri)).blob();
    const res = await request<{ uploadId: string; kind: 'video' | 'image' }>('/recipes/import/uploads', { method: 'POST', raw: blob, contentType: mimeType });
    return res.uploadId;
  },

  async importRecipe(input: { url?: string; text?: string; uploadIds?: string[]; servings?: number }, signal?: AbortSignal) {
    const { jobId } = await api.post<{ jobId: string }>('/recipes/import', input);
    // Videos take longer: the model watches the whole clip.
    return poll<{ status: JobStatus; error?: string; found: boolean; needsText?: boolean; reason?: string; recipe?: ServerRecipe; allergenHits?: string[]; foundVia?: ImportFoundVia; linkedRecipeUrl?: string; meta?: { title?: string; author?: string; thumbnailUrl?: string } }>(`/recipes/import/${jobId}`, { signal, timeoutMs: input.uploadIds?.length || /youtu/.test(input.url ?? '') ? 300_000 : 120_000, intervalMs: 2000 });
  },

  /** Searches the recipe library (TheMealDB / Spoonacular); results are cached server-side. */
  searchLibrary: (q: string, ingredient?: string) =>
    api.get<{ recipes: ServerRecipe[] }>(`/recipes/external/search?${new URLSearchParams({ ...(q ? { q } : {}), ...(ingredient ? { ingredient } : {}) })}`).then((x) => x.recipes),

  feed: (tab: 'for-you' | 'trending' | 'following' | 'quick' | 'high-protein') => api.get<{ recipes: ServerRecipe[] }>(`/discover/feed?tab=${tab}`).then((r) => r.recipes),
  search: (q: string) => api.get<{ recipes: ServerRecipe[] }>(`/discover/search?q=${encodeURIComponent(q)}`).then((r) => r.recipes),
  creators: () => api.get<{ creators: Creator[] }>('/discover/creators').then((r) => r.creators),

  like: (id: string) => api.post<{ isLiked: boolean; likes: number }>(`/social/like/${id}`),
  unlike: (id: string) => api.delete<{ isLiked: boolean; likes: number }>(`/social/like/${id}`),
  follow: (userId: string) => api.post(`/social/follow/${userId}`),
  unfollow: (userId: string) => api.delete(`/social/follow/${userId}`),
  following: () => api.get<{ userIds: string[] }>('/social/following').then((r) => r.userIds),
  comments: (recipeId: string) => api.get<{ comments: RecipeComment[] }>(`/social/comments/${recipeId}`).then((r) => r.comments),
  comment: (recipeId: string, body: string) => api.post<{ comment: RecipeComment }>(`/social/comments/${recipeId}`, { body }).then((r) => r.comment),

  collections: () => api.get<{ collections: Collection[] }>('/collections').then((r) => r.collections),
  createCollection: (title: string, tagline?: string) => api.post<{ collection: Collection }>('/collections', { title, tagline }).then((r) => r.collection),
  addToCollection: (collectionId: string, recipeId: string) => api.post(`/collections/${collectionId}/recipes/${recipeId}`),

  startCooking: (recipeId: string) => api.post<{ session: { id: string } }>('/cooking/sessions', { recipeId }).then((r) => r.session),
  completeCooking: (sessionId: string, rating?: number, consumedFridgeItemIds: string[] = []) => api.post<{ streakDays: number }>(`/cooking/sessions/${sessionId}/complete`, { rating, consumedFridgeItemIds }),
};

export const isServerId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);
