import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { logger } from './logger.js';

const expo = new Expo({ accessToken: config.EXPO_ACCESS_TOKEN });

interface PushInput {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Sends to every device of each user; removes tokens Expo reports as dead. */
export async function sendPush(inputs: PushInput[]) {
  if (!inputs.length) return;
  const tokens = await prisma.deviceToken.findMany({ where: { userId: { in: inputs.map((i) => i.userId) } } });
  const byUser = new Map<string, string[]>();
  tokens.forEach((t) => byUser.set(t.userId, [...(byUser.get(t.userId) ?? []), t.expoPushToken]));
  const messages: ExpoPushMessage[] = [];
  for (const i of inputs) {
    for (const to of byUser.get(i.userId) ?? []) {
      if (!Expo.isExpoPushToken(to)) continue;
      messages.push({ to, sound: 'default', title: i.title, body: i.body, data: i.data });
    }
  }
  const dead: string[] = [];
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((t, idx) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx]!.to as string);
      });
    } catch (e) {
      logger.warn({ err: e }, 'push chunk failed');
    }
  }
  if (dead.length) await prisma.deviceToken.deleteMany({ where: { expoPushToken: { in: dead } } });
}
