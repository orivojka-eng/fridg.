# FRIDGR — Final project inventory

Status: 6 October 2026. Written so the owner, or another developer or AI, can see what exists, what works, and what is still waiting for credentials. No secret values appear here, only variable names.

## 1. What FRIDGR is

An iPhone-first cooking app. You keep track of what is in your fridge (typed in, or scanned from a photo). FRIDGR suggests and generates recipes from it, respecting allergies and a "Food Profile". You can import recipes from links and cooking videos, cook step by step, build a shopping list, save and share recipes, and subscribe to Premium.

**Budget rule:** €0 infrastructure. The only spend is the Apple Developer Program.

## 2. Stack

| Layer | Technology |
|---|---|
| App | Expo SDK 57, React Native 0.86, TypeScript, expo-router (flat `Stack.Protected` guards), Zustand stores, expo-secure-store, expo-apple-authentication, expo-auth-session (Google), expo-glass-effect, expo-image-picker, expo-notifications, react-native-purchases |
| API | Node 22, Express 4 (ESM, TypeScript), Zod, Prisma 5.22, pino, helmet, express-rate-limit |
| Auth | Better Auth 1.7.7, mounted at `/api/auth/*`. Plugins: bearer, email OTP. Password hashing: argon2id |
| Database | Neon Postgres, free tier. The app never connects to it directly |
| AI | Google Gemini over REST (free tier), with a fallback chain of models. Anthropic is supported but not configured |
| Email | Resend API → Brevo API → SMTP → log in development only. Chosen by environment variables |
| Hosting | Render free web service (`render.yaml`). A Dockerfile and `fly.toml` are kept for other hosts |
| Builds | Expo EAS (`eas.json`: development / staging / production) |
| Payments | Apple in-app purchases through RevenueCat (entitlement `premium`) |

## 3. Repository layout

```
app/                 screens (expo-router)
src/api/             typed API client: client.ts, http.ts (timeouts and cold start), auth.ts, one file per area
src/store/           Zustand stores: user, fridge, recipe, shopping, cooking
src/lib/             socialAuth (Apple), googleAuth (Google), purchases (RevenueCat), sync, matching, session
src/components/      UI kit and shared components (design unchanged)
app.config.js        adds Google's reversed-client-id URL scheme at build time
server/src/          API: app.ts, auth.ts (Better Auth), config.ts (Zod env), index.ts (startup)
server/src/modules/  account, ai, auth(apple), collections, cooking, discover, foods, fridge, notifications,
                     profile, recipes (router, ai, import, external, access, matching), shopping, social,
                     subscriptions, support, users
server/src/ai/       Gemini/Anthropic client, schemas, personalization (allergen safety net), nutrition, jobs
server/src/lib/      email, crypto, errors, logger, push, storage, pagination, requestScope
server/prisma/       schema.prisma, migrations 0001–0004, seed.ts
server/scripts/      dev-db (embedded Postgres), import-recipes, recompute-allergens, demo-accounts
server/web/ + web/   public pages: privacy, terms, support, reset-password (+ .js), site.css
docs/                DEPLOYMENT.md, APP_STORE_REVIEW.md, this file
render.yaml          Render blueprint
```

## 4. App screens

- **Auth:** welcome, intro, signup, login, verify (6-digit code), welcome-back, profile-ready.
- **Onboarding:** builds the Food Profile.
- **Tabs:** home, discover, scanner, saved, profile.
- **Fridge:** list, manual add, photo scan (candidates are confirmed by the user; nothing uncertain is added automatically).
- **Recipes:** detail, generate (AI), results, adapt (AI), create, cooking mode.
- **Other:** shopping list, collections, notifications, social import (links and videos), premium paywall, support form.
- **Legal and account:** privacy, terms, account deletion with data export.

## 5. Backend endpoints

**Better Auth** (`/api/auth/*`):

- Sign-up and sign-in: `sign-up/email`, `sign-in/email`, `sign-in/social` (Apple and Google ID tokens), `sign-out`, `get-session`.
- Email codes: `email-otp/verify-email`, `email-otp/send-verification-otp`.
- Password: `request-password-reset`, `reset-password`, `reset-password/:token`, `change-password`.
- Sessions: `list-sessions`, `revoke-sessions`.

**FRIDGR API** (`/v1`, about 80 routes):

- **users / profile / food-profile:** the signed-in user, settings, allergies, cuisines.
- **fridge:** items CRUD; `fridge/scan` (photo → candidates).
- **foods:** catalogue and alias resolver.
- **recipes:** CRUD, save, rate, match against the fridge.
  - `recipes/generate` and `recipes/:id/adapt`: async AI jobs.
  - `recipes/import`: web pages, YouTube, uploaded videos.
  - `recipes/external`: TheMealDB library, 790 recipes imported.
- **discover:** feed, search, creators. Allergy-filtered.
- **social:** follow, like, comments.
- **collections, shopping** (including from-recipe), **cooking** sessions, **notifications** (+ push tokens), **ai/quota**.
- **account:** delete, apple-token, export (download), export/email.
- **support/tickets.**
- **subscriptions:** `me`, `sync` (verified server-side), `webhook` (RevenueCat, shared secret).

**Public pages:**

- `/health` (DB + email mode), `/health/live` (no DB), `/health/ip` (shows the client IP the API sees).
- `/legal/privacy`, `/legal/terms`, `/legal/support`, `/reset-password`.

## 6. Authentication and security (all tested against Neon)

- **Email and password sign-up.** User, UserProfile, FoodProfile and the default ShoppingList are created in one database hook. A unique handle is generated.
- **Verification codes.**
  - 6 digits, valid 10 minutes, single use, stored hashed.
  - 5 wrong attempts lock the code (`TOO_MANY_ATTEMPTS`); resending invalidates the previous code.
  - Data routes require a verified email.
- **Sessions.**
  - Bearer token kept in the iOS keychain.
  - 30 days, sliding: renewed daily while the app is in use. Sessions survive server restarts because they live in the database.
  - Expired sessions get 401.
  - The app only forgets a saved session when the server says 401; being offline or a sleeping server does not sign the user out.
- **Password reset.**
  - The email contains an https link to the hosted reset page. It is valid 30 minutes and works once.
  - The page removes the token from the address bar and is served `no-store` and CSP-safe.
  - All sessions are revoked after a reset, and a "password changed" email is sent.
- **Change password.** Optionally signs out other devices and sends a "password changed" email.
- **No account enumeration.** Identical responses for sign-in failure, password reset and resend code, whether or not the email exists.
- **Rate limits** (per real client IP; Express's proxy-aware IP is passed to Better Auth):

  | Action | Limit |
  |---|---|
  | Sign-in | 10/min |
  | Sign-up | 5/min |
  | Code resend | 3 per 5 min |
  | Verify | 10/min |
  | Reset request | 5 per 15 min |
  | Change password | 5/min |
  | General API | 120/min per user |

- **Social sign-in.**
  - Apple and Google ID tokens are verified server-side (signature, issuer, audience); forged tokens get 401.
  - Account linking only for these trusted providers.
  - Takeover guard: if an unverified password account existed for that email, the password is removed, its sessions are revoked, and a security email is sent.
- **Authorization (IDOR).** One rule for recipe visibility (`modules/recipes/access.ts`): public, seeded and library recipes for everyone; private recipes for the author only. It is applied to read, save, rate, comment, like, adapt, cook, add-to-collection, copy-to-shopping-list and fridge match.
- **Premium.** `/subscriptions/sync` never trusts the app's claim. It asks RevenueCat directly when `REVENUECAT_SECRET_API_KEY` is set; otherwise only the signed webhook can grant Premium.
- **Account deletion.**
  - Requires the password, or explicit confirmation for social-only accounts.
  - Revokes the Apple token when the Apple keys are set.
  - Deletes all sessions, then a hard delete with cascade over every personal table; an anonymised audit row is kept.
  - A confirmation email is sent.
- **Data export.** Download, or emailed as a JSON attachment. No password hashes or tokens are included.
- **Logs.**
  - Never contain request bodies, authorization headers, query strings or reset-token paths.
  - Email subjects have digits masked.
  - Codes and links are printed only when `APP_ENV=development` and no provider is configured.
- **Production refuses to start** if `BETTER_AUTH_URL` is not https or is localhost or a LAN IP, so emails can never contain development addresses.

## 7. Email

`server/src/lib/email.ts`.

- **Templates:** table-based HTML with inline styles and a plain-text version, branded, with a security footer. Functions:
  - `sendVerificationEmail`, `sendPasswordResetEmail`, `sendPasswordResetCodeEmail`, `sendPasswordChangedEmail`
  - `sendSecurityAlertEmail`, `sendAccountDeletedEmail`, `sendDataExportEmail`
  - `sendSupportReceivedEmail`, `sendSupportTicketToInbox`
- **Provider order:** Resend → Brevo → SMTP. Force one with `EMAIL_PROVIDER`.
- **No provider, outside development:**
  - Sign-up, resend code and password reset answer 503 "Email is temporarily unavailable".
  - `/health` shows `email: NOT_CONFIGURED`.
  - Startup logs an error.
- **Provider error:** resend code answers 502 "We could not send the code". Password reset stays generic (anti-enumeration) and the failure is logged.
- **Render free blocks SMTP,** so production must use the Resend or Brevo API.

## 8. Database

- **38 Prisma models.** Main groups: auth (User, Session, Account, Verification), profile and food, fridge, recipes and social, shopping, cooking, notifications, AI usage, subscriptions, audit, support.
- **Migrations applied on Neon:** `0001_init`, `0002_support_tickets`, `0003_external_recipes`, `0004_better_auth`. This release added no migration and made no schema change.
- **Contents:** 797 recipes (790 from the TheMealDB library), 204 foods, demo accounts (`demo@`, `new@`, `review@fridgr.app`).
- **Scripts:** `db:migrate`, `db:seed`, `db:dev`, `db:import-recipes`, `db:recompute-allergens`, `db:demo` (`-- --remove` deletes the demo accounts).

## 9. Environment variables (names only)

**Server, required in production:**
- `APP_ENV`, `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- One of `BREVO_API_KEY` / `RESEND_API_KEY`
- `EMAIL_FROM`, `GEMINI_API_KEY`

**Server, recommended:**
- `SUPPORT_INBOX`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`
- `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
- `GOOGLE_CLIENT_ID_IOS`, `EXPO_ACCESS_TOKEN`

**Server, optional:**
- `PORT` (Render sets it), `LOG_LEVEL`, `SESSION_DAYS`, `TRUST_PROXY_HOPS`, `CORS_ORIGINS`, `EMAIL_PROVIDER`, `RUN_JOBS`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `GEMINI_MODEL`, `GEMINI_MODEL_CHEAP`, `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `AI_MODEL_PRIMARY`, `AI_MODEL_CHEAP`
- `MEALDB_API_KEY`, `SPOONACULAR_API_KEY`, `USDA_API_KEY`, `YOUTUBE_API_KEY`
- `S3_*`, `META_APP_ID`, `META_APP_SECRET`, `SENTRY_DSN`, `DEMO_MODE`
- `GOOGLE_CLIENT_ID_WEB`, `GOOGLE_CLIENT_ID_ANDROID`, `APPLE_BUNDLE_ID`

**App (public only, compiled into the binary):**
- `EXPO_PUBLIC_USE_BACKEND`, `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_LEGAL_OWNER`

## 10. External services

| Service | Purpose | Status |
|---|---|---|
| Neon | Database | Live (migrations applied; the password must be rotated because it was shared in chat) |
| Gemini | All AI features | Live locally (the key must be rotated because it was shared in chat) |
| Render | API hosting | Blueprint ready; account and deployment not yet created |
| Brevo or Resend | Email | Code tested end to end with a test mailbox and real-provider error paths; real key not yet provided |
| Google Cloud OAuth | Google sign-in on iOS | Code complete; client id not yet created |
| Apple Developer | Sign in with Apple, App Store, push | Code complete; keys not yet created |
| RevenueCat | Subscriptions | Code complete (verified sync and webhook); project not yet created |
| Expo / EAS | Builds and push | `eas.json` ready; project not yet linked |
| cron-job.org | Keep Render warm (optional) | Ping `/health/live` |
| TheMealDB | Recipe library | Test key 1: licensed for development only |

## 11. Tests run on 6 October 2026

The API was built and run in **production mode** against Neon, with a real SMTP test mailbox read over IMAP. All 90 checks passed:

- A: registration → database rows → email → code → verified.
- B: sign-out, sign-in, session after a server restart, expiry, sliding renewal.
- C: password reset by emailed link, token reuse blocked, sessions revoked, old and new password, "password changed" emails; change-password.
- D: wrong, expired, reused and superseded codes; attempt lock; resend cooldown; no enumeration.
- Authorization: a second user cannot read, copy, comment on, cook, collect, save or edit a private recipe; Premium cannot be self-granted; forged Apple and Google tokens are rejected.
- Data export email with attachment.
- E: deletion of a test account with a cascade count of 0 and an anonymised audit row.
- Log hygiene: no codes, tokens or bodies in the production log.

Also checked:

- No provider in production → 503. A provider with a bad key → 502 on resend (Brevo and Resend APIs both reached).
- Sign-in brute force blocked at attempt 11.
- The production config rejects http and LAN URLs.
- Development mode prints codes.
- App and server TypeScript compile cleanly; the Expo web export succeeds; the app bundle contains no server keys.

**Not verified:** delivery from Resend or Brevo to real inboxes such as Gmail or iCloud. This needs a real key and a manual mailbox test.

## 12. Known gaps

- Android: no Google sign-in client (needs a Play account and an Android OAuth client) and no store listing.
- TheMealDB needs a supporter licence, or the library must be hidden, before a public release.
- The Render free cold start (30–60 s) is handled in the app, but the first request after idle is slow. The optional cron ping avoids it.
- Brevo with a gmail.com sender may land in spam; a custom domain fixes this later.
- `eas.json` submit section: `ascAppId` and `appleTeamId` must be filled once the App Store Connect app exists.
