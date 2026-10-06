import * as Notifications from 'expo-notifications';

export const registerForPushNotificationsAsync = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (error) {
    console.warn('Notifications permission error:', error);
    return false;
  }
};

export const scheduleExpiryAlert = async (itemName: string, daysLeft: number) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'FRIDGR Expiration Alert 🥑',
      body: `${itemName} will expire in ${daysLeft} days! Use it today.`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60 * 24, // 24 hours
    },
  });
};
