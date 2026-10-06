import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY_IOS = 'appl_fridgr_premium_ios_key';
const REVENUECAT_API_KEY_ANDROID = 'goog_fridgr_premium_android_key';

export const initRevenueCat = async (userId: string) => {
  try {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
    Purchases.configure({ apiKey, appUserID: userId });
  } catch (error) {
    console.warn('RevenueCat initialization error:', error);
  }
};

export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      return offerings.current.availablePackages;
    }
  } catch (error) {
    console.warn('RevenueCat offerings error:', error);
  }
  return [];
};
