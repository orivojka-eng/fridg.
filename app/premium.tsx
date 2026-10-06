import React from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserStore } from '../src/store/useUserStore';
import { Paywall, PLANS } from '../src/components/Paywall';
import { manageSubscription, purchasePlan, purchasesAvailable, restorePurchases } from '../src/lib/purchases';

/**
 * Premium route: the shared paywall. With RevenueCat keys present the
 * purchase goes through Apple/Google IAP and the server mirrors the
 * entitlement; without them (dev, web, prototype) the flag flips locally so
 * the rest of the app stays testable.
 */
export default function PremiumScreen() {
  const router = useRouter();
  const { profile, setPremium, addNotification } = useUserStore();

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'));

  const subscribe = async (plan: keyof typeof PLANS) => {
    if (purchasesAvailable()) {
      const ok = await purchasePlan(plan);
      if (!ok) return false;
    }
    setPremium(true);
    addNotification({ avatarLetter: '★', kind: 'premium', title: 'Welcome to FRIDGR Premium', message: `Your ${PLANS[plan].label.toLowerCase()} plan is active.`, link: '/(tabs)/profile' });
    return true;
  };

  const restore = async () => {
    if (!purchasesAvailable()) return profile.isPremium;
    const ok = await restorePurchases();
    if (ok) setPremium(true);
    return ok;
  };

  const cancel = () =>
    purchasesAvailable()
      ? manageSubscription()
      : Alert.alert('Cancel Premium?', 'You will lose unlimited generations and meal plans.', [
          { text: 'Keep Premium', style: 'cancel' },
          { text: 'Cancel plan', style: 'destructive', onPress: () => { setPremium(false); close(); } },
        ]);

  return <Paywall isPremium={profile.isPremium} onClose={close} onSubscribe={subscribe} onRestore={restore} onDone={close} onCancelPlan={cancel} />;
}
