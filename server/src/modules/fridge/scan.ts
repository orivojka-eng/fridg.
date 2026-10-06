import { Router } from 'express';
import { z } from 'zod';
import { aiConfigured, structuredWithRetry } from '../../ai/client.js';
import { scanJson, scanResult } from '../../ai/schemas.js';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { signRead, signScanUpload, storageConfigured } from '../../lib/storage.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { body, wrap } from '../../middleware/validate.js';
import { consumeQuota, refundQuota } from '../ai/quota.js';
import { resolveFood } from '../foods/service.js';
import { addFridgeItems, serializeFridgeItem } from './router.js';

export const scanRouter = Router();
scanRouter.use(requireVerified);

/** Step 1 (when object storage is configured): get a signed PUT URL for the photo. */
scanRouter.post(
  '/upload-url',
  body(z.object({ ext: z.enum(['jpg', 'png', 'webp']).default('jpg') })),
  wrap(async (req, res) => {
    const signed = await signScanUpload(authUser(req).id, req.body.ext);
    if (!signed) return res.json({ upload: null, inline: true, maxBytes: 1_500_000 });
    res.json({ upload: signed, inline: false });
  }),
);

const scanInput = z
  .object({
    /** Storage key returned by /upload-url */
    imageKey: z.string().max(300).optional(),
    /** Or the JPEG itself, base64 (≤ 1.5 MB) when storage is not configured. */
    imageBase64: z.string().max(2_100_000).optional(),
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
    /** Premium: second pass for brands, expiry dates and partially hidden items. */
    detailed: z.boolean().default(false),
  })
  .refine((v) => v.imageKey || v.imageBase64, { message: 'Send imageKey or imageBase64.' });

/**
 * Step 2: recognise the food. Returns *candidates with confidence*; nothing
 * is written to the fridge until the user confirms (step 3).
 */
scanRouter.post(
  '/',
  aiLimiter,
  body(scanInput),
  wrap(async (req, res) => {
    const u = authUser(req);
    if (!aiConfigured()) throw AppError.notImplemented('Food scanning');
    const input = req.body as z.infer<typeof scanInput>;
    if (input.imageKey && !input.imageKey.startsWith(`scans/${u.id}/`)) throw AppError.forbidden('That upload is not yours.');
    if (input.imageKey && !storageConfigured()) throw AppError.badRequest('Object storage is not configured; send imageBase64.');
    if (input.detailed && !u.isPremium) throw new AppError(402, 'PREMIUM_REQUIRED', 'Detailed scanning is a Premium feature.');
    await consumeQuota(u.id, u.isPremium, 'scans');

    const job = await prisma.aiGeneration.create({ data: { userId: u.id, feature: 'scan', model: config.AI_MODEL_PRIMARY, status: 'running', requestJson: { imageKey: input.imageKey ?? 'inline', detailed: input.detailed } } });
    try {
      const image = input.imageKey ? { url: (await signRead(input.imageKey))! } : { base64: input.imageBase64!, mediaType: input.mediaType };
      const result = await structuredWithRetry({
        system: `You identify groceries in photos of fridges, shelves, counters and shopping bags for a "cook with what you have" app.
Rules: list only items you can actually see; one entry per distinct food (merge duplicates and add up quantities); use generic shopper names ("Greek yoghurt", "Red peppers", "Chicken breast"); estimate quantities from what is visible (count pieces, or weight/volume from pack size); category: Protein (meat, fish, eggs, beans, tofu), Veg (vegetables), Dairy (milk, cheese, yoghurt, butter and their alternatives), Produce (fruit, herbs, garlic, tomatoes), Pantry (dry goods, tins, sauces, oils, bread). Confidence below 0.5 for anything partly hidden or ambiguous. Ignore non-food objects.${input.detailed ? ' DETAILED MODE: also read brand names and any printed best-before dates, and set estimatedDaysToExpiry from those dates when visible.' : ''}`,
        user: 'List every food item visible in this photo.',
        images: [image],
        tool: { name: 'scan_result', description: 'Foods detected in the photo.', inputSchema: scanJson },
        schema: scanResult,
        maxTokens: 2500,
      });
      // Snap names to the catalogue where possible so matching stays deterministic.
      const items = [];
      for (const c of result.data.items) {
        const food = await resolveFood(c.name);
        items.push({
          name: food?.displayName ?? c.name,
          category: c.category,
          quantity: c.quantity,
          unit: c.unit || food?.defaultUnit || 'pcs',
          confidence: Math.round(c.confidence * 100) / 100,
          daysToExpiry: c.estimatedDaysToExpiry ?? food?.shelfLifeDays ?? 5,
          foodId: food?.id,
          brand: c.brand,
          notes: c.notes,
          /** UI pre-selects only confident detections; the rest are opt-in. */
          suggested: c.confidence >= 0.6,
        });
      }
      items.sort((a, b) => b.confidence - a.confidence);
      await prisma.aiGeneration.update({ where: { id: job.id }, data: { status: 'done', responseJson: { count: items.length, isFood: result.data.isFood }, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: result.costUsd, completedAt: new Date() } });
      res.json({ scanId: job.id, isFood: result.data.isFood, sceneNote: result.data.sceneNote, items });
    } catch (e) {
      await prisma.aiGeneration.update({ where: { id: job.id }, data: { status: 'failed', error: (e as Error).message, completedAt: new Date() } }).catch(() => undefined);
      await refundQuota(u.id, 'scans').catch(() => undefined);
      throw e;
    }
  }),
);

/** Step 3: the user confirmed (and possibly edited) the list. Only now does the fridge change. */
scanRouter.post(
  '/confirm',
  body(
    z.object({
      scanId: z.string().uuid().optional(),
      items: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(60),
            category: z.enum(['Protein', 'Veg', 'Dairy', 'Pantry', 'Produce']).optional(),
            quantity: z.number().positive().max(999).default(1),
            unit: z.string().trim().max(12).default('pcs'),
            daysToExpiry: z.number().int().min(-30).max(365).optional(),
            confidence: z.number().min(0).max(1).optional(),
          }),
        )
        .min(1)
        .max(40),
    }),
  ),
  wrap(async (req, res) => {
    const u = authUser(req);
    const items = req.body.items as Array<{ name: string; category?: 'Protein' | 'Veg' | 'Dairy' | 'Pantry' | 'Produce'; quantity: number; unit: string; daysToExpiry?: number; confidence?: number }>;
    const before = await prisma.fridgeItem.count({ where: { userId: u.id } });
    const added = await addFridgeItems(u.id, items.map((i) => ({ ...i, addedVia: 'scan' as const, scanConfidence: i.confidence })));
    const after = await prisma.fridgeItem.count({ where: { userId: u.id } });
    const all = await prisma.fridgeItem.findMany({ where: { userId: u.id }, orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }] });
    res.status(201).json({ added: after - before, merged: added.length - (after - before), items: all.map(serializeFridgeItem) });
  }),
);
