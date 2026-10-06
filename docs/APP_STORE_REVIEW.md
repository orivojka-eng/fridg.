# FRIDGR — App Store readiness

## App Review notes (paste into App Store Connect → App Review Information)
> FRIDGR helps people cook with what is already in their fridge.
>
> **Demo account:** review@fridgr.app / *(password set at seed time, see `SEED_DEMO_PASSWORD`)*. It is pre-filled with a fridge, a shopping list and saved recipes. Or create a new account: the confirmation code is emailed immediately.
>
> **AI features:** "Generate" builds recipes from the fridge contents through our own backend (api.fridgr.app) which calls Anthropic's API server-side. No third-party keys are in the app. Free accounts get 5 generations a day; Premium is unlimited.
>
> **Scanning:** Home → Scan photographs the fridge; recognised items are shown with a confidence score and nothing is added until the user taps *Add*. Photos are deleted within 24 hours. The simulator has no camera; use *Add manually* there.
>
> **Import from a video:** paste a public link (sample: https://www.youtube.com/watch?v=dQw4w9WgXcQ works for metadata; any public recipe blog with schema.org data extracts fully) or paste the caption text. We only read public metadata (oEmbed / Open Graph / schema.org); nothing behind a login is accessed and no media is downloaded.
>
> **Sign in with Apple** is offered alongside email and Google (Guideline 4.8). **Account deletion** is in Profile → Delete account and completes server-side, including revoking the Sign in with Apple token (5.1.1(v)). **Privacy policy** is in Profile → Privacy & data and at https://fridgr.app/privacy.
>
> **Subscriptions:** FRIDGR Premium, monthly €6.99 or yearly €42.00 with a 7-day free trial, sold only through In-App Purchase (RevenueCat). Restore purchases is on the paywall. Sandbox tester: use any sandbox Apple ID.

## App Store Connect metadata
- **Name:** FRIDGR — Cook with what you have. **Subtitle:** Fridge scan, AI recipes, zero waste.
- **Category:** Food & Drink. **Secondary:** Lifestyle.
- **Age rating:** answer "None" for medical/treatment info, "Infrequent/Mild" for none. Expected rating 4+.
- **Privacy policy URL:** https://fridgr.app/privacy. **Support URL:** https://fridgr.app/support. **Marketing URL:** https://fridgr.app.
- **Export compliance:** uses only standard HTTPS → `ITSAppUsesNonExemptEncryption = false` (already in app.json).
- **Screenshots:** 6.7" and 6.1" iPhone (Home, Scan, Generate results, Recipe, Cooking mode, Discover, Paywall).

## Privacy Nutrition Label (App Privacy section)
| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact Info → Email Address, Name | Yes | Yes | No | App Functionality, Account |
| User Content → Photos or Videos | Yes (transient, ≤24 h) | No | No | App Functionality |
| User Content → Other User Content (recipes, comments) | Yes | Yes | No | App Functionality |
| Health & Fitness | **No** (no HealthKit; dietary preferences are declared below) | – | – | – |
| Other Data → Other Data Types (dietary preferences, allergies) | Yes | Yes | No | App Functionality (personalisation only) |
| Purchases → Purchase History | Yes | Yes | No | App Functionality |
| Identifiers → User ID | Yes | Yes | No | App Functionality |
| Usage Data → Product Interaction | Yes (in-app signals) | Yes | No | App Functionality, Analytics (aggregated) |
| Diagnostics → Crash Data | Yes (if Sentry enabled) | No | No | App Functionality |

No data is used for third-party advertising; the App Tracking Transparency prompt is not required.

## Guideline checklist
- [x] 5.1.1(v) In-app account deletion, server-side, Apple token revoked (`POST /v1/account/delete`).
- [x] 4.8 Sign in with Apple offered where Google is offered.
- [x] 5.1.1(i) Privacy policy in-app (`/legal/privacy`) and URL in metadata.
- [x] 3.1.1 / 3.1.2 Digital subscription via IAP only; price, period, trial, auto-renewal and cancel-anytime shown on the paywall; Restore button; Manage subscription link.
- [x] 5.1.1 Permission strings for camera and photo library explain the use (app.json `infoPlist`).
- [x] 1.4.1 No medical claims; nutrition shown as "estimated".
- [x] 1.5 Support: in-app contact form (Profile → Support, `POST /v1/support/tickets`, works signed out) + support URL + FAQ.
- [x] 3.1.2 Terms of Use / EULA in-app (Profile → Terms of Use) and linked from the paywall together with the Privacy Policy and Restore purchases; Apple standard EULA linked.
- [x] 5.1.1 Permission primers: an in-app explanation screen precedes the system prompt for camera (Scan), photo library (Create recipe) and notifications (Home, after the tour).
- [x] Hosted legal pages: `web/privacy.html`, `web/terms.html`, `web/support.html` (deploy to fridgr.app; also served by the API at `/legal/*`).
- [x] 2.1 App works with the production backend at review time; demo account provided.
- [x] 5.2.3 Social import respects platform terms: public metadata only, attribution kept, imported recipes private to the importer.
- [ ] Upload screenshots, set pricing, create the two subscription products with the 7-day introductory offer, attach them to the version.
- [ ] Add the App Review demo password to App Store Connect (never to the repo).

## Data & privacy architecture (summary)
Full classification and retention in `FRIDGR_BACKEND_ARCHITECTURE.md` §9. Sensitive dietary data never leaves the API except to the AI provider as recipe constraints (no identity attached), is excluded from logs, analytics and error reports, and is deleted with the account.
