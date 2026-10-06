import { Router, raw } from 'express';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { aiConfigured, structuredWithRetry, videoConfigured, type ImageInput, type VideoInput } from '../../ai/client.js';
import { geminiDeleteFile, geminiUploadFile, youtubeWatchUrl } from '../../ai/gemini.js';
import { getJob, recordUsage, startJob } from '../../ai/jobs.js';
import { estimateNutrition } from '../../ai/nutrition.js';
import { buildPersonalContext } from '../../ai/personalization.js';
import { importJson, importResult } from '../../ai/schemas.js';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { body, params, wrap } from '../../middleware/validate.js';
import { consumeQuota } from '../ai/quota.js';
import { createRecipeRecord, decorateRecipes } from './router.js';
import { recipeInclude } from './serialize.js';

/**
 * Turning a link into a full recipe, best source first:
 *  1. The page itself carries schema.org Recipe data (recipe blogs).
 *  2. The caption / description links to the creator's recipe page (blog,
 *     Linktree) → follow it and read that page's recipe data.
 *  3. YouTube: Gemini watches the public video through Google's own API
 *     (audio, on-screen text, what is shown) and writes the full recipe.
 *  4. A video or screenshots the user uploads (e.g. a TikTok saved from the
 *     app) → Gemini watches / reads it.
 *  5. Caption or pasted text only → the model completes sensible amounts.
 * Only public, documented data is read: no logins, no private content, no
 * DRM. Media the user uploads is deleted right after the import.
 */
export const importRouter = Router();
importRouter.use(requireVerified);

type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'web';

const detectPlatform = (url: string): Platform => {
  const h = new URL(url).hostname.replace(/^www\.|^m\./, '');
  if (h.includes('tiktok.com')) return 'tiktok';
  if (h.includes('instagram.com')) return 'instagram';
  if (h.includes('youtube.com') || h === 'youtu.be') return 'youtube';
  if (h.includes('facebook.com') || h.includes('fb.watch')) return 'facebook';
  return 'web';
};

interface SourceMeta {
  title?: string;
  description?: string;
  author?: string;
  authorHandle?: string;
  thumbnailUrl?: string;
  /** schema.org Recipe found on the page itself, flattened to text. */
  structured?: string;
}

const UA = 'Mozilla/5.0 (compatible; FRIDGRBot/1.0; +https://fridgr.app/bot)';
const SOCIAL_HOSTS = /(^|\.)(tiktok|instagram|facebook|fb|youtube|youtu|twitter|x|threads|pinterest|snapchat|amazon|apple|spotify|google)\.(com|be|watch|net|co\.uk|de)$/i;
const LINK_HUBS = /(^|\.)(linktr\.ee|beacons\.ai|lnk\.bio|campsite\.bio|stan\.store|bio\.link|linkin\.bio|tap\.bio)$/i;

const decode = (s?: string) =>
  s?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

const fetchJson = async (url: string) => {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
};

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(9000), redirect: 'follow' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null;
    return { html: (await res.text()).slice(0, 800_000), finalUrl: res.url || url };
  } catch {
    return null;
  }
}

const og = (html: string, prop: string) =>
  decode(html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1] ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1]);

const isoMinutes = (d?: unknown) => {
  if (typeof d !== 'string') return undefined;
  const m = d.match(/P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  return m ? (+(m[1] ?? 0) * 60 + +(m[2] ?? 0)) || undefined : undefined;
};

/** schema.org Recipe (JSON-LD) on a page → readable text block, or null. */
export function extractJsonLdRecipe(html: string): { text: string; name?: string; image?: string } | null {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    try {
      const json = JSON.parse(block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim());
      const nodes: unknown[] = (Array.isArray(json) ? json : [json]).flatMap((n) => (n && typeof n === 'object' && Array.isArray((n as { '@graph'?: unknown[] })['@graph']) ? (n as { '@graph': unknown[] })['@graph'] : [n]));
      const recipe = nodes.find((n) => {
        const t = n && typeof n === 'object' ? (n as { '@type'?: unknown })['@type'] : undefined;
        return Array.isArray(t) ? t.includes('Recipe') : t === 'Recipe';
      }) as Record<string, unknown> | undefined;
      if (!recipe) continue;
      const flatten = (x: unknown): string[] =>
        Array.isArray(x)
          ? x.flatMap(flatten)
          : typeof x === 'string'
            ? [x]
            : x && typeof x === 'object'
              ? (x as { itemListElement?: unknown }).itemListElement
                ? [`— ${(x as { name?: string }).name ?? 'Section'}`, ...flatten((x as { itemListElement: unknown }).itemListElement)]
                : [String((x as { text?: string; name?: string }).text ?? (x as { name?: string }).name ?? '')]
              : [];
      const ingredients = flatten(recipe.recipeIngredient).map((s) => decode(s.replace(/<[^>]+>/g, '').trim())).filter(Boolean);
      const steps = flatten(recipe.recipeInstructions).map((s) => decode(s.replace(/<[^>]+>/g, '').trim())).filter(Boolean);
      if (ingredients.length < 2) continue;
      const total = isoMinutes(recipe.totalTime) ?? isoMinutes(recipe.cookTime);
      const image = Array.isArray(recipe.image) ? recipe.image[0] : recipe.image;
      const text = [
        `NAME: ${decode(String(recipe.name ?? ''))}`,
        recipe.recipeYield ? `SERVES: ${Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield}` : '',
        total ? `TOTAL TIME: ${total} min` : '',
        `INGREDIENTS:\n${ingredients.map((i) => `- ${i}`).join('\n')}`,
        steps.length ? `METHOD:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      return { text, name: typeof recipe.name === 'string' ? recipe.name : undefined, image: typeof image === 'string' ? image : (image as { url?: string } | undefined)?.url };
    } catch {
      /* malformed json-ld */
    }
  }
  return null;
}

const urlsIn = (text: string) => [...new Set((text.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? []).map((u) => u.replace(/[.,;!?]+$/, '')))];

/**
 * Follows links found in a caption/description (and one level of Linktree-
 * style hubs) to the creator's own recipe page. Returns the first page with
 * schema.org Recipe data.
 */
async function followRecipeLinks(texts: string[], titleHint?: string): Promise<{ url: string; text: string; image?: string } | null> {
  const queue = texts.flatMap(urlsIn).filter((u) => {
    try {
      return !SOCIAL_HOSTS.test(new URL(u).hostname.replace(/^www\./, ''));
    } catch {
      return false;
    }
  });
  const seen = new Set<string>();
  let fetched = 0;
  while (queue.length && fetched < 5) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const page = await fetchPage(url);
    fetched++;
    if (!page) continue;
    const host = new URL(page.finalUrl).hostname.replace(/^www\./, '');
    if (LINK_HUBS.test(host)) {
      // Prefer hub links that look like the recipe in question.
      const words = (titleHint ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const hrefs = [...page.html.matchAll(/href=["'](https?:\/\/[^"']+)["']/g)].map((m) => decode(m[1]!)!).filter((h) => !SOCIAL_HOSTS.test(new URL(h).hostname.replace(/^www\./, '')) && !LINK_HUBS.test(new URL(h).hostname));
      hrefs.sort((a, b) => score(b) - score(a));
      function score(h: string) {
        const l = h.toLowerCase();
        return (l.includes('recipe') ? 3 : 0) + words.filter((w) => l.includes(w)).length;
      }
      queue.unshift(...hrefs.slice(0, 3));
      continue;
    }
    const recipe = extractJsonLdRecipe(page.html);
    if (recipe) return { url: page.finalUrl, text: recipe.text, image: recipe.image };
  }
  return null;
}

/**
 * Public, documented metadata only: oEmbed endpoints, the YouTube Data API,
 * and the Open Graph / schema.org tags any public page exposes.
 */
async function fetchMeta(url: string, platform: Platform): Promise<SourceMeta> {
  const meta: SourceMeta = {};
  try {
    if (platform === 'tiktok') {
      const j = await fetchJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      // TikTok's oEmbed title is the post caption, where creators list ingredients.
      meta.title = String(j.title ?? '');
      meta.description = String(j.title ?? '');
      meta.author = String(j.author_name ?? '');
      meta.authorHandle = j.author_unique_id ? `@${j.author_unique_id}` : undefined;
      meta.thumbnailUrl = typeof j.thumbnail_url === 'string' ? j.thumbnail_url : undefined;
    } else if (platform === 'youtube') {
      const j = await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      meta.title = String(j.title ?? '');
      meta.author = String(j.author_name ?? '');
      meta.thumbnailUrl = typeof j.thumbnail_url === 'string' ? j.thumbnail_url : undefined;
      const watch = youtubeWatchUrl(url);
      const id = watch ? new URL(watch).searchParams.get('v') : null;
      if (config.YOUTUBE_API_KEY && id) {
        const v = (await fetchJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${config.YOUTUBE_API_KEY}`)) as { items?: Array<{ snippet?: { description?: string } }> };
        meta.description = v.items?.[0]?.snippet?.description;
      }
    } else if (platform === 'instagram' && config.META_APP_ID && config.META_APP_SECRET) {
      const j = await fetchJson(`https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${config.META_APP_ID}|${config.META_APP_SECRET}`);
      meta.title = String(j.title ?? '');
      meta.description = String(j.title ?? '');
      meta.author = String(j.author_name ?? '');
      meta.thumbnailUrl = typeof j.thumbnail_url === 'string' ? j.thumbnail_url : undefined;
    }
  } catch (e) {
    logger.info({ err: (e as Error).message, platform }, 'oembed failed');
  }
  // Open Graph / schema.org on the public page (recipe blogs, many social pages, YouTube description).
  const page = await fetchPage(url);
  if (page) {
    meta.title ||= og(page.html, 'og:title') ?? decode(page.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]);
    const desc = og(page.html, 'og:description') ?? og(page.html, 'description');
    if (desc && (!meta.description || desc.length > meta.description.length)) meta.description = desc;
    meta.thumbnailUrl ||= og(page.html, 'og:image');
    const recipe = extractJsonLdRecipe(page.html);
    if (recipe) {
      meta.structured = recipe.text;
      meta.title ||= recipe.name;
      meta.thumbnailUrl ||= recipe.image;
    }
  }
  return { ...meta, title: decode(meta.title), description: decode(meta.description) };
}

/* ------------------------------------------------------------------ user uploads (saved video / screenshots) */
interface Upload {
  userId: string;
  path: string;
  mimeType: string;
  expiresAt: number;
}
const uploads = new Map<string, Upload>();
const UPLOAD_TTL = 30 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [id, u] of uploads) {
    if (u.expiresAt < now) {
      uploads.delete(id);
      unlink(u.path).catch(() => undefined);
    }
  }
}, 5 * 60_000).unref();

/**
 * Step 1 for media imports: upload one video (≤ 80 MB) or image. The bytes
 * are kept in a temp file for 30 minutes at most and deleted after use.
 */
importRouter.post(
  '/uploads',
  aiLimiter,
  raw({ type: ['video/*', 'image/*'], limit: '80mb' }),
  wrap(async (req, res) => {
    const u = authUser(req);
    const mimeType = (req.get('content-type') ?? '').split(';')[0]!.trim();
    if (!/^(video|image)\//.test(mimeType)) throw AppError.badRequest('Upload a video or an image.');
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length < 100) throw AppError.badRequest('The file is empty.');
    if (mimeType.startsWith('video/') && !videoConfigured()) throw AppError.notImplemented('Reading videos (needs the Gemini key)');
    if (mimeType.startsWith('image/') && buf.length > 8_000_000) throw AppError.badRequest('Images must be under 8 MB.');
    const id = randomUUID();
    const file = path.join(tmpdir(), `fridgr-import-${id}`);
    await writeFile(file, buf);
    uploads.set(id, { userId: u.id, path: file, mimeType, expiresAt: Date.now() + UPLOAD_TTL });
    res.status(201).json({ uploadId: id, kind: mimeType.startsWith('video/') ? 'video' : 'image', bytes: buf.length });
  }),
);

/* ------------------------------------------------------------------ import */
const importInput = z
  .object({
    url: z.string().url().max(500).optional(),
    /** Caption / ingredient list the user pasted. */
    text: z.string().trim().max(6000).optional(),
    /** Saved video and/or screenshots uploaded through /uploads. */
    uploadIds: z.array(z.string().uuid()).max(6).optional(),
    servings: z.number().int().min(1).max(12).optional(),
  })
  .refine((v) => v.url || (v.text && v.text.length > 20) || v.uploadIds?.length, { message: 'Paste a link, the recipe text, or add the video.' });

type FoundVia = 'page_data' | 'linked_page' | 'video' | 'user_video' | 'screenshots' | 'caption' | 'pasted_text';

const IMPORT_SYSTEM = (allergens: string[]) =>
  `You turn cooking videos, social captions and recipe pages into complete, cookable recipes.
- Keep the creator's dish and intent. Do not invent a different recipe.
- Include EVERY ingredient that is shown, said or written, with its quantity. When a quantity is not given, estimate a sensible home-cook amount.
- Write EVERY step in order, with temperatures, times and visual cues ("until golden"). Add a timer only for waits.
- If a source gives the full recipe (schema.org data or a recipe page), follow it exactly.
- Titles in sentence case, British English, metric units (convert cups/oz/°F).
- found=false only when there is genuinely no dish being cooked.${allergens.length ? `\n- The user is allergic to ${allergens.join(', ')}: keep the recipe faithful; the app warns them.` : ''}`;

importRouter.post(
  '/',
  aiLimiter,
  body(importInput),
  wrap(async (req, res) => {
    const u = authUser(req);
    if (!aiConfigured()) throw AppError.notImplemented('Recipe import');
    const input = req.body as z.infer<typeof importInput>;
    const platform: Platform = input.url ? detectPlatform(input.url) : 'web';
    const myUploads = (input.uploadIds ?? []).map((id) => {
      const up = uploads.get(id);
      if (!up || up.userId !== u.id) throw AppError.badRequest('That upload expired. Add the file again.');
      return { id, ...up };
    });
    await consumeQuota(u.id, u.isPremium, 'imports');

    const jobId = await startJob({
      userId: u.id,
      feature: 'import_normalise',
      quota: 'imports',
      model: config.GEMINI_API_KEY ? config.GEMINI_MODEL : config.AI_MODEL_CHEAP,
      request: { url: input.url, textLength: input.text?.length ?? 0, platform, uploads: myUploads.map((x) => x.mimeType) },
      run: async (id) => {
        const geminiFiles: string[] = [];
        try {
          const meta = input.url ? await fetchMeta(input.url, platform) : {};
          // Creator's own recipe page linked from the caption/description/pasted text.
          const linked = meta.structured ? null : await followRecipeLinks([meta.description ?? '', input.text ?? ''], meta.title);
          const structured = meta.structured ?? linked?.text;

          const corpus = [
            meta.title && `TITLE: ${meta.title}`,
            meta.author && `CREATOR: ${meta.author}`,
            meta.description && `CAPTION / DESCRIPTION:\n${meta.description}`,
            structured && `FULL RECIPE FROM THE ${linked ? `CREATOR'S RECIPE PAGE (${linked.url})` : 'PAGE'}:\n${structured}`,
            input.text && `TEXT PROVIDED BY THE USER:\n${input.text}`,
          ]
            .filter(Boolean)
            .join('\n\n');

          // Media for the model: a public YouTube video, plus anything the user uploaded.
          const videos: VideoInput[] = [];
          const images: ImageInput[] = [];
          const watch = platform === 'youtube' && input.url ? youtubeWatchUrl(input.url) : null;
          if (watch && !structured && videoConfigured()) videos.push({ fileUri: watch });
          for (const up of myUploads) {
            if (up.mimeType.startsWith('video/')) {
              const f = await geminiUploadFile(up.path, up.mimeType, `fridgr-import-${up.id}`);
              geminiFiles.push(f.name);
              videos.push({ fileUri: f.uri, mimeType: f.mimeType });
            } else {
              images.push({ base64: (await readFile(up.path)).toString('base64'), mediaType: (['image/png', 'image/webp'].includes(up.mimeType) ? up.mimeType : 'image/jpeg') as ImageInput['mediaType'] });
            }
          }

          if (corpus.replace(/\s+/g, ' ').length < 40 && !videos.length && !images.length) {
            return { found: false, needsText: true, reason: 'That post does not share its recipe publicly. Add the saved video or screenshots, or paste the caption.', meta: { title: meta.title, author: meta.author, thumbnailUrl: meta.thumbnailUrl } };
          }

          const foundVia: FoundVia = structured ? (linked ? 'linked_page' : 'page_data') : myUploads.some((x) => x.mimeType.startsWith('video/')) ? 'user_video' : videos.length ? 'video' : images.length ? 'screenshots' : input.text ? 'pasted_text' : 'caption';
          const ctx = await buildPersonalContext(u.id);
          const ask = (withMedia: boolean) =>
            structuredWithRetry({
              model: structured ? 'cheap' : 'primary',
              system: IMPORT_SYSTEM(ctx.hardConstraints.allergens),
              user: `${withMedia && videos.length ? 'Watch the whole video and listen to the audio. Read every on-screen text and caption. ' : ''}${withMedia && images.length ? 'Read the screenshots carefully (caption, comments with the recipe, on-screen text). ' : ''}Write the complete recipe from this ${platform === 'web' ? 'page' : `${platform} post`}.${input.servings ? ` Scale it to ${input.servings} servings.` : ''}\n\n${corpus || '(no text available — use the media)'}`,
              videos: withMedia ? videos : undefined,
              images: withMedia ? images : undefined,
              tool: { name: 'extracted_recipe', description: 'The full structured recipe, or found=false.', inputSchema: importJson },
              schema: importResult,
              maxTokens: 5000,
            });

          let result;
          try {
            result = await ask(!structured && (videos.length > 0 || images.length > 0));
          } catch (e) {
            // Video unreadable (private, too long, region-blocked): fall back to the text we have.
            if ((videos.length || images.length) && corpus.length > 40) {
              logger.warn({ err: (e as Error).message }, 'media import failed, falling back to text');
              result = await ask(false);
            } else throw e;
          }
          await recordUsage(id, result);
          if (!result.data.found || !result.data.recipe) {
            return { found: false, needsText: true, reason: result.data.reason ?? 'No full recipe in that post. Add the saved video or screenshots, or paste the caption.', meta: { title: meta.title, author: meta.author, thumbnailUrl: meta.thumbnailUrl } };
          }
          const r = result.data.recipe;
          const n = await estimateNutrition(r);
          const image = meta.thumbnailUrl ?? linked?.image;
          const created = await createRecipeRecord({
            authorId: u.id,
            origin: 'imported',
            aiGenerationId: id,
            input: {
              title: r.title,
              description: r.description,
              cuisine: r.cuisine,
              effort: r.effort,
              style: r.style,
              prepTimeMin: r.prepTimeMin,
              servings: r.servings,
              tone: r.tone,
              imageUrl: image && /^https?:\/\//.test(image) ? image.slice(0, 500) : undefined,
              kcal: n.kcal,
              proteinG: n.proteinG,
              carbsG: n.carbsG,
              fatG: n.fatG,
              ingredients: r.ingredients.map((i) => ({ name: i.name, amount: i.amount, isOptional: !!i.isOptional })),
              steps: r.steps.map((s) => ({ phase: s.phase, instruction: s.instruction, timerSec: s.timerSec, ingredients: s.ingredients })),
              visibility: 'private',
            },
          });
          await prisma.recipe.update({ where: { id: created.id }, data: { nutritionSource: n.source, nutritionConfidence: n.confidence, videoUrl: watch ?? undefined, sourceUrl: linked?.url?.slice(0, 500) } });
          if (input.url) {
            const source = await prisma.socialImportSource.upsert({
              where: { url: input.url },
              create: { platform, url: input.url, creatorHandle: meta.authorHandle ?? (meta.author ? `@${meta.author.replace(/\s+/g, '').toLowerCase()}` : undefined), creatorName: meta.author, title: meta.title?.slice(0, 200), thumbnailUrl: meta.thumbnailUrl?.slice(0, 500) },
              update: { creatorName: meta.author, title: meta.title?.slice(0, 200), thumbnailUrl: meta.thumbnailUrl?.slice(0, 500), fetchedAt: new Date() },
            });
            await prisma.importedRecipe.create({ data: { recipeId: created.id, userId: u.id, sourceId: source.id, method: foundVia, rawText: corpus.slice(0, 8000) } });
          }
          return { found: true, recipeId: created.id, foundVia, linkedRecipeUrl: linked?.url, allergenHits: ctx.hardConstraints.allergens.filter((a) => created.allergens.includes(a)) };
        } finally {
          // Uploaded media never outlives the import.
          for (const name of geminiFiles) await geminiDeleteFile(name);
          for (const up of myUploads) {
            uploads.delete(up.id);
            await unlink(up.path).catch(() => undefined);
          }
        }
      },
    });
    res.status(202).json({ jobId, status: 'running' });
  }),
);

importRouter.get(
  '/:jobId',
  params(z.object({ jobId: z.string().uuid() })),
  wrap(async (req, res) => {
    const u = authUser(req);
    const job = await getJob(u.id, req.params.jobId, 'import_normalise');
    if (job.status !== 'done') return res.json({ jobId: job.id, status: job.status, error: job.error ?? undefined });
    const out = (job.responseJson ?? {}) as { found?: boolean; recipeId?: string; reason?: string; needsText?: boolean; meta?: unknown; allergenHits?: string[]; foundVia?: FoundVia; linkedRecipeUrl?: string };
    if (!out.found || !out.recipeId) return res.json({ jobId: job.id, status: 'done', found: false, needsText: !!out.needsText, reason: out.reason, meta: out.meta });
    const row = await prisma.recipe.findUnique({ where: { id: out.recipeId }, include: recipeInclude });
    const [recipe] = row ? await decorateRecipes(u.id, [row]) : [];
    res.json({ jobId: job.id, status: 'done', found: true, recipe, foundVia: out.foundVia, linkedRecipeUrl: out.linkedRecipeUrl, allergenHits: out.allergenHits ?? [] });
  }),
);
