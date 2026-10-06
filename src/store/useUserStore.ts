import { create } from 'zustand';
import { UserProfile, AppNotification, FoodProfile } from "../types";
import { env } from '../config/env';
import { authApi } from '../api/auth';
import { profileApi, queueSignal, type SignalInput } from '../api/profile';
import { onSessionLost } from '../api/client';
import { notificationsApi } from '../api/notifications';
import { logOutPurchases } from '../lib/purchases';
import type { ServerUser } from '../api/types';

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
  /** Server user id when signed in against the API (undefined in mock mode). */
  userId?: string;
  /** True once the stored session has been checked at boot (always true in mock mode). */
  sessionChecked: boolean;
  restoreSession: () => Promise<void>;
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
  /** Replace local state with the server's view of the user. */
  applyServerUser: (user: ServerUser) => void;
  /** Pull notifications from the API (backend mode). */
  hydrateNotifications: () => Promise<void>;
}

/** Runs the post-sign-in sync without a static import cycle (sync.ts imports this store). */
const syncAll = () => import('../lib/sync').then((m) => m.hydrateAfterSignIn()).catch(() => undefined);

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

const backend = () => env.USE_BACKEND;

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

/** Maps the API user onto the app's `UserProfile` shape (keeps mock-only fields intact). */
const profileFromServer = (u: ServerUser, prev: UserProfile): UserProfile => ({
  ...prev,
  name: u.name,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  age: u.age,
  handle: u.handle,
  bio: u.bio,
  savedCount: u.savedCount,
  publishedCount: u.publishedCount,
  followersCount: compact(u.followersCount),
  streakDays: u.streakDays,
  cookingTimeMin: u.cookingTimeMin,
  household: u.household,
  skillLevel: u.skillLevel,
  equipment: u.equipment,
  shoppingHabit: u.shoppingHabit,
  recipeSources: u.recipeSources,
  notifPrefs: u.notifPrefs,
  allergies: u.foodProfile?.allergies ?? prev.allergies,
  cuisines: u.foodProfile?.cuisines ?? prev.cuisines,
  foodProfile: u.foodProfile ? { ...u.foodProfile, signals: prev.foodProfile?.signals ?? {} } : prev.foodProfile,
  isPremium: u.isPremium,
});

/** Onboarding answers → the two server calls (profile + food profile). Fire-and-forget. */
const syncAnswers = (answers: OnboardingAnswers, onboarded: boolean) => {
  if (!backend()) return;
  profileApi
    .patch({
      household: answers.household ?? null,
      cookingTimeMin: answers.cookingTimeMin,
      skillLevel: answers.skillLevel ?? null,
      equipment: answers.equipment,
      shoppingHabit: answers.shoppingHabit ?? null,
      recipeSources: answers.recipeSources,
      notifPrefs: answers.notifPrefs,
      onboarded,
    })
    .catch(() => undefined);
  const fp = answers.foodProfile ?? {};
  profileApi
    .putFoodProfile({
      ...fp,
      allergies: fp.allergies ?? answers.allergies,
      cuisines: fp.cuisines ?? answers.cuisines,
      other: fp.other,
      ...(answers.mood ? { mood: answers.mood } : {}),
    })
    .catch(() => undefined);
};

const SIGNAL_KINDS: SignalInput['kind'][] = ['viewed', 'saved', 'unsaved', 'cooked', 'skipped', 'rated', 'liked', 'searched', 'ingredient_used', 'ingredient_rejected'];

export const useUserStore = create<UserState>((set, get) => ({
  profile: mockProfile,
  notifications: mockNotifications,
  theme: "light",
  userId: undefined,
  sessionChecked: !backend(),
  introSeen: false,
  setIntroSeen: () => set({ introSeen: true }),
  isAuthenticated: false,
  emailVerified: false,
  justLoggedIn: false,
  hasOnboarded: false,
  profileReadyPending: false,
  tourDone: true,

  applyServerUser: (u) =>
    set((state) => ({
      userId: u.id,
      profile: profileFromServer(u, state.profile),
      avatarIndex: u.avatarIndex,
      theme: u.theme,
      emailVerified: u.emailVerified,
      hasOnboarded: u.hasOnboarded,
    })),

  restoreSession: async () => {
    if (!backend()) {
      set({ sessionChecked: true });
      return;
    }
    const user = await authApi.restore();
    if (user) {
      get().applyServerUser(user);
      set({ isAuthenticated: true, justLoggedIn: false, profileReadyPending: false, tourDone: true, introSeen: true, notifications: [] });
      void syncAll();
    }
    set({ sessionChecked: true });
  },

  hydrateNotifications: async () => {
    if (!backend()) return;
    const notifications = await notificationsApi.list();
    set({ notifications });
  },

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

  verifyEmail: async (code) => {
    if (backend()) {
      const user = await authApi.verifyEmail(code ?? '', get().profile.email);
      get().applyServerUser(user);
    }
    set({ emailVerified: true });
    void syncAll();
  },

  resendCode: async () => {
    if (backend()) await authApi.resendCode(get().profile.email);
  },

  signUp: async (account) => {
    const firstName = account.firstName.trim();
    const lastName = account.lastName.trim();
    const email = account.email.trim().toLowerCase();
    if (backend()) {
      const user = await authApi.register({ email, password: account.password, firstName, lastName });
      get().applyServerUser(user);
      set({ isAuthenticated: true, emailVerified: user.emailVerified, justLoggedIn: false, hasOnboarded: false, profileReadyPending: false, tourDone: false });
      return;
    }
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

  logIn: async (email, password) => {
    if (backend()) {
      const user = await authApi.login(email.trim().toLowerCase(), password);
      get().applyServerUser(user);
      set({
        isAuthenticated: true,
        // A returning user who never finished onboarding is sent straight there.
        justLoggedIn: user.emailVerified && user.hasOnboarded,
        profileReadyPending: false,
        tourDone: true,
        notifications: [],
      });
      void syncAll();
      return;
    }
    // Mock: the demo profile stands in for the account on the server.
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
    if (!backend()) {
      await get().signUp({ firstName: input.fullName?.givenName ?? 'Alex', lastName: input.fullName?.familyName ?? 'Demo', email: 'alex.demo@apple.com', password: 'demo-account' });
      set({ emailVerified: true });
      return;
    }
    const { user, created } = await authApi.apple(input);
    get().applyServerUser(user);
    set({ isAuthenticated: true, justLoggedIn: !created && user.hasOnboarded, profileReadyPending: false, tourDone: !created, notifications: [] });
    void syncAll();
  },

  signInWithGoogle: async (idToken) => {
    if (!backend()) {
      await get().signUp({ firstName: 'Alex', lastName: 'Demo', email: 'alex.demo@google.com', password: 'demo-account' });
      set({ emailVerified: true });
      return;
    }
    const { user, created } = await authApi.google(idToken);
    get().applyServerUser(user);
    set({ isAuthenticated: true, justLoggedIn: !created && user.hasOnboarded, profileReadyPending: false, tourDone: !created, notifications: [] });
    void syncAll();
  },

  logOut: () => {
    if (backend()) {
      authApi.logout().catch(() => undefined);
      logOutPurchases().catch(() => undefined);
    }
    set({ isAuthenticated: false, emailVerified: false, justLoggedIn: false, hasOnboarded: false, profileReadyPending: false, userId: undefined });
  },

  deleteAccount: async (password, reason) => {
    if (backend()) await authApi.deleteAccount(password, reason);
    set({ isAuthenticated: false, emailVerified: false, justLoggedIn: false, hasOnboarded: false, profileReadyPending: false, userId: undefined, profile: mockProfile, notifications: [] });
  },

  finishWelcomeBack: () => set({ justLoggedIn: false }),

  recordSignal: (kind, tag, recipeId) => {
    if (backend() && SIGNAL_KINDS.includes(kind as SignalInput['kind'])) {
      queueSignal({ kind: kind as SignalInput['kind'], cuisine: tag, recipeId });
    }
    set((state) => {
      if (!tag) return {};
      const key = `${kind}:${tag}`;
      const fp = state.profile.foodProfile ?? {};
      const signals = { ...(fp.signals ?? {}), [key]: (fp.signals?.[key] ?? 0) + 1 };
      return { profile: { ...state.profile, foodProfile: { ...fp, signals } } };
    });
  },

  updateAccount: (patch) => {
    if (backend()) {
      if (patch.firstName !== undefined || patch.lastName !== undefined) profileApi.updateAccount({ firstName: patch.firstName, lastName: patch.lastName }).catch(() => undefined);
      if (patch.age !== undefined) profileApi.patch({ age: patch.age ?? null }).catch(() => undefined);
    }
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
  setAvatarIndex: (index) => {
    if (backend()) profileApi.patch({ avatarIndex: index }).catch(() => undefined);
    set({ avatarIndex: index });
  },
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'light' ? 'dark' : 'light';
      if (backend()) profileApi.patch({ theme }).catch(() => undefined);
      return { theme };
    }),

  completeOnboarding: (answers) => {
    syncAnswers(answers, true);
    set((state) => ({
      hasOnboarded: true,
      profileReadyPending: true,
      profile: { ...state.profile, ...answers },
    }));
  },

  updatePreferences: (answers) => {
    syncAnswers(answers, false);
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

  markNotificationRead: (id) => {
    if (backend() && !id.startsWith('n')) notificationsApi.read(id).catch(() => undefined);
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    }));
  },

  markAllNotificationsRead: () => {
    if (backend()) notificationsApi.readAll().catch(() => undefined);
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, isRead: true })) }));
  },

  addNotification: (n) =>
    set((state) => ({
      notifications: [{ ...n, id: `n${notifCounter++}`, timeAgo: 'now', isRead: false }, ...state.notifications],
    })),

  getUnreadCount: () => get().notifications.filter((n) => !n.isRead).length,
}));

// A rejected refresh token means the server no longer trusts this device.
onSessionLost(() => {
  if (useUserStore.getState().isAuthenticated) useUserStore.getState().logOut();
});
