import type { FoodProfile } from '../types';

/** `GET /users/me` — mirrors `serializeUser` on the server. */
export interface ServerUser {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  name: string;
  handle: string;
  bio: string;
  age?: number;
  avatarIndex: number;
  theme: 'light' | 'dark';
  household?: 'solo' | 'pair' | 'family' | 'large' | 'shared';
  cookingTimeMin: number;
  skillLevel?: 'beginner' | 'home' | 'confident' | 'chef';
  equipment: string[];
  shoppingHabit?: 'weekly' | 'often' | 'asneeded';
  recipeSources: string[];
  notifPrefs: { expiry: boolean; plan: boolean; creators: boolean };
  streakDays: number;
  savedCount: number;
  publishedCount: number;
  followersCount: number;
  followingCount: number;
  hasOnboarded: boolean;
  isPremium: boolean;
  subscription: { isActive: boolean; isTrial: boolean; status: string; productId: string | null; currentPeriodEnd: string | null; willRenew: boolean } | null;
  foodProfile: (Omit<FoodProfile, 'signals'> & { updatedAt?: string }) | null;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSec: number;
}

export interface AuthResponse {
  user: ServerUser;
  tokens: TokenPair;
  created?: boolean;
}
