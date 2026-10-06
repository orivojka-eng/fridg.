import { api } from './client';

export interface SubscriptionInfo {
  isPremium: boolean;
  status: string;
  productId: string | null;
  isTrial: boolean;
  currentPeriodEnd: string | null;
  willRenew: boolean;
  store: string | null;
}

export const subscriptionsApi = {
  me: () => api.get<{ subscription: SubscriptionInfo }>('/subscriptions/me').then((r) => r.subscription),
  /** Report RevenueCat's CustomerInfo so the server unlocks Premium immediately (the webhook confirms later). */
  sync: (input: { rcAppUserId: string; entitlementActive: boolean; productId?: string | null; expiresAt?: string | null; willRenew?: boolean; periodType?: string; store?: string }) =>
    api.post<{ subscription: SubscriptionInfo }>('/subscriptions/sync', input).then((r) => r.subscription),
};
