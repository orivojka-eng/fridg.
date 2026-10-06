# FRIDGR — Backend & Production Architecture

Companion to `FRIDGR_API_REQUIREMENTS.md`. This is the plan the implementation follows; the UI, screens, flows and design system in `app/` and `src/` stay as they are.

> **Current state (October 2026):** the zero-budget build replaced several choices below — Render instead of Fly.io, Gemini instead of Anthropic, Brevo/Resend API email, no object storage, Better Auth tables (User/Session/Account/Verification) instead of AuthProvider/EmailVerification/PasswordReset. `docs/FINAL_PROJECT_INVENTORY.md` is the up-to-date description; `docs/DEPLOYMENT.md` is the runbook.

## 1. Final technology stack

- **Mobile:** Expo SDK 57, React Native 0.86, TypeScript, Expo Router, Zustand, existing FRIDGR design system. New: `src/api/*` typed client, `expo-secure-store` for tokens, `expo-apple-authentication`, `react-native-purchases`, `expo-notifications`.
- **API:** Node 20, Express 4, TypeScript (ESM), Zod validation, Prisma 5, `jose` (JWT + Apple/Google JWKS), `argon2` password hashing, `express-rate-limit`, `helmet`, `pino` logging. Deployed on Fly.io (one machine per environment), `/health` for checks.
- **Database:** Neon Postgres, one project with three branches: `main` (production), `staging`, `dev`. Prisma migrations applied with `prisma migrate deploy` in CI.
- **AI:** Anthropic Claude via the server only. **Storage:** Cloudflare R2. **Email:** Resend. **Push:** Expo Push. **Payments:** Apple IAP through RevenueCat.

## 2. Database schema (ERD in words)

```
User 1─1 UserProfile 1─1 FoodProfile
User 1─* AuthProvider (apple | google)          User 1─* Session (refresh tokens)
User 1─* EmailVerification / PasswordReset
User 1─* FridgeItem *─1 Food (normalised ingredient, has FoodCategory)
User 1─* ShoppingList 1─* ShoppingItem
Recipe *─1 User (author, optional)  Recipe 1─* RecipeIngredient *─1 Food
Recipe 1─* RecipeStep      Recipe 1─* RecipeRating / SavedRecipe / Like / Comment
Recipe 0..1 ImportedRecipe *─1 SocialImportSource
User 1─* Collection *─* Recipe (CollectionRecipe)
User *─* User (Follow)
User 1─* CookingSession *─1 Recipe
User 1─* Notification   User 1─* DeviceToken
User 1─* UserSignal (behavioural events feeding the Food Profile)
User 1─* AiGeneration (audit + quota)   User 1─* AiUsageDay (daily counters)
User 0..1 Subscription (RevenueCat mirror)   Subscription 1─* SubscriptionEvent
User 1─* AuditLog   User 0..1 AccountDeletionRequest
```
Rules: UUID PKs, `createdAt/updatedAt` everywhere, `ON DELETE CASCADE` from `User` to all personal data, `SET NULL` for public content authored by a deleted user only where the product decides to keep it (published recipes are **deleted** with the account in v1 — simpler and privacy-safe). Indexes on every FK, on `(userId, expiresAt)` for fridge, on `(userId, createdAt)` for signals/notifications, unique on `(provider, providerUserId)`, `(userId, recipeId)` for saves/likes/ratings, `(followerId, followingId)`.

Full model list: see `prisma/schema.prisma` (this document lists them in section 3).

## 3. Prisma models

`User, AuthProvider, Session, EmailVerification, PasswordReset, UserProfile, FoodProfile, UserAllergy, UserDislike, UserCuisine, Food, FoodCategory, FoodAlias, FridgeItem, Recipe, RecipeIngredient, RecipeStep, RecipeRating, SavedRecipe, Like, Comment, Follow, Collection, CollectionRecipe, ImportedRecipe, SocialImportSource, ShoppingList, ShoppingItem, CookingSession, Notification, DeviceToken, UserSignal, AiGeneration, AiUsageDay, Subscription, SubscriptionEvent, AuditLog, AccountDeletionRequest` plus enums `AuthProviderType, FoodCategoryKind, RecipeEffort, RecipeStyle, RecipeVisibility, RecipeOrigin, NutritionSource, ShoppingCategory, CookingSessionStatus, NotificationKind, SignalKind, AiFeature, SubscriptionStatus, Platform, DeletionStatus`.

## 4. API endpoints (`/v1`)

| Module | Endpoints |
|---|---|
| auth | `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-code`, `POST /auth/login`, `POST /auth/apple`, `POST /auth/google`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| users | `GET /users/me`, `PATCH /users/me`, `GET /users/:id/public` |
| profile | `GET /profile`, `PATCH /profile` (avatar index, bio, theme, notifPrefs) |
| food-profile | `GET /food-profile`, `PUT /food-profile` (all questionnaire answers, hard constraints) |
| fridge | `GET /fridge`, `POST /fridge/items` (batch, merge-by-food), `PATCH /fridge/items/:id`, `DELETE /fridge/items/:id`, `POST /fridge/scan/upload-url`, `POST /fridge/scan` (returns candidates), `POST /fridge/scan/confirm` |
| foods | `GET /foods/search?q=`, `GET /foods/:id`, `GET /foods/nutrition?ids=` |
| recipes | `GET /recipes/:id`, `POST /recipes` (user created), `PATCH/DELETE /recipes/:id`, `GET /recipes/match?ids=` (fridge match %), `POST /recipes/:id/rate`, `POST /recipes/:id/save`, `DELETE /recipes/:id/save`, `GET /recipes/saved` |
| recipes/generate | `POST /recipes/generate` → job id; `GET /recipes/generate/:jobId` (poll; LLM 5–20 s) |
| recipes/adapt | `POST /recipes/:id/adapt` (swaps/boost; returns adapted recipe draft) |
| recipes/import | `POST /recipes/import` (url or pasted text) → job; `GET /recipes/import/:jobId` |
| discover | `GET /discover/feed?tab=for-you|trending|following|quick|high-protein`, `GET /discover/search?q=` |
| social | `POST/DELETE /social/follow/:userId`, `POST/DELETE /social/like/:recipeId`, `GET/POST /social/comments/:recipeId`, `DELETE /social/comments/:id` |
| collections | `GET /collections`, `POST /collections`, `PATCH/DELETE /collections/:id`, `POST/DELETE /collections/:id/recipes/:recipeId` |
| shopping | `GET /shopping`, `POST /shopping/items` (batch, de-dupe), `PATCH /shopping/items/:id`, `DELETE /shopping/items/:id`, `POST /shopping/clear-checked`, `POST /shopping/from-recipe/:recipeId` |
| cooking | `POST /cooking/sessions` (start), `PATCH /cooking/sessions/:id` (step/timer), `POST /cooking/sessions/:id/complete` (rating, consumed fridge items) |
| notifications | `GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read`, `POST /notifications/devices` (Expo push token), `DELETE /notifications/devices/:token` |
| subscriptions | `GET /subscriptions/me`, `POST /subscriptions/sync` (client reports RC customer info), `POST /subscriptions/webhook` (RevenueCat, HMAC verified) |
| ai | `GET /ai/quota`, `POST /ai/coach` (Premium chat over the Food Profile + fridge) |
| account | `POST /account/delete` (confirm → schedule → hard delete), `GET /account/export` (JSON of personal data) |
| meta | `GET /health`, `GET /legal/privacy`, `GET /legal/terms` |

Cross-cutting: `Authorization: Bearer <access JWT>`; Zod-validated bodies; structured errors `{ error: { code, message, details? } }`; rate limits (auth 10/min/IP, AI 20/min/user + daily quota, general 120/min/user); pino request logs with user id but never bodies; ownership checks on every `:id`.

## 5. Authentication architecture (Better Auth)

Better Auth 1.7 runs inside the API (`server/src/auth.ts`), mounted at `/api/auth/*`, on the same Prisma/Neon database (tables `User`, `Session`, `Account`, `Verification`).

- **Sign-up:** `POST /api/auth/sign-up/email` (email, password, name, firstName, lastName). A create hook fills the FRIDGR fields (handle) and creates the profile, Food Profile and shopping list. A 6-digit code is emailed through Resend (email-OTP plugin, hashed at rest, 10 min, 5 attempts).
- **Verify:** `POST /api/auth/email-otp/verify-email`. Data routes on `/v1` require a verified email; the app keeps unverified users on the code screen.
- **Sign-in:** `POST /api/auth/sign-in/email`. Passwords are argon2id (custom hash/verify), so pre-migration hashes still work.
- **Sign in with Apple:** the iPhone gets an identity token from `expo-apple-authentication` and sends it to `POST /api/auth/sign-in/social` (`provider: "apple"`, `idToken`). Better Auth verifies it against Apple's keys with the bundle id as audience. The app then sends Apple's authorization code to `POST /v1/account/apple-token`; the server exchanges it for a refresh token, stores it encrypted, and revokes it when the account is deleted.
- **Google (optional):** same idToken flow once client ids are configured.
- **Sessions:** opaque tokens, 30 days, sliding (renewed daily while used). The bearer plugin returns the token in `set-auth-token`; the app stores it in the keychain and sends `Authorization: Bearer` to `/api/auth` and `/v1`. Sign-out deletes the session.
- **Password reset:** `POST /api/auth/request-password-reset` emails a link; it opens the hosted page `/reset-password`, which calls `/api/auth/reset-password` and signs out all devices.
- **Linking:** Apple/Google with the same verified email join the existing account. If an unverified password account exists for that email, the password is removed (takeover guard).
- **Rate limits:** Better Auth per-route limits (sign-in 10/min, sign-up 5/min, codes 3 per 5 min, reset 5 per 15 min) plus the API's own limits.
- **Deletion:** `POST /v1/account/delete` re-checks the password, revokes Apple, deletes sessions and cascades all personal data.

## 6. AI APIs required

Anthropic Claude (text + vision). Details, costs and constraints in the requirements doc. All prompts live in `server/src/ai/prompts/*` with JSON schemas; outputs are validated with Zod and post-filtered against hard constraints (allergies/dislikes) before being stored as `Recipe(origin=ai_generated)`.

## 7. Third-party services

Neon, Anthropic, Cloudflare R2, Resend, Expo Push, RevenueCat, Apple Developer (Sign in with Apple, IAP), YouTube Data API, Meta oEmbed, USDA FoodData Central, Open Food Facts, Sentry (optional), PostHog (optional).

## 8. Environment variables

Listed in the requirements doc; templates in `server/.env.example` and `.env.example`. Secrets only in Fly secrets / EAS secrets; never in git.

## 9. Data & privacy classification

| Data | Class | Retention | Notes |
|---|---|---|---|
| Email, name, password hash, Apple/Google subject | Account (identifying) | Life of account | Password never logged; Apple relay email treated as email |
| Avatar index, bio, theme, notification prefs | Profile | Life of account | |
| Food Profile answers (goals, eating style, allergies, dislikes…) | **Sensitive: dietary / health-adjacent** | Life of account | Used only for recommendations; never for ads; excluded from analytics & error reports |
| Fridge items, shopping lists | Personal | Life of account | |
| Recipe activity (views, saves, cooks, ratings, signals) | Personal / behavioural | Life of account; signals aggregated after 180 d | |
| Uploaded scan photos | Personal image | **24 h** then deleted | Not used for training |
| Recipe cover photos | User content | Life of recipe | |
| Social URLs imported | Personal | Life of account | Attribution kept |
| Subscription (RC customer id, status) | Financial-adjacent | Life of account + 90 d (support) | No card data ever touches FRIDGR |
| Diagnostics (crash, screen usage) | Diagnostic | 90 d | Opt-out; no food data |

Privacy Nutrition Label (Apple): Contact Info (email, name) — linked; Health & Fitness — **not** collected in Apple's sense (no HealthKit), but dietary preferences are declared under "Other Data Types" linked to identity, used for App Functionality; Photos — collected transiently for App Functionality, not linked (deleted in 24 h); Purchases — linked; Usage Data — optional, not linked; Identifiers (user id) — linked. No tracking (ATT prompt not needed).

## 10. Apple App Store compliance checklist

- [ ] Account deletion inside the app (Profile → Settings → Account → Delete account), completes server-side, revokes Apple tokens (Guideline 5.1.1(v)).
- [ ] Sign in with Apple offered alongside Google (4.8).
- [ ] Privacy policy URL in App Store Connect **and** reachable in-app (`/legal/privacy` rendered in Profile → Privacy) (5.1.1(i)).
- [ ] Terms of Service + subscription terms (price, period, auto-renew, how to cancel) shown on the paywall (3.1.2).
- [ ] Digital subscription sold only via IAP; restore purchases button; manage subscription link (3.1.1, 3.1.2).
- [ ] Camera permission string explains scanning food (`NSCameraUsageDescription`), photo library string for cover photos.
- [ ] Age rating questionnaire: no medical content; "Health & Wellness" topics = infrequent/mild (calorie estimates), no unrestricted web access, no gambling → expected 4+ / 12+ depending on wellness answers. No medical claims anywhere in copy ("estimated nutrition", "not medical advice").
- [ ] App Review notes: demo account (`review@fridgr.app` / password in App Store Connect), demo mode toggle that pre-fills a fridge, explanation of AI generation, scanning, video import (with a public sample URL), Premium features, and that AI features call our own backend.
- [ ] Live backend at review time (staging URL is not enough — production must respond).
- [ ] Support URL and marketing URL, screenshots for 6.7" and 6.1".
- [ ] Export compliance (standard HTTPS only → exempt).
- [ ] Data collection disclosed on the Privacy Nutrition Label (section 9).

## 11. Environments

| | dev | staging | production |
|---|---|---|---|
| API | `http://localhost:4000` / Fly `fridgr-api-dev` | Fly `fridgr-api-staging` | Fly `fridgr-api` |
| DB | Neon branch `dev` | Neon branch `staging` | Neon `main` |
| App | Expo Go / dev build, `EXPO_PUBLIC_USE_BACKEND=true` | TestFlight internal, EAS profile `staging` | TestFlight external / App Store, EAS profile `production` |
| AI | Haiku + low quotas | Sonnet, quotas as prod | Sonnet |
| Email | Resend test domain | real domain, staging tag | real domain |
| RevenueCat | Sandbox | Sandbox | Production |

## 12. Migration plan from the prototype — status

The app keeps working throughout: every store keeps its local behaviour when `EXPO_PUBLIC_USE_BACKEND` is false and switches to the API when it is true. Code for all twelve phases is in place; what remains is provisioning (Neon, keys, Fly, EAS) and device testing against the live services.

| Phase | Scope | Code | Needs |
|---|---|---|---|
| 1 | Prisma schema, `migrations/0001_init`, seed, env templates | done | Neon project → `npm run db:migrate && npm run db:seed` |
| 2 | Express API: config, Prisma, middleware, Better Auth (email + password, email codes, reset links, Apple, Google, bearer sessions), app client + SecureStore + session restore | done | `BETTER_AUTH_SECRET`, Resend key, Apple key for revocation |
| 3 | Profile + Food Profile sync on onboarding/preferences, behaviour signals | done | – |
| 4 | Fridge + shopping through the API (optimistic, reconciled) | done | – |
| 5 | Recipe generation / adaptation with Claude, hard-constraint validation, nutrition, quotas, jobs | done | `ANTHROPIC_API_KEY` |
| 6 | Scanning: signed R2 upload (inline fallback), vision candidates with confidence, user confirmation | done | R2 bucket (optional), Anthropic key |
| 7 | Social import: oEmbed / Open Graph / schema.org + LLM normalisation, paste-caption fallback, attribution | done | `YOUTUBE_API_KEY` (optional) |
| 8 | Discover feed (allergen-safe, cuisine-weighted), likes, follows, comments, collections, cooking sessions | done | – |
| 9 | RevenueCat SDK in the paywall (purchase / restore / manage), webhook, entitlement mirror | done | RC products + keys |
| 10 | Device tokens, daily expiry reminders (in-app + push), housekeeping | done | `EXPO_ACCESS_TOKEN`, APNs key |
| 11 | In-app account deletion (Apple revoke, cascade), data export, privacy screen, security hardening | done | – |
| 12 | EAS profiles, Dockerfile, fly.toml, deployment runbook, App Review notes, privacy label | done | Apple Developer + EAS accounts |

Verification run on 15 Sep 2026: app `tsc` clean, server `tsc`/build clean, Expo web export builds, API boots and returns structured errors without a database (`/health` reports `db: down`).
