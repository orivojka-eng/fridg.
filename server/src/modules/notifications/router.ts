import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { authUser, requireAuth } from '../../middleware/auth.js';
import { body, params, wrap } from '../../middleware/validate.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const timeAgo = (d: Date) => {
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
};

const serialize = (n: { id: string; kind: string; title: string; body: string; link: string | null; isRead: boolean; createdAt: Date }) => ({
  id: n.id,
  kind: n.kind,
  title: n.title,
  message: n.body,
  link: n.link ?? undefined,
  isRead: n.isRead,
  timeAgo: timeAgo(n.createdAt),
  createdAt: n.createdAt,
});

notificationsRouter.get(
  '/',
  wrap(async (req, res) => {
    const rows = await prisma.notification.findMany({ where: { userId: authUser(req).id }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ notifications: rows.map(serialize), unreadCount: rows.filter((r) => !r.isRead).length });
  }),
);

notificationsRouter.post(
  '/read-all',
  wrap(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: authUser(req).id, isRead: false }, data: { isRead: true } });
    res.json({ ok: true });
  }),
);

notificationsRouter.post(
  '/:id/read',
  params(z.object({ id: z.string().uuid() })),
  wrap(async (req, res) => {
    const { count } = await prisma.notification.updateMany({ where: { id: req.params.id, userId: authUser(req).id }, data: { isRead: true } });
    if (!count) throw AppError.notFound('Notification');
    res.json({ ok: true });
  }),
);

notificationsRouter.post(
  '/devices',
  body(z.object({ expoPushToken: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[.+\]$/, 'Not an Expo push token.'), platform: z.enum(['ios', 'android', 'web']) })),
  wrap(async (req, res) => {
    const { id } = authUser(req);
    await prisma.deviceToken.upsert({
      where: { expoPushToken: req.body.expoPushToken },
      create: { userId: id, expoPushToken: req.body.expoPushToken, platform: req.body.platform },
      update: { userId: id, platform: req.body.platform, lastSeenAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

notificationsRouter.delete(
  '/devices/:token',
  params(z.object({ token: z.string().min(10) })),
  wrap(async (req, res) => {
    await prisma.deviceToken.deleteMany({ where: { expoPushToken: req.params.token, userId: authUser(req).id } });
    res.json({ ok: true });
  }),
);
