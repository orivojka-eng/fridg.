export type FridgeCategory = 'Protein' | 'Veg' | 'Dairy' | 'Pantry' | 'Produce';
export type ExpiryStatus = 'Fresh' | 'Expiring' | 'Expired';

export interface FridgeItem {
  id: string;
  name: string;
  category: FridgeCategory;
  quantity: string;
  daysToExpiry: number;
  initials?: string;
  addedAt?: number;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  amount: string;
  isOptional?: boolean;
}

export interface RecipeStep {
  stepNumber: number;
  phase: string;
  instruction: string;
  timerSec?: number;
  ingredients: string[];
}

export type RecipeEffort = 'Easy' | 'Medium' | 'Cheffy';
export type RecipeStyle = 'Bowl' | 'Traybake' | 'Salad';
export type ImportSource = 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  imageKey?: string;
  /** Placeholder tint used when there is no image. */
  tone?: 'cream' | 'sage' | 'blush';
  prepTimeMin: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servings?: number;
  authorName?: string;
  authorHandle?: string;
  authorTag?: string;
  authorRating?: string;
  effort?: RecipeEffort;
  style?: RecipeStyle;
  cuisine?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  importedFrom?: ImportSource;
  sourceUrl?: string;
  /** Cooking video (YouTube) for library and imported recipes. */
  videoUrl?: string;
  viewsCount?: string;
  likes?: number;
  comments?: number;
  createdAt?: number;
}

export interface Collection {
  id: string;
  title: string;
  tagline: string;
  recipeIds: string[];
}

export type ShoppingCategory = 'PRODUCE' | 'PANTRY & SPICE';

export interface ShoppingItem {
  id: string;
  name: string;
  category: ShoppingCategory;
  amount: string;
  source: string;
  isChecked: boolean;
  estPrice?: number;
}

export type NotificationKind = 'expiry' | 'reply' | 'plan' | 'creator' | 'streak' | 'premium' | 'cooked' | 'published';

export interface AppNotification {
  id: string;
  avatarLetter: string;
  /** Drives the line icon shown instead of a letter tile. */
  kind?: NotificationKind;
  title: string;
  message: string;
  timeAgo: string;
  isHighlighted?: boolean;
  isRead?: boolean;
  /** Route to open when tapped. */
  link?: string;
}

export interface UserProfile {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  age?: number;
  handle: string;
  bio: string;
  avatarUrl?: string;
  savedCount: number;
  publishedCount: number;
  followersCount: string;
  streakDays: number;
  goals: string[];
  diet: string[];
  allergies: string[];
  cuisines: string[];
  cookingTimeMin: number;
  /** Who they usually cook for. Drives default servings. */
  household?: "solo" | "pair" | "family" | "large" | "shared";
  /** Food mood chosen at onboarding; seeds the generator prompt. */
  mood?: string;
  skillLevel?: "beginner" | "home" | "confident" | "chef";
  equipment?: string[];
  shoppingHabit?: "weekly" | "often" | "asneeded";
  recipeSources?: string[];
  notifPrefs?: { expiry: boolean; plan: boolean; creators: boolean };
  /** Answers from the food questionnaire; shapes recommendations app-wide. */
  foodProfile?: FoodProfile;
  isPremium: boolean;
}

/** The Fridgr Food Profile. Keys mirror the onboarding questions; values are option ids. */
export interface FoodProfile {
  mainGoal?: string;
  eatingStyle?: string;
  allergies?: string[];
  dislikes?: string[];
  cuisines?: string[];
  skill?: string;
  cookTime?: string;
  household?: string;
  priorities?: string[];
  cravings?: string[];
  adventurous?: string;
  meals?: string[];
  frequency?: string;
  nutrition?: string;
  become?: string;
  /** Free-text "Other" answers, keyed by question. */
  other?: Record<string, string>;
  /** Behaviour signals that evolve the profile: e.g. { "cooked:Levantine": 3, "saved:Japanese": 2 }. */
  signals?: Record<string, number>;
}

export interface RecipeMatch {
  have: RecipeIngredient[];
  missing: RecipeIngredient[];
  matchPercent: number;
  missingCount: number;
  total: number;
}
