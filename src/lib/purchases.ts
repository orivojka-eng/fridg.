import { Platform } from 'react-native';
import { env } from '../config/env';
import { subscriptionsApi } from '../api/subscriptions';

/**
 * RevenueCat wrapper. Products: fridgr_premium_monthly / fridgr_premium_yearly,
 * entitlement "premium". Everything is a no-op when keys are missing (dev,
 * web, or mock mode) so the paywall keeps working in the prototype flow.
 */
export const ENTITLEMENT = 'premium';
export const PRODUCT_IDS = { monthly: 'fridgr_premium_monthly', yearly: 'fridgr_premium_yearly' } as const;

const apiKey = Platform.OS === 'ios' ? env.REVENUECAT_IOS_KEY : Platform.OS === 'android' ? env.REVENUECAT_ANDROID_KEY : '';
export const purchasesAvailable = () => !!apiKey && Platform.OS !== 'web';

let configured = false;

async function rc() {
  const mod = await import('react-native-purchases');
  return mod.default;
}

export async function configurePurchases(userId: string) {
  if (!purchasesAvailable()) return;
  const Purchases = await rc();
  if (!configured) {
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
  } else {
    await Purchases.logIn(userId);
  }
}

export async function logOutPurchases() {
  if (!purchasesAvailable() || !configured) return;
  try {
    const Purchases = await rc();
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch {
    /* ignore */
  }
}

type CustomerInfoLike = {
  originalAppUserId: string;
  entitlements: { active: Record<string, { productIdentifier: string; expirationDate: string | null; willRenew: boolean; periodType: string; store: string }> };
};

/** Pushes the entitlement state to the server; returns whether Premium is active. */
export async function syncEntitlement(info: CustomerInfoLike) {
  const ent = info.entitlements.active[ENTITLEMENT];
  if (env.USE_BACKEND) {
    await subscriptionsApi
      .sync({ rcAppUserId: info.originalAppUserId, entitlementActive: !!ent, productId: ent?.productIdentifier ?? null, expiresAt: ent?.expirationDate ?? null, willRenew: ent?.willRenew, periodType: ent?.periodType, store: ent?.store })
      .catch(() => undefined);
  }
  return !!ent;
}

/** Buys the plan through Apple/Google IAP via RevenueCat. Throws on failure; returns false when the user cancelled. */
export async function purchasePlan(plan: keyof typeof PRODUCT_IDS): Promise<boolean> {
  if (!purchasesAvailable()) throw new Error('Purchases are not available in this build.');
  const Purchases = await rc();
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages.find((p) => p.product.identifier === PRODUCT_IDS[plan]) ?? offerings.current?.availablePackages.find((p) => p.identifier.toLowerCase().includes(plan));
  if (!pkg) throw new Error('That plan is not available right now.');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return syncEntitlement(customerInfo as unknown as CustomerInfoLike);
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  const Purchases = await rc();
  const info = await Purchases.restorePurchases();
  return syncEntitlement(info as unknown as CustomerInfoLike);
}

export async function refreshEntitlement(): Promise<boolean | null> {
  if (!purchasesAvailable() || !configured) return null;
  try {
    const Purchases = await rc();
    const info = await Purchases.getCustomerInfo();
    return syncEntitlement(info as unknown as CustomerInfoLike);
  } catch {
    return null;
  }
}

/** Opens the App Store / Play subscription management page. */
export async function manageSubscription() {
  const { Linking } = await import('react-native');
  const url = Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
  await Linking.openURL(url);
}
