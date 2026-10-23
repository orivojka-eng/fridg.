import { Platform } from 'react-native';

/**
 * Asks for notification permission on this device.
 * Never throws.
 */
export async function registerForPush(opts: { prompt?: boolean } = {}) {
  if (Platform.OS === 'web') return 'unavailable' as const;
  try {
    const Notifications = await import('expo-notifications');
    const { status: existing, canAskAgain } = await Notifications.getPermissionsAsync();
    let status = existing;
    // The system dialog is shown only after the in-app primer (opts.prompt).
    if (existing !== 'granted' && opts.prompt && canAskAgain) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return existing === 'undetermined' && canAskAgain ? ('undetermined' as const) : ('denied' as const);
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'FRIDGR', importance: Notifications.AndroidImportance.DEFAULT });
    }
    return 'granted' as const;
  } catch {
    return 'unavailable' as const;
  }
}

/** True when the OS has never been asked (so the primer should show). */
export async function pushPermissionUndetermined() {
  if (Platform.OS === 'web') return false;
  try {
    const Notifications = await import('expo-notifications');
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    return status !== 'granted' && canAskAgain;
  } catch {
    return false;
  }
}
