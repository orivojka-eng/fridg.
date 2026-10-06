import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGINS: z.string().default(''),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),

  // Better Auth: signs sessions and encrypts secrets at rest. Generate with `openssl rand -base64 32`.
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  /** Public URL of this API (used in email links). */
  BETTER_AUTH_URL: z.string().url().optional(),
  SESSION_DAYS: z.coerce.number().default(30),
  /** Reverse-proxy hops in front of the API, used to find the real client IP for rate limits (Render: 1). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),

  APPLE_BUNDLE_ID: z.string().default('com.fridgr.app'),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID_IOS: z.string().optional(),
  GOOGLE_CLIENT_ID_WEB: z.string().optional(),
  GOOGLE_CLIENT_ID_ANDROID: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_PRIMARY: z.string().default('claude-sonnet-5'),
  AI_MODEL_CHEAP: z.string().default('claude-haiku-4-5-20251001'),

  // Google Gemini: free tier; reads public YouTube videos and uploaded videos natively.
  GEMINI_API_KEY: z.string().optional(),
  /** Comma-separated, tried in order when a model is busy or unavailable (free tier). */
  GEMINI_MODEL: z.string().default('gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-flash-latest,gemini-3.5-flash-lite,gemini-flash-lite-latest'),
  GEMINI_MODEL_CHEAP: z.string().default('gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.1-flash-lite'),
  /** anthropic | gemini; default: anthropic when its key exists, else gemini. */
  AI_PROVIDER: z.enum(['anthropic', 'gemini']).optional(),

  // Recipe databases. TheMealDB works with the public test key '1'; Spoonacular is optional.
  MEALDB_API_KEY: z.string().default('1'),
  SPOONACULAR_API_KEY: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  USDA_API_KEY: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),

  // Email, first configured wins (or force with EMAIL_PROVIDER). All have free tiers.
  RESEND_API_KEY: z.string().optional(),
  /** Brevo transactional API key (free 300/day; a verified single sender is enough, no domain needed). */
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('FRIDGR <hello@fridgr.app>'),
  // Any SMTP account, e.g. Brevo's SMTP relay or a dedicated Gmail with an app password.
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** resend | brevo | smtp; default: the first configured in that order; development falls back to the log. */
  EMAIL_PROVIDER: z.enum(['resend', 'brevo', 'smtp']).optional(),

  EXPO_ACCESS_TOKEN: z.string().optional(),

  REVENUECAT_SECRET_API_KEY: z.string().optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  SUPPORT_INBOX: z.string().email().optional(),
  DEMO_MODE: bool,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid server configuration:\n${issues}`);
  process.exit(1);
}

/** Problems that make a production deployment unsafe or broken (email links, cookies, CORS). */
function productionProblems(env: z.infer<typeof schema>) {
  const out: string[] = [];
  if (env.APP_ENV !== 'production') return out;
  const url = env.BETTER_AUTH_URL;
  if (!url) out.push('BETTER_AUTH_URL is required in production (the public https URL of this API)');
  else if (!url.startsWith('https://')) out.push('BETTER_AUTH_URL must start with https:// in production');
  else if (/\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url)) out.push('BETTER_AUTH_URL must be a public address, not localhost or a LAN IP');
  return out;
}
const problems = productionProblems(parsed.data);
if (problems.length) {
  // eslint-disable-next-line no-console
  console.error(`Invalid production configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.APP_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  freeGenerationsPerDay: 5,
  freeScansPerDay: 10,
  freeImportsPerDay: 3,
};

export type Config = typeof config;
