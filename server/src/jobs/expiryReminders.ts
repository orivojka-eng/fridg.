import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';
import { sendPush } from '../lib/push.js';

const DAY = 86_400_000;

/**
 * Once a day: for every user with expiry reminders on, find items expiring
 * within 2 days, write one in-app notification and push it. Skips users who
 * already got an expiry notification in the last 20 hours.
 */
export async function runExpiryReminders() {
  const soon = new Date(Date.now() + 2 * DAY);
  const items = await prisma.fridgeItem.findMany({
    where: { expiresAt: { lte: soon, gte: new Date(Date.now() - DAY) }, user: { profile: { notifExpiry: true }, deletion: null } },
    select: { userId: true, name: true, expiresAt: true },
  });
  const byUser = new Map<string, { name: string; days: number }[]>();
  items.forEach((i) => byUser.set(i.userId, [...(byUser.get(i.userId) ?? []), { name: i.name, days: Math.max(0, Math.ceil((i.expiresAt!.getTime() - Date.now()) / DAY)) }]));

  const recent = await prisma.notification.findMany({ where: { kind: 'expiry', createdAt: { gte: new Date(Date.now() - 20 * 3_600_000) }, userId: { in: [...byUser.keys()] } }, select: { userId: true } });
  const skip = new Set(recent.map((r) => r.userId));

  const pushes = [];
  for (const [userId, list] of byUser) {
    if (skip.has(userId)) continue;
    list.sort((a, b) => a.days - b.days);
    const first = list[0]!;
    const title = list.length === 1 ? `${first.name} expires ${first.days === 0 ? 'today' : first.days === 1 ? 'tomorrow' : `in ${first.days} days`}` : `${first.name} and ${list.length - 1} more expire soon`;
    const body = 'Tap to see recipes that use them up tonight.';
    const link = `/recipe/results?use=${encodeURIComponent(first.name)}`;
    await prisma.notification.create({ data: { userId, kind: 'expiry', title, body, link } });
    pushes.push({ userId, title, body, data: { link } });
  }
  await sendPush(pushes);
  logger.info({ users: pushes.length }, 'expiry reminders sent');
  return pushes.length;
}

/** Starts the daily scheduler (first run ~1 min after boot, then every 24 h at the same hour). */
export function scheduleExpiryReminders() {
  const run = () => runExpiryReminders().catch((e) => logger.error({ err: e }, 'expiry reminders failed'));
  setTimeout(run, 60_000).unref();
  setInterval(run, DAY).unref();
  // Expired sessions, used/expired codes and old AI audit rows.
  const tidy = () => runHousekeeping().catch((e) => logger.error({ err: e }, 'housekeeping failed'));
  setTimeout(tidy, 5 * 60_000).unref();
  setInterval(tidy, DAY).unref();
}

/** Deletes scan images metadata older than 24h is handled by the bucket lifecycle rule; here we prune AI audit rows > 90 days and expired sessions/codes. */
export async function runHousekeeping() {
  const cutoff = new Date(Date.now() - 90 * DAY);
  await prisma.$transaction([
    prisma.aiGeneration.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.verification.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - DAY) } } }),
    prisma.userSignal.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 180 * DAY) } } }),
  ]);
}
