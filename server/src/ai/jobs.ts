import type { AiFeature, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { refundQuota, type QuotaKind } from '../modules/ai/quota.js';

/**
 * Minimal in-process job runner backed by the AiGeneration table. Requests
 * return a job id immediately; the app polls until `done` or `failed`. A
 * single API instance is enough for launch; swap `run` for a queue later.
 */
export async function startJob(opts: { userId: string; feature: AiFeature; quota?: QuotaKind; request: Prisma.InputJsonValue; model: string; run: (jobId: string) => Promise<Prisma.InputJsonValue> }) {
  const job = await prisma.aiGeneration.create({ data: { userId: opts.userId, feature: opts.feature, model: opts.model, status: 'running', requestJson: opts.request } });
  void (async () => {
    try {
      const response = await opts.run(job.id);
      await prisma.aiGeneration.update({ where: { id: job.id }, data: { status: 'done', responseJson: response, completedAt: new Date() } });
    } catch (e) {
      const message = e instanceof AppError ? e.message : 'Something went wrong while cooking up ideas.';
      logger.error({ err: e, jobId: job.id, feature: opts.feature }, 'ai job failed');
      await prisma.aiGeneration.update({ where: { id: job.id }, data: { status: 'failed', error: message, completedAt: new Date() } }).catch(() => undefined);
      if (opts.quota) await refundQuota(opts.userId, opts.quota).catch(() => undefined);
    }
  })();
  return job.id;
}

export async function recordUsage(jobId: string, usage: { inputTokens: number; outputTokens: number; costUsd: number }) {
  await prisma.aiGeneration.update({ where: { id: jobId }, data: { inputTokens: { increment: usage.inputTokens }, outputTokens: { increment: usage.outputTokens }, costUsd: { increment: usage.costUsd } } }).catch(() => undefined);
}

export async function getJob(userId: string, jobId: string, feature?: AiFeature) {
  const job = await prisma.aiGeneration.findFirst({ where: { id: jobId, userId, ...(feature ? { feature } : {}) } });
  if (!job) throw AppError.notFound('Job');
  return job;
}
