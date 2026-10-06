import { Platform } from 'react-native';
import { api } from './client';
import { env } from '../config/env';
import type { AppNotification, NotificationKind } from '../types';

interface ServerNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  timeAgo: string;
  createdAt: string;
}

export const toAppNotification = (n: ServerNotification): AppNotification => ({
  id: n.id,
  avatarLetter: n.title.trim().charAt(0).toUpperCase() || '•',
  kind: n.kind,
  title: n.title,
  message: n.message,
  timeAgo: n.timeAgo,
  isRead: n.isRead,
  isHighlighted: !n.isRead && n.kind === 'expiry',
  link: n.link,
});

export const notificationsApi = {
  list: () => api.get<{ notifications: ServerNotification[]; unreadCount: number }>('/notifications').then((r) => r.notifications.map(toAppNotification)),
  read: (id: string) => api.post(`/notifications/${id}/read`),
  readAll: () => api.post('/notifications/read-all'),
  registerDevice: (expoPushToken: string) => api.post('/notifications/devices', { expoPushToken, platform: Platform.OS }),
  unregisterDevice: (expoPushToken: string) => api.delete(`/notifications/devices/${encodeURIComponent(expoPushToken)}`),
};

/**
 * Asks for permission and registers this device for expiry reminders.
 * Safe to call on every sign-in; never throws.
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
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    if (env.USE_BACKEND) await notificationsApi.registerDevice(token);
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
