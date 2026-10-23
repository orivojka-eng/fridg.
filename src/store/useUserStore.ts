import { create } from 'zustand';
import { UserProfile, AppNotification, FoodProfile } from "../types";

export const FREE_GENERATIONS_PER_DAY = 5;

interface OnboardingAnswers {
  goals: string[];
  diet: string[];
  allergies: string[];
  cuisines: string[];
  cookingTimeMin: number;
  household?: "solo" | "pair" | "family" | "large" | "shared";
  mood?: string;
  skillLevel?: "beginner" | "home" | "confident" | "chef";
  equipment?: string[];
  shoppingHabit?: "weekly" | "often" | "asneeded";
  recipeSources?: string[];
  notifPrefs?: { expiry: boolean; plan: boolean; creators: boolean };
  foodProfile?: FoodProfile;
}

export interface AccountInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface UserState {
  profile: UserProfile;
  /** Promo intro slides shown once after install, before the welcome screen. */
  introSeen: boolean;
  setIntroSeen: () => void;
  isAuthenticated: boolean;
  /** Sign-up requires confirming the email code before onboarding. */
  emailVerified: boolean;
  verifyEmail: (code?: string) => Promise<void>;
  resendCode: () => Promise<void>;
  /** Set when onboarding completes; shows the "profile is set" page once. */
  profileReadyPending: boolean;
  finishProfileReady: () => void;
  /** First-run feature tour on Home (new accounts only). */
  tourDone: boolean;
  /** The notifications explanation screen has been shown once. */
  pushPrimerSeen: boolean;
  setPushPrimerSeen: () => void;
  setTourDone: () => void;
  /** Wipe the demo data so a new account starts empty. */
  resetForNewAccount: () => void;
  /** True right after a login so the router shows the "welcome back" screen once. */
  justLoggedIn: boolean;
  signUp: (account: AccountInput) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  /** Sign in with Apple (identity token from expo-apple-authentication). */
  signInWithApple: (input: { identityToken: string; authorizationCode?: string | null; fullName?: { givenName?: string | null; familyName?: string | null } | null }) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  logOut: () => void;
  deleteAccount: (password?: string, reason?: string) => Promise<void>;
  finishWelcomeBack: () => void;
  updateAccount: (patch: Partial<Pick<UserProfile, "firstName" | "lastName" | "age">>) => void;
  /** Behaviour feeds the Food Profile: kind = cooked | saved | liked | skipped, tag = cuisine/style/ingredient. */
  recordSignal: (kind: string, tag?: string, recipeId?: string) => void;
  notifications: AppNotification[];
  theme: 'light' | 'dark';
  hasOnboarded: boolean;
  freeGenerationsLeft: number;
  /** Index into the illustrated avatar set (design folder → avatars). */
  avatarIndex: number;
  setAvatarIndex: (index: number) => void;
  /** True once the boot splash has started to clear; screens wait for it before animating in. */
  bootDone: boolean;
  setBootDone: () => void;
  toggleTheme: () => void;
  completeOnboarding: (answers: OnboardingAnswers) => void;
  updatePreferences: (answers: OnboardingAnswers) => void;
  /** Returns false when the user is out of free generations and not premium. */
  consumeGeneration: () => boolean;
  setPremium: (isPremium: boolean) => void;
  incrementStreak: () => void;
  incrementPublished: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'timeAgo' | 'isRead'>) => void;
  getUnreadCount: () => number;
}

const mockProfile: UserProfile = {
  name: 'Sofia Marchetti',
  firstName: 'Sofia',
  lastName: 'Marchetti',
  email: 'sofia@fridgr.app',
  age: 29,
  handle: '@sofiacooks',
  bio: 'Fitness-focused foodie',
  savedCount: 48,
  publishedCount: 12,
  followersCount: '1.4k',
  streakDays: 12,
  goals: ['Fitness', 'Quick & easy'],
  diet: ['High protein'],
  allergies: ['Dairy'],
  cuisines: ['Japanese', 'Levantine'],
  cookingTimeMin: 30,
  isPremium: false,
};

const mockNotifications: AppNotification[] = [
  {
    id: 'n1',
    avatarLetter: 'S',
    kind: 'expiry',
    title: 'Spinach expires in 2 days',
    message: 'Three recipes use it up tonight — tap to see them.',
    timeAgo: '2h',
    isHighlighted: true,
    link: '/recipe/results?use=Spinach',
  },
  {
    id: 'n2',
    avatarLetter: 'N',
    kind: 'reply',
    title: 'Nadia Benali replied to you',
    message: '“Yes — swap the yoghurt for coconut and it still works.”',
    timeAgo: '5h',
    link: '/recipe/r1',
  },
  {
    id: 'n3',
    avatarLetter: 'AI',
    kind: 'plan',
    title: 'Your weekly meal plan is ready',
    message: '6 dinners built around what’s already in your fridge.',
    timeAgo: '1d',
    link: '/recipe/results',
  },
  {
    id: 'n4',
    avatarLetter: 'S',
    kind: 'creator',
    title: 'Sam Okafor posted a new recipe',
    message: 'Crispy gochujang salmon — see how much of it you already have.',
    timeAgo: '1d',
    link: '/recipe/r7',
  },
  {
    id: 'n5',
    avatarLetter: 'C',
    kind: 'streak',
    title: 'You hit a 12-day cooking streak',
    message: 'Nothing wasted this week. That\'s €38 saved.',
    timeAgo: '2d',
    isRead: true,
    link: '/(tabs)/profile',
  },
];

let notifCounter = 100;

export const useUserStore = create<UserState>((set, get) => ({
  profile: mockProfile,
  notifications: mockNotifications,
  theme: "light",
  introSeen: false,
  setIntroSeen: () => set({ introSeen: true }),
  isAuthenticated: false,
  emailVerified: false,
  justLoggedIn: false,
  hasOnboarded: false,
  profileReadyPending: false,
  tourDone: true,

  finishProfileReady: () => set({ profileReadyPending: false }),
  setTourDone: () => set({ tourDone: true }),
  pushPrimerSeen: false,
  setPushPrimerSeen: () => set({ pushPrimerSeen: true }),
  resetForNewAccount: () =>
    set((state) => ({
      notifications: [],
      freeGenerationsLeft: FREE_GENERATIONS_PER_DAY,
      tourDone: false,
      profile: { ...state.profile, savedCount: 0, publishedCount: 0, followersCount: "0", streakDays: 0, isPremium: false, bio: "New in the kitchen" },
    })),

  // Demo: any code confirms the email.
  verifyEmail: async () => {
    set({ emailVerified: true });
  },

  resendCode: async () => {},

  signUp: async (account) => {
    const firstName = account.firstName.trim();
    const lastName = account.lastName.trim();
    const email = account.email.trim().toLowerCase();
    set((state) => ({
      isAuthenticated: true,
      emailVerified: false,
      justLoggedIn: false,
      hasOnboarded: false,
      profileReadyPending: false,
      tourDone: false,
      profile: {
        ...state.profile,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        email,
        handle: `@${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}cooks`,
        age: undefined,
      },
    }));
  },

  // Demo: any email and password signs in to the demo profile.
  logIn: async (email) => {
    set((state) => ({
      isAuthenticated: true,
      emailVerified: true,
      justLoggedIn: true,
      hasOnboarded: true,
      profileReadyPending: false,
      tourDone: true,
      profile: { ...state.profile, email: email.trim().toLowerCase() },
    }));
  },

  signInWithApple: async (input) => {
    await get().signUp({ firstName: input.fullName?.givenName ?? 'Alex', lastName: input.fullName?.familyName ?? 'Demo', email: 'alex.demo@apple.com', password: 'demo-account' });
    set({ emailVerified: true });
  },

  signInWithGoogle: async () => {
    await get().signUp({ firstName: 'Alex', lastName: 'Demo', email: 'alex.demo@google.com', password: 'demo-account' });
    set({ emailVerified: true });
  },

  logOut: () => {
    set({ isAuthenticated: false, emailVerified: false, justLoggedIn: false, hasOnboarded: false, profileReadyPending: false });
  },

  deleteAccount: async () => {
    set({ isAuthenticated: false, emailVerified: false, justLoggedIn: false, hasOnboarded: false, profileReadyPending: false, profile: mockProfile, notifications: [] });
  },

  finishWelcomeBack: () => set({ justLoggedIn: false }),

  recordSignal: (kind, tag) => {
    set((state) => {
      if (!tag) return {};
      const key = `${kind}:${tag}`;
      const fp = state.profile.foodProfile ?? {};
      const signals = { ...(fp.signals ?? {}), [key]: (fp.signals?.[key] ?? 0) + 1 };
      return { profile: { ...state.profile, foodProfile: { ...fp, signals } } };
    });
  },

  updateAccount: (patch) => {
    set((state) => {
      const firstName = patch.firstName ?? state.profile.firstName;
      const lastName = patch.lastName ?? state.profile.lastName;
      return { profile: { ...state.profile, ...patch, firstName, lastName, name: `${firstName} ${lastName}`.trim() } };
    });
  },
  freeGenerationsLeft: 4,
  avatarIndex: 3,
  bootDone: false,

  setBootDone: () => set({ bootDone: true }),
  setAvatarIndex: (index) => set({ avatarIndex: index }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  completeOnboarding: (answers) => {
    set((state) => ({
      hasOnboarded: true,
      profileReadyPending: true,
      profile: { ...state.profile, ...answers },
    }));
  },

  updatePreferences: (answers) => {
    set((state) => ({
      profile: { ...state.profile, ...answers },
    }));
  },

  consumeGeneration: () => {
    const { profile, freeGenerationsLeft } = get();
    if (profile.isPremium) return true;
    if (freeGenerationsLeft <= 0) return false;
    set({ freeGenerationsLeft: freeGenerationsLeft - 1 });
    return true;
  },

  setPremium: (isPremium) => set((state) => ({ profile: { ...state.profile, isPremium } })),

  incrementStreak: () => set((state) => ({ profile: { ...state.profile, streakDays: state.profile.streakDays + 1 } })),
  incrementPublished: () =>
    set((state) => ({ profile: { ...state.profile, publishedCount: state.profile.publishedCount + 1 } })),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    })),

  markAllNotificationsRead: () =>
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, isRead: true })) })),

  addNotification: (n) =>
    set((state) => ({
      notifications: [{ ...n, id: `n${notifCounter++}`, timeAgo: 'now', isRead: false }, ...state.notifications],
    })),

  getUnreadCount: () => get().notifications.filter((n) => !n.isRead).length,
}));
