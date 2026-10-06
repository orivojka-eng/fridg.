import { env } from '../config/env';
import { useFridgeStore } from '../store/useFridgeStore';
import { useShoppingStore } from '../store/useShoppingStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { useUserStore } from '../store/useUserStore';
import { registerForPush } from '../api/notifications';
import { configurePurchases, refreshEntitlement } from './purchases';

/**
 * After a verified sign-in (or a restored session): pull everything the
 * screens read from, register the device for reminders and connect
 * RevenueCat. Each part fails independently so one outage never blanks
 * the whole app.
 */
export async function hydrateAfterSignIn() {
  if (!env.USE_BACKEND) return;
  const user = useUserStore.getState();
  if (!user.isAuthenticated || !user.emailVerified) return;
  await Promise.allSettled([
    useFridgeStore.getState().hydrate(),
    useShoppingStore.getState().hydrate(),
    useRecipeStore.getState().hydrate(),
    user.hydrateNotifications(),
  ]);
  void registerForPush({ prompt: false });
  if (user.userId) {
    await configurePurchases(user.userId).catch(() => undefined);
    const premium = await refreshEntitlement();
    if (premium !== null) useUserStore.getState().setPremium(premium);
  }
}
