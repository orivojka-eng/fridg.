import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';

export type QuotaKind = 'generations' | 'scans' | 'imports' | 'coachMsgs';

const LIMITS: Record<QuotaKind, { free: number; premium: number }> = {
  generations: { free: config.freeGenerationsPerDay, premium: 100 },
  scans: { free: config.freeScansPerDay, premium: 200 },
  imports: { free: config.freeImportsPerDay, premium: 60 },
  coachMsgs: { free: 0, premium: 200 },
};

const today = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export async function getQuota(userId: string, isPremium: boolean) {
  const row = await prisma.aiUsageDay.findUnique({ where: { userId_day: { userId, day: today() } } });
  const tier = isPremium ? 'premium' : 'free';
  const out: Record<QuotaKind, { used: number; limit: number; left: number }> = {} as any;
  (Object.keys(LIMITS) as QuotaKind[]).forEach((k) => {
    const used = row?.[k] ?? 0;
    const limit = LIMITS[k][tier];
    out[k] = { used, limit, left: Math.max(0, limit - used) };
  });
  return { tier, day: today().toISOString().slice(0, 10), ...out };
}

/** Atomically reserves one unit of quota or throws QUOTA_EXCEEDED / PREMIUM_REQUIRED. */
export async function consumeQuota(userId: string, isPremium: boolean, kind: QuotaKind) {
  const limit = LIMITS[kind][isPremium ? 'premium' : 'free'];
  if (limit === 0) throw new AppError(402, 'PREMIUM_REQUIRED', 'This is a Premium feature.');
  const day = today();
  const row = await prisma.aiUsageDay.upsert({ where: { userId_day: { userId, day } }, create: { userId, day }, update: {} });
  if (row[kind] >= limit) {
    throw new AppError(429, 'QUOTA_EXCEEDED', isPremium ? 'You have reached today’s limit.' : 'You have used today’s free generations. Go Premium for unlimited.');
  }
  await prisma.aiUsageDay.update({ where: { userId_day: { userId, day } }, data: { [kind]: { increment: 1 } } });
}

export async function refundQuota(userId: string, kind: QuotaKind) {
  await prisma.aiUsageDay.updateMany({ where: { userId, day: today(), [kind]: { gt: 0 } }, data: { [kind]: { decrement: 1 } } });
}
