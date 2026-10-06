import { readFile } from 'node:fs/promises';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/**
 * Google Gemini over plain REST (no SDK dependency).
 *  - structured JSON output via responseSchema
 *  - images inline, videos through the Files API, and public YouTube URLs
 *    passed straight to the model (Google's own, documented video input)
 */
const BASE = 'https://generativelanguage.googleapis.com';

export const geminiConfigured = () => !!config.GEMINI_API_KEY;

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  fileData?: { mimeType?: string; fileUri: string };
}

/** JSON Schema (our tool schemas) → Gemini's OpenAPI subset. */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const src = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof src.type === 'string') out.type = src.type.toUpperCase();
  if (typeof src.description === 'string') out.description = src.description;
  if (Array.isArray(src.enum)) out.enum = src.enum;
  if (src.items) out.items = toGeminiSchema(src.items);
  if (src.properties && typeof src.properties === 'object') {
    out.properties = Object.fromEntries(Object.entries(src.properties as Record<string, unknown>).map(([k, v]) => [k, toGeminiSchema(v)]));
  }
  if (Array.isArray(src.required)) out.required = src.required;
  return out;
}

export interface GeminiResult {
  json: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Error from one model attempt; `retryable` means another model (or a retry) may succeed. */
class GeminiAttemptError extends Error {
  constructor(public readonly status: number, public readonly retryable: boolean, public readonly appError: AppError) {
    super(appError.message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Models that just answered busy/unavailable are skipped for a while (free tier is often saturated). */
const cooldownUntil = new Map<string, number>();
const COOLDOWN_MS = 2 * 60_000;

/**
 * Tries each model in order. Free-tier models are often briefly "busy"
 * (503) or rate-limited (429), and older ones get retired (404): those move
 * on to the next model, with one short retry first for busy/rate-limited.
 */
export async function geminiGenerate(opts: { models: string[]; system: string; parts: GeminiPart[]; schema: unknown; maxTokens?: number; timeoutMs?: number }): Promise<GeminiResult> {
  let last: AppError = new AppError(503, 'UPSTREAM', 'AI is not configured on this server.');
  const now = Date.now();
  const ready = opts.models.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
  // If every model is cooling down, still try them all rather than fail.
  for (const model of ready.length ? ready : opts.models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await geminiGenerateOnce({ ...opts, model });
      } catch (e) {
        if (!(e instanceof GeminiAttemptError)) throw e;
        last = e.appError;
        if (!e.retryable) throw e.appError;
        // Busy (503) or retired (404): move to the next model at once. Rate limited (429): one short retry.
        if (e.status === 503 || e.status === 404 || e.status === 504) cooldownUntil.set(model, Date.now() + (e.status === 404 ? 24 * 3_600_000 : COOLDOWN_MS));
        if (e.status !== 429 || attempt === 1) break;
        await sleep(1200);
      }
    }
    logger.warn({ model }, 'gemini model unavailable, trying the next one');
  }
  throw last;
}

async function geminiGenerateOnce(opts: { model: string; system: string; parts: GeminiPart[]; schema: unknown; maxTokens?: number; timeoutMs?: number }): Promise<GeminiResult> {
  if (!config.GEMINI_API_KEY) throw new AppError(503, 'UPSTREAM', 'AI is not configured on this server.');
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: 'user', parts: opts.parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(opts.schema),
      maxOutputTokens: Math.max(8192, (opts.maxTokens ?? 4096) * 2),
      temperature: 0.6,
      // Gemini 3.x: low thinking keeps answers fast; quality is still high for recipes.
      ...(/^gemini-3/.test(opts.model) ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
    },
  };
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 150_000),
    });
  } catch (e) {
    logger.error({ err: (e as Error).message, model: opts.model }, 'gemini request failed');
    throw new GeminiAttemptError(504, true, new AppError(502, 'UPSTREAM', 'The kitchen brain is busy. Try again in a moment.'));
  }
  const json = (await res.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
    error?: { code?: number; message?: string; status?: string };
  };
  if (!res.ok) {
    const msg = json.error?.message ?? '';
    logger.warn({ status: res.status, model: opts.model, error: msg.slice(0, 200) }, 'gemini error');
    if (res.status === 429) throw new GeminiAttemptError(429, true, new AppError(429, 'RATE_LIMITED', 'The free AI quota is busy right now. Try again in a minute.'));
    if (res.status === 400 && /thinking/i.test(msg)) throw new GeminiAttemptError(404, true, new AppError(502, 'UPSTREAM', 'The kitchen brain is busy. Try again in a moment.'));
    if (res.status === 400 && /video|youtube|file|media/i.test(msg)) throw new GeminiAttemptError(400, false, new AppError(400, 'VALIDATION', 'That video could not be read. Is it public and under an hour?'));
    const retryable = res.status === 404 || res.status >= 500;
    throw new GeminiAttemptError(res.status, retryable, new AppError(502, 'UPSTREAM', 'The kitchen brain is busy. Try again in a moment.'));
  }
  const cand = json.candidates?.[0];
  const text = (cand?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
  if (!text) {
    logger.warn({ finishReason: cand?.finishReason }, 'gemini returned no text');
    throw new AppError(502, 'VALIDATION', 'The model produced no result.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError(502, 'VALIDATION', 'The model produced an unusable result.');
  }
  return {
    json: parsed,
    model: opts.model,
    inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: (json.usageMetadata?.candidatesTokenCount ?? 0) + (json.usageMetadata?.thoughtsTokenCount ?? 0),
  };
}

/* ------------------------------------------------------------------ Files API (videos) */
export interface GeminiFile {
  name: string; // files/abc123
  uri: string;
  mimeType: string;
}

/** Uploads a local file with the resumable protocol and waits until Gemini has processed it. */
export async function geminiUploadFile(path: string, mimeType: string, displayName: string): Promise<GeminiFile> {
  if (!config.GEMINI_API_KEY) throw new AppError(503, 'UPSTREAM', 'Video reading needs the Gemini key on the server.');
  const bytes = await readFile(path);
  const start = await fetch(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': config.GEMINI_API_KEY,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName.slice(0, 120) } }),
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) throw new AppError(502, 'UPSTREAM', 'Could not hand the video to the AI.');
  const done = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Length': String(bytes.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bytes,
  });
  const info = (await done.json().catch(() => ({}))) as { file?: { name: string; uri: string; mimeType: string; state?: string } };
  if (!done.ok || !info.file) throw new AppError(502, 'UPSTREAM', 'Could not hand the video to the AI.');
  let file = info.file;
  // Videos are processed asynchronously; wait until ACTIVE (max ~2 min).
  for (let i = 0; i < 60 && file.state && file.state !== 'ACTIVE'; i++) {
    if (file.state === 'FAILED') throw new AppError(400, 'VALIDATION', 'That video could not be processed.');
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(`${BASE}/v1beta/${file.name}`, { headers: { 'x-goog-api-key': config.GEMINI_API_KEY } });
    if (r.ok) file = (await r.json()) as typeof file;
  }
  if (file.state && file.state !== 'ACTIVE') throw new AppError(504, 'UPSTREAM', 'The video took too long to process.');
  return { name: file.name, uri: file.uri, mimeType: file.mimeType ?? mimeType };
}

export async function geminiDeleteFile(name: string) {
  if (!config.GEMINI_API_KEY) return;
  await fetch(`${BASE}/v1beta/${name}`, { method: 'DELETE', headers: { 'x-goog-api-key': config.GEMINI_API_KEY } }).catch(() => undefined);
}

/** Canonical watch URL for any YouTube link form (watch, shorts, youtu.be, embed). */
export function youtubeWatchUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null;
    else if (host.endsWith('youtube.com')) {
      id = u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
      if (!id && m) id = m[2] ?? null;
    }
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
  } catch {
    return null;
  }
}
