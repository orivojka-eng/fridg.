# FRIDGR — External API & Service Requirements

Status: decided for v1.0 production. Every external dependency the app needs, what it does, why, whether it is mandatory, cost notes, env vars and where it is used. The mobile app **never** calls any of these directly; only the FRIDGR API (`server/`) holds the keys.

Legend: **M** = mandatory for launch · **O** = optional / can ship later · **R** = replaceable (interface is abstracted in `server/src/services/*`).

---

## 1. Database — Neon PostgreSQL (M)

| | |
|---|---|
| What | Serverless Postgres with branching. |
| Why | Relational data (users, fridge, recipes, social graph, subscriptions), strong constraints, branches per environment (dev/staging/prod) at low cost. |
| Cost | Free tier for dev; Launch plan (~$19/mo) for prod. Compute scales to zero. |
| Env | `DATABASE_URL` (pooled, `?pgbouncer=true`), `DIRECT_URL` (direct, for migrations). |
| Used in | Every API module via Prisma (`server/src/db.ts`). |

Prisma ORM 5.x is the only database layer. The Expo app has no Prisma client and no DB URL.

## 2. LLM — Recipe generation, adaptation, substitutions, extraction normalisation (M, R)

**Recommended: Anthropic Claude (`claude-sonnet-5` for cost/quality, `claude-haiku-4-5` for cheap normalisation). Alternative: OpenAI `gpt-4.1`/`gpt-4.1-mini`.**

| | |
|---|---|
| What | Structured JSON generation with tool-use / JSON schema so the response always matches the `Recipe` model (ingredients with quantities, servings, steps with timers, prep time, estimated nutrition, allergen flags). |
| Why | The prototype only ranks 7 seeded recipes. Production must generate recipes from the fridge + Food Profile, adapt recipes (swaps, macro boosts) and normalise imported recipes. |
| Hard constraints | Allergies/exclusions are passed as *constraints* and re-validated server-side after generation (recipes containing excluded ingredients are rejected and regenerated). |
| Cost | Sonnet ≈ $3/M input, $15/M output. A generation of 6 recipes ≈ 6–8k tokens ≈ $0.05–0.10. Free tier = 5/day → cap cost per free user ≈ $0.50/day worst case; Haiku for retries/normalisation ≈ 10× cheaper. Cache the Food Profile system prompt (prompt caching). |
| Env | `ANTHROPIC_API_KEY`, `AI_MODEL_PRIMARY`, `AI_MODEL_CHEAP`. |
| Used in | `/recipes/generate`, `/recipes/adapt`, `/recipes/import` (normalisation step), `/ai/coach` (Premium). |

## 3. Vision — Food recognition from camera images (M, R)

**Recommended: the same LLM provider's vision input (Claude Sonnet / GPT-4.1 with image input) returning structured `{name, category, quantityGuess, confidence}` candidates.** Specialised alternatives: Google Cloud Vision (label detection, no quantities), Clarifai Food model, LogMeal (paid, food-specific).

| | |
|---|---|
| Why | Multimodal LLMs already handle mixed fridge shelves, packaged goods and quantities, and return JSON in one call. Specialised food models are better on single plated dishes, worse on a full fridge. |
| Flow | Camera → resized JPEG (≤1280px, ≤600 KB) → signed upload to object storage → `/fridge/scan` → vision → candidates with confidence → **user confirms** → fridge. Nothing is added automatically. |
| Cost | ~1–2k image tokens per photo ≈ $0.01–0.02 per scan on Sonnet. Premium "advanced scanning" (brands, expiry dates) uses a second higher-detail pass. |
| Env | reuses `ANTHROPIC_API_KEY`; storage below. |
| Used in | `/fridge/scan`. |

## 4. Object storage for uploads (M)

**Recommended: Cloudflare R2 (S3-compatible, no egress fees). Alternative: AWS S3.**

| | |
|---|---|
| What | Scan photos (short-lived, auto-deleted after 24 h), user recipe cover photos, avatars if custom ones are ever allowed. |
| Why | Images must not go through the API server's memory or be stored in Postgres. Signed upload URLs keep keys server-side. |
| Cost | R2: 10 GB free, then $0.015/GB-month, zero egress. |
| Env | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`. |
| Used in | `/fridge/scan/upload-url`, `/recipes` (cover photo), lifecycle rule deletes `scans/*` after 1 day. |

## 5. Social video recipe extraction (M for the import feature, R)

There is no single vendor that legally extracts from all platforms. Recommended layered approach:

1. **Metadata/oEmbed first (free):** TikTok oEmbed, Instagram oEmbed (requires Meta app + `oembed_read`), YouTube Data API v3 (`videos.list` for title/description/captions availability). Gives title, author, thumbnail, description (which often contains the ingredient list).
2. **Transcript when the platform provides it:** YouTube captions via Data API (public videos with captions only). For TikTok/Instagram there is no official transcript API; **do not scrape or bypass** login/DRM.
3. **LLM normalisation:** description + transcript (+ user-pasted caption text) → structured recipe via the LLM (section 2).
4. **Fallback (always available):** the user pastes the caption / ingredient list, or uploads a screenshot which goes through the vision model. The UI already has the "Extract" card; the fallback is an extra text field.

| | |
|---|---|
| Cost | oEmbed free; YouTube Data API free quota (10k units/day); LLM normalisation ≈ $0.005 per import (Haiku). |
| Env | `YOUTUBE_API_KEY`, `META_APP_ID`, `META_APP_SECRET` (Instagram oEmbed), none for TikTok oEmbed. |
| Compliance | Attribution (author handle, source URL, platform) is stored and displayed; imported recipes are private to the importer unless the user explicitly publishes their own adaptation. |
| Used in | `/recipes/import`. |

## 6. Nutrition data (M, R)

**Recommended: USDA FoodData Central (free, US government, no key limits worth mentioning) for whole ingredients, with Open Food Facts (free, open) for packaged/branded items.** Paid alternatives if accuracy needs improve: Edamam Nutrition Analysis or Nutritionix.

| | |
|---|---|
| Why | AI-estimated nutrition must be labelled as an estimate. Per-ingredient lookup lets the server compute totals from quantities and mark `nutritionSource = usda | off | ai_estimate` and a confidence. |
| Cost | Free (USDA requires an API key, 1,000 req/hour). Results cached in the `Food` table so repeated ingredients never hit the API twice. |
| Env | `USDA_API_KEY`. |
| Used in | `/foods/nutrition`, recipe creation/import/generation post-processing. |
| Wording | The app shows "Estimated nutrition" and never presents values as medically exact. |

## 7. Ingredient / food database (M — own, seeded)

Decision: **FRIDGR's own normalised `Food` table first.** Seeded with ~600 common ingredients (name, aliases, category, default unit, typical shelf life, allergen flags, per-100 g nutrition from USDA). External lookups (section 6) only fill gaps and are cached back into the table. This keeps matching deterministic (the existing `src/lib/matching.ts` alias logic moves server-side) and avoids per-request vendor calls.

## 8. Transactional email (M)

**Recommended: Resend (simple API, React templates). Alternatives: Postmark, AWS SES.**

| | |
|---|---|
| What | Email verification codes, password reset links, account-deletion confirmation, subscription receipts are Apple's job (not ours). |
| Cost | Resend free: 3,000/mo; then $20/mo. |
| Env | `RESEND_API_KEY`, `EMAIL_FROM` (verified domain, e.g. `hello@fridgr.app`). |
| Used in | `/auth/register`, `/auth/resend-code`, `/auth/forgot-password`, `/account/delete`. |

## 9. Push notifications (M)

**Expo Push Service (EAS) → APNs / FCM.** No third-party vendor needed.

| | |
|---|---|
| What | Expiry reminders ("Spinach expires in 2 days"), cooking timers when backgrounded (local notifications), creator posts, weekly plan ready. |
| Cost | Free. |
| Env | `EXPO_ACCESS_TOKEN` (server, for the push API), APNs key configured in EAS credentials. |
| Used in | `/notifications/register-device`, scheduled job `expiry-reminders` (daily), `/social` events. |

## 10. Subscriptions — RevenueCat + Apple In-App Purchase (M)

| | |
|---|---|
| What | Apple IAP is the payment mechanism (required for digital subscriptions). RevenueCat manages products, entitlements, receipts, restore, cross-device sync and sends webhooks to our API. |
| Products | `fridgr_premium_monthly` (€6.99), `fridgr_premium_yearly` (€42.00), 7-day free trial as an introductory offer on both. Entitlement id: `premium`. |
| Cost | RevenueCat free up to $2.5k MTR, then 1%. Apple takes 15% (Small Business Program) / 30%. |
| Env (server) | `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`. |
| Env (app) | `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (public SDK keys, safe in the client). |
| Used in | `react-native-purchases` in the app (already installed) for purchase/restore/manage; `/subscriptions/webhook` and `/subscriptions/me` on the server as the source of truth for `isPremium`. |

## 11. Sign in with Apple (M) and Google Sign-In (O)

| | |
|---|---|
| Apple | `expo-apple-authentication` in the app; server verifies the identity token against Apple's JWKS (`https://appleid.apple.com/auth/keys`), checks `aud` = bundle id, stores the stable `sub` in `AuthProvider`. Private relay emails are stored as the account email. On account deletion the server calls Apple's token revocation endpoint (`/auth/revoke`) with a client secret JWT signed by the Sign in with Apple key. |
| Google | `expo-auth-session` (Google provider); server verifies the ID token against Google's JWKS. Optional; if kept, Apple requires Sign in with Apple to be offered too (already the case). |
| Env | `APPLE_BUNDLE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (p8, for revocation client secret), `GOOGLE_CLIENT_ID_IOS`, `GOOGLE_CLIENT_ID_ANDROID`. |

## 12. Hosting for the API (M)

**Recommended: Fly.io or Railway (long-lived Node process, cron for reminders). Alternative: Vercel Serverless (fine for request/response, weaker for scheduled jobs).**

| | |
|---|---|
| Env | `PORT`, `NODE_ENV`, `APP_ENV` (`development|staging|production`), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGINS`, `LOG_LEVEL`, `SENTRY_DSN` (optional). |

## 13. Error monitoring (O)

Sentry (`@sentry/react-native` + `@sentry/node`). Free tier is enough. Never send request bodies containing food/health data; scrub `foodProfile`, `allergies`, `dislikes` fields (configured in the Sentry `beforeSend`).

## 14. Analytics (O, privacy-first)

If needed at all: PostHog (self-host or EU cloud) with **no** food/health properties, only screen and feature usage counts. Off by default; disclosed on the Privacy Nutrition Label as "Product Interaction — not linked to identity".

---

## Recommended stack summary

| Concern | Choice | Mandatory |
|---|---|---|
| DB | Neon Postgres + Prisma | M |
| API | Node 20 + Express + Zod + Prisma, hosted on Fly.io | M |
| Auth | Better Auth (email + password with argon2, 6-digit email codes, reset links, Sign in with Apple, optional Google); 30-day sliding sessions as bearer tokens in `expo-secure-store` | M |
| LLM | Anthropic Claude (Sonnet 5 primary, Haiku 4.5 cheap) | M |
| Vision | Claude image input | M |
| Storage | Cloudflare R2 with signed URLs | M |
| Import | oEmbed + YouTube Data API + LLM normalisation + manual fallback | M |
| Nutrition | Own `Food` table seeded from USDA; Open Food Facts for packaged | M |
| Email | Resend | M |
| Push | Expo Push → APNs/FCM | M |
| Subscriptions | RevenueCat + Apple IAP | M |
| Monitoring | Sentry | O |
| Analytics | PostHog, no health data | O |

## Environment variable index

Server (`server/.env`, never committed):
```
APP_ENV, NODE_ENV, PORT, LOG_LEVEL, CORS_ORIGINS
DATABASE_URL, DIRECT_URL
BETTER_AUTH_SECRET, BETTER_AUTH_URL
APPLE_BUNDLE_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
GOOGLE_CLIENT_ID_IOS, GOOGLE_CLIENT_ID_ANDROID
ANTHROPIC_API_KEY, AI_MODEL_PRIMARY, AI_MODEL_CHEAP
S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_BASE_URL
USDA_API_KEY, YOUTUBE_API_KEY, META_APP_ID, META_APP_SECRET
RESEND_API_KEY, EMAIL_FROM
EXPO_ACCESS_TOKEN
REVENUECAT_SECRET_API_KEY, REVENUECAT_WEBHOOK_SECRET
SENTRY_DSN
```
App (`.env`, `EXPO_PUBLIC_*` only — these are shipped inside the binary and must never be secrets):
```
EXPO_PUBLIC_API_URL, EXPO_PUBLIC_REVENUECAT_IOS_KEY, EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, EXPO_PUBLIC_USE_BACKEND
```
