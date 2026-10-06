import { create } from 'zustand';
import { Recipe, RecipeStep } from '../types';

interface CookingState {
  recipeId: string | null;
  recipeTitle: string;
  steps: RecipeStep[];
  currentStepIndex: number;
  isTimerRunning: boolean;
  timerSecondsRemaining: number;
  initialTimerSeconds: number;
  timerFinished: boolean;
  isKeepAwake: boolean;
  isCompleted: boolean;
  rating: number;

  /** Snapshot the recipe's steps so adaptations don't mutate the saved recipe. */
  startCooking: (recipe: Pick<Recipe, 'id' | 'title' | 'steps'>) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  setTimer: (seconds: number) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  tickTimer: () => void;
  toggleKeepAwake: () => void;
  setRating: (rating: number) => void;
  finishCooking: () => void;
  resetCooking: () => void;
}

const timerFor = (step?: RecipeStep) => step?.timerSec ?? 0;

export const useCookingStore = create<CookingState>((set, get) => ({
  recipeId: null,
  recipeTitle: '',
  steps: [],
  currentStepIndex: 0,
  isTimerRunning: false,
  timerSecondsRemaining: 0,
  initialTimerSeconds: 0,
  timerFinished: false,
  isKeepAwake: true,
  isCompleted: false,
  rating: 0,

  startCooking: (recipe) =>
    set({
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      steps: recipe.steps,
      currentStepIndex: 0,
      isCompleted: false,
      isTimerRunning: false,
      timerFinished: false,
      rating: 0,
      initialTimerSeconds: timerFor(recipe.steps[0]),
      timerSecondsRemaining: timerFor(recipe.steps[0]),
    }),

  nextStep: () => {
    const { currentStepIndex, steps } = get();
    const nextIdx = currentStepIndex + 1;
    if (nextIdx >= steps.length) {
      set({ isCompleted: true, isTimerRunning: false });
      return;
    }
    get().goToStep(nextIdx);
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) get().goToStep(currentStepIndex - 1);
  },

  goToStep: (index) => {
    const { steps } = get();
    const clamped = Math.max(0, Math.min(index, steps.length - 1));
    const secs = timerFor(steps[clamped]);
    set({
      currentStepIndex: clamped,
      isTimerRunning: false,
      timerFinished: false,
      initialTimerSeconds: secs,
      timerSecondsRemaining: secs,
    });
  },

  setTimer: (seconds) =>
    set({ initialTimerSeconds: seconds, timerSecondsRemaining: seconds, isTimerRunning: false, timerFinished: false }),

  startTimer: () => {
    const { timerSecondsRemaining, initialTimerSeconds } = get();
    // Restart automatically if the previous run finished.
    if (timerSecondsRemaining <= 0) {
      set({ timerSecondsRemaining: initialTimerSeconds, timerFinished: false, isTimerRunning: initialTimerSeconds > 0 });
      return;
    }
    set({ isTimerRunning: true, timerFinished: false });
  },

  pauseTimer: () => set({ isTimerRunning: false }),

  tickTimer: () =>
    set((state) => {
      if (!state.isTimerRunning) return {};
      const next = state.timerSecondsRemaining - 1;
      if (next <= 0) return { timerSecondsRemaining: 0, isTimerRunning: false, timerFinished: true };
      return { timerSecondsRemaining: next };
    }),

  toggleKeepAwake: () => set((state) => ({ isKeepAwake: !state.isKeepAwake })),
  setRating: (rating) => set({ rating }),
  finishCooking: () => set({ isCompleted: true, isTimerRunning: false }),
  resetCooking: () =>
    set({
      recipeId: null,
      recipeTitle: '',
      steps: [],
      currentStepIndex: 0,
      isCompleted: false,
      isTimerRunning: false,
      timerFinished: false,
      timerSecondsRemaining: 0,
      initialTimerSeconds: 0,
      rating: 0,
    }),
}));
