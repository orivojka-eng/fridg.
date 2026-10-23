import React from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserStore } from '../src/store/useUserStore';
import { Paywall, PLANS } from '../src/components/Paywall';

/**
 * Premium route: the shared paywall. Demo mode: the Premium flag flips
 * locally.
 */
export default function PremiumScreen() {
  const router = useRouter();
  const { profile, setPremium, addNotification } = useUserStore();

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'));

  const subscribe = async (plan: keyof typeof PLANS) => {
    setPremium(true);
    addNotification({ avatarLetter: '★', kind: 'premium', title: 'Welcome to FRIDGR Premium', message: `Your ${PLANS[plan].label.toLowerCase()} plan is active.`, link: '/(tabs)/profile' });
    return true;
  };

  const restore = async () => profile.isPremium;

  const cancel = () =>
    Alert.alert('Cancel Premium?', 'You will lose unlimited generations and meal plans.', [
      { text: 'Keep Premium', style: 'cancel' },
      { text: 'Cancel plan', style: 'destructive', onPress: () => { setPremium(false); close(); } },
    ]);

  return <Paywall isPremium={profile.isPremium} onClose={close} onSubscribe={subscribe} onRestore={restore} onDone={close} onCancelPlan={cancel} />;
}
