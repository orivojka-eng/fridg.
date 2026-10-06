import { Router, json, raw } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { safeEqual } from '../../lib/crypto.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { authUser, requireAuth } from '../../middleware/auth.js';
import { body, wrap } from '../../middleware/validate.js';

export const subscriptionsRouter = Router();

const serialize = (s: { status: string; productId: string | null; isActive: boolean; isTrial: boolean; currentPeriodEnd: Date | null; willRenew: boolean; store: string | null } | null) => ({
  isPremium: !!s?.isActive,
  status: s?.status ?? 'none',
  productId: s?.productId ?? null,
  isTrial: !!s?.isTrial,
  currentPeriodEnd: s?.currentPeriodEnd ?? null,
  willRenew: !!s?.willRenew,
  store: s?.store ?? null,
});

subscriptionsRouter.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const s = await prisma.subscription.findUnique({ where: { userId: authUser(req).id } });
    res.json({ subscription: serialize(s) });
  }),
);

const ENTITLEMENT = 'premium';

interface RcSubscriber {
  subscriber?: {
    original_app_user_id?: string;
    entitlements?: Record<string, { expires_date: string | null; product_identifier: string }>;
    subscriptions?: Record<string, { period_type?: string; store?: string; unsubscribe_detected_at?: string | null; billing_issues_detected_at?: string | null }>;
  };
}

/** Asks RevenueCat (server-to-server, secret key) what this FRIDGR user is entitled to. */
async function fetchEntitlement(userId: string) {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { authorization: `Bearer ${config.REVENUECAT_SECRET_API_KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new AppError(502, 'UPSTREAM', 'Could not confirm the purchase with the App Store yet. Try Restore Purchases in a minute.');
  const body = (await res.json()) as RcSubscriber;
  const ent = body.subscriber?.entitlements?.[ENTITLEMENT];
  const expiresAt = ent?.expires_date ? new Date(ent.expires_date) : null;
  const active = !!ent && (!expiresAt || expiresAt > new Date());
  const sub = ent ? body.subscriber?.subscriptions?.[ent.product_identifier] : undefined;
  return { active, productId: ent?.product_identifier ?? null, expiresAt, isTrial: sub?.period_type === 'trial', willRenew: !!sub && !sub.unsubscribe_detected_at, store: sub?.store ?? null, billingIssue: !!sub?.billing_issues_detected_at };
}

/**
 * Called by the app after purchase/restore so Premium unlocks immediately.
 * The client's claim is never trusted: with REVENUECAT_SECRET_API_KEY the server
 * asks RevenueCat directly (using the FRIDGR user id the app logs in with);
 * without it, the stored state (written only by the signed webhook) is returned.
 */
subscriptionsRouter.post(
  '/sync',
  requireAuth,
  // This router is mounted before the global JSON parser (the webhook needs the raw body).
  json({ limit: '16kb' }),
  body(
    z.object({
      rcAppUserId: z.string().min(3).max(200).optional(),
      entitlementActive: z.boolean().optional(),
      productId: z.string().max(120).nullable().optional(),
      expiresAt: z.coerce.date().nullable().optional(),
      willRenew: z.boolean().optional(),
      periodType: z.string().optional(),
      store: z.string().optional(),
    }),
  ),
  wrap(async (req, res) => {
    const { id } = authUser(req);
    if (!config.REVENUECAT_SECRET_API_KEY) {
      const current = await prisma.subscription.findUnique({ where: { userId: id } });
      return res.json({ subscription: serialize(current), verified: false });
    }
    const rc = await fetchEntitlement(id);
    const existing = await prisma.subscription.findUnique({ where: { userId: id } });
    // Never downgrade a manually granted (demo/support) subscription because RevenueCat has no record of it.
    if (!rc.active && existing?.store === 'demo' && existing.isActive) return res.json({ subscription: serialize(existing), verified: true });
    const status = rc.active ? (rc.billingIssue ? 'billing_issue' : rc.isTrial ? 'trial' : 'active') : existing ? 'expired' : 'none';
    const data = { rcAppUserId: id, isActive: rc.active, status, productId: rc.productId, currentPeriodEnd: rc.expiresAt, willRenew: rc.willRenew, isTrial: rc.isTrial, store: rc.store } as const;
    const s = await prisma.subscription.upsert({ where: { userId: id }, create: { userId: id, ...data }, update: data });
    res.json({ subscription: serialize(s), verified: true });
  }),
);

/* ------------------------------------------------------------------ RevenueCat webhook */
const rcEvent = z.object({
  api_version: z.string().optional(),
  event: z.object({
    id: z.string(),
    type: z.string(),
    app_user_id: z.string(),
    original_app_user_id: z.string().optional(),
    product_id: z.string().optional(),
    period_type: z.string().optional(),
    store: z.string().optional(),
    expiration_at_ms: z.number().nullable().optional(),
    entitlement_ids: z.array(z.string()).nullable().optional(),
    subscriber_attributes: z.record(z.any()).optional(),
  }),
});

const activeTypes = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE']);
const inactiveTypes = new Set(['EXPIRATION']);

subscriptionsRouter.post(
  '/webhook',
  raw({ type: '*/*', limit: '256kb' }),
  wrap(async (req, res) => {
    const header = req.get('authorization') ?? '';
    if (!config.REVENUECAT_WEBHOOK_SECRET || !safeEqual(header, `Bearer ${config.REVENUECAT_WEBHOOK_SECRET}`)) throw AppError.forbidden('Bad webhook secret.');
    let json: unknown;
    try {
      json = JSON.parse((req.body as Buffer).toString('utf8'));
    } catch {
      throw AppError.badRequest('Malformed webhook payload.');
    }
    const parsed = rcEvent.safeParse(json);
    if (!parsed.success) throw AppError.badRequest('Unexpected webhook shape.');
    const ev = parsed.data.event;

    // app_user_id is the FRIDGR user id (the app calls Purchases.logIn(userId)).
    const userId = [ev.app_user_id, ev.original_app_user_id].find((v) => v && z.string().uuid().safeParse(v).success);
    if (!userId) {
      logger.warn({ appUserId: ev.app_user_id }, 'rc webhook for unknown user');
      return res.json({ ok: true, ignored: true });
    }
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) return res.json({ ok: true, ignored: true });

    const already = await prisma.subscriptionEvent.findUnique({ where: { rcEventId: ev.id } });
    if (already) return res.json({ ok: true, duplicate: true });

    const expiresAt = ev.expiration_at_ms ? new Date(ev.expiration_at_ms) : null;
    const stillValid = !expiresAt || expiresAt > new Date();
    let status: 'trial' | 'active' | 'expired' | 'cancelled' | 'billing_issue' | 'grace' | undefined;
    let isActive: boolean | undefined;
    if (activeTypes.has(ev.type)) {
      isActive = stillValid;
      status = ev.period_type === 'TRIAL' ? 'trial' : 'active';
    } else if (inactiveTypes.has(ev.type)) {
      isActive = false;
      status = 'expired';
    } else if (ev.type === 'CANCELLATION') {
      status = 'cancelled';
      isActive = stillValid;
    } else if (ev.type === 'BILLING_ISSUE') {
      status = 'billing_issue';
      isActive = stillValid;
    }

    await prisma.$transaction([
      prisma.subscription.upsert({
        where: { userId },
        create: { userId, rcAppUserId: ev.app_user_id, isActive: isActive ?? false, status: status ?? 'none', productId: ev.product_id, currentPeriodEnd: expiresAt, willRenew: ev.type !== 'CANCELLATION' && ev.type !== 'EXPIRATION', isTrial: ev.period_type === 'TRIAL', store: ev.store?.toLowerCase() },
        update: { rcAppUserId: ev.app_user_id, ...(isActive !== undefined ? { isActive } : {}), ...(status ? { status } : {}), productId: ev.product_id, currentPeriodEnd: expiresAt, willRenew: ev.type !== 'CANCELLATION' && ev.type !== 'EXPIRATION', isTrial: ev.period_type === 'TRIAL', store: ev.store?.toLowerCase() },
      }),
      prisma.subscriptionEvent.create({ data: { userId, rcEventId: ev.id, type: ev.type, payload: json as object } }),
    ]);
    res.json({ ok: true });
  }),
);
