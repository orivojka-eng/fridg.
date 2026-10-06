import Anthropic from '@anthropic-ai/sdk';
import type { ZodTypeAny, z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { geminiConfigured, geminiGenerate, type GeminiPart } from './gemini.js';

const anthropic = config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 90_000 }) : null;

export type Provider = 'anthropic' | 'gemini';

/** Which provider answers text/image calls: explicit setting, else Anthropic when keyed, else Gemini. */
export function activeProvider(): Provider | null {
  if (config.AI_PROVIDER === 'anthropic' && anthropic) return 'anthropic';
  if (config.AI_PROVIDER === 'gemini' && geminiConfigured()) return 'gemini';
  if (anthropic) return 'anthropic';
  if (geminiConfigured()) return 'gemini';
  return null;
}

export const aiConfigured = () => activeProvider() !== null;
/** Video understanding (YouTube URLs, uploaded clips) is Gemini-only. */
export const videoConfigured = () => geminiConfigured();

export interface ImageInput {
  /** base64 without the data: prefix */
  base64?: string;
  url?: string;
  mediaType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/** Video for Gemini: a public YouTube watch URL, or a Files API uri. */
export interface VideoInput {
  fileUri: string;
  mimeType?: string;
}

export interface StructuredCall<S extends ZodTypeAny> {
  model?: 'primary' | 'cheap';
  system: string;
  user: string;
  images?: ImageInput[];
  /** Forces Gemini. */
  videos?: VideoInput[];
  /** Name of the tool the model must call; the JSON schema is what the model fills in. */
  tool: { name: string; description: string; inputSchema: Record<string, unknown> };
  /** Zod schema that validates the output after the call. */
  schema: S;
  maxTokens?: number;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  provider: Provider;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// USD per million tokens (input, output). Gemini free tier is billed at 0.
const PRICES: Record<string, [number, number]> = {
  'claude-sonnet-5': [3, 15],
  'claude-opus-5': [15, 75],
  'claude-haiku-4-5-20251001': [1, 5],
};
const cost = (provider: Provider, model: string, inTok: number, outTok: number) => {
  if (provider === 'gemini') return 0;
  const [pi, po] = PRICES[model] ?? PRICES['claude-sonnet-5']!;
  return (inTok * pi + outTok * po) / 1_000_000;
};

function validate<S extends ZodTypeAny>(schema: S, value: unknown, model: string): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues.slice(0, 5), model }, 'model output failed schema');
    throw new AppError(502, 'VALIDATION', 'The model produced an unusable result.');
  }
  return parsed.data;
}

async function viaAnthropic<S extends ZodTypeAny>(call: StructuredCall<S>): Promise<StructuredResult<z.infer<S>>> {
  if (!anthropic) throw new AppError(503, 'UPSTREAM', 'AI is not configured on this server.');
  const model = call.model === 'cheap' ? config.AI_MODEL_CHEAP : config.AI_MODEL_PRIMARY;
  const content: Anthropic.MessageParam['content'] = [];
  for (const img of call.images ?? []) {
    if (img.base64) content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType ?? 'image/jpeg', data: img.base64 } });
    else if (img.url) content.push({ type: 'image', source: { type: 'url', url: img.url } });
  }
  content.push({ type: 'text', text: call.user });

  let res: Anthropic.Message;
  try {
    res = await anthropic.messages.create({
      model,
      max_tokens: call.maxTokens ?? 4096,
      system: [{ type: 'text', text: call.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
      tools: [{ name: call.tool.name, description: call.tool.description, input_schema: call.tool.inputSchema as Anthropic.Tool['input_schema'] }],
      tool_choice: { type: 'tool', name: call.tool.name },
    });
  } catch (e) {
    logger.error({ err: e, model }, 'anthropic call failed');
    throw new AppError(502, 'UPSTREAM', 'The kitchen brain is busy. Try again in a moment.');
  }
  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!block) throw new AppError(502, 'UPSTREAM', 'The model returned no structured result.');
  const data = validate(call.schema, block.input, model);
  const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
  return { data, model, provider: 'anthropic', inputTokens, outputTokens: res.usage.output_tokens, costUsd: cost('anthropic', model, inputTokens, res.usage.output_tokens) };
}

async function viaGemini<S extends ZodTypeAny>(call: StructuredCall<S>): Promise<StructuredResult<z.infer<S>>> {
  const list = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
  // Cheap tasks fall back to the stronger list too, so a busy lite model never blocks an import.
  const models = call.model === 'cheap' && !call.videos?.length ? [...list(config.GEMINI_MODEL_CHEAP), ...list(config.GEMINI_MODEL)] : list(config.GEMINI_MODEL);
  const parts: GeminiPart[] = [];
  for (const v of call.videos ?? []) parts.push({ fileData: { fileUri: v.fileUri, ...(v.mimeType ? { mimeType: v.mimeType } : {}) } });
  for (const img of call.images ?? []) {
    if (img.base64) parts.push({ inlineData: { mimeType: img.mediaType ?? 'image/jpeg', data: img.base64 } });
    else if (img.url) {
      // Signed storage URLs: Gemini needs the bytes inline.
      const r = await fetch(img.url, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new AppError(400, 'VALIDATION', 'Could not read that photo.');
      parts.push({ inlineData: { mimeType: r.headers.get('content-type') ?? img.mediaType ?? 'image/jpeg', data: Buffer.from(await r.arrayBuffer()).toString('base64') } });
    }
  }
  parts.push({ text: `${call.user}\n\nReturn only the JSON object for "${call.tool.name}": ${call.tool.description}` });
  const res = await geminiGenerate({ models, system: call.system, parts, schema: call.tool.inputSchema, maxTokens: call.maxTokens, timeoutMs: call.videos?.length ? 240_000 : 150_000 });
  const data = validate(call.schema, res.json, res.model);
  return { data, model: res.model, provider: 'gemini', inputTokens: res.inputTokens, outputTokens: res.outputTokens, costUsd: 0 };
}

/**
 * One structured call. Videos always go to Gemini (the only provider that
 * watches them); everything else goes to the active provider. Throws
 * UPSTREAM on provider failure and VALIDATION on unusable output.
 */
export async function structured<S extends ZodTypeAny>(call: StructuredCall<S>): Promise<StructuredResult<z.infer<S>>> {
  if (call.videos?.length) {
    if (!geminiConfigured()) throw new AppError(501, 'NOT_IMPLEMENTED', 'Reading videos needs the Gemini key on the server.');
    return viaGemini(call);
  }
  const provider = activeProvider();
  if (!provider) throw new AppError(503, 'UPSTREAM', 'AI is not configured on this server.');
  return provider === 'anthropic' ? viaAnthropic(call) : viaGemini(call);
}

/** Retries once on schema failure (LLM output is occasionally malformed). */
export async function structuredWithRetry<S extends ZodTypeAny>(call: StructuredCall<S>) {
  try {
    return await structured(call);
  } catch (e) {
    if (e instanceof AppError && e.code === 'VALIDATION' && e.status === 502) return structured(call);
    throw e;
  }
}
