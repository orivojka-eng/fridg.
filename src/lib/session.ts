import { useUserStore } from '../store/useUserStore';
import { useFridgeStore } from '../store/useFridgeStore';
import { useShoppingStore } from '../store/useShoppingStore';
import { useRecipeStore } from '../store/useRecipeStore';

/**
 * A brand-new account starts with nothing: empty fridge, empty shopping
 * list, no saved recipes or notifications, zero stats. The recipe catalogue
 * itself stays (it's what Discover and the generator draw from).
 */
export function startFreshAccount() {
  useFridgeStore.getState().clear();
  useShoppingStore.getState().clear();
  useRecipeStore.getState().resetUserData();
  useUserStore.getState().resetForNewAccount();
}
