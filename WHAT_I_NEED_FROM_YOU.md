# FRIDGR — What I need from you (zero-budget plan)

The only money spent is the **Apple Developer Program (€99/year)**. Everything else below is free.
Put secrets straight into `server/.env` (copy of `server/.env.example`) or tell me where they are; avoid pasting passwords in chat.

## Free accounts to create (in this order)

| # | What | Why | Where / how | Give me |
|---|---|---|---|---|
| 1 | **A dedicated Gmail** for the app, e.g. `fridgr.help@gmail.com` | Public support address and the "From" address of app emails. No domain needed. | gmail.com → create account | The address (`SUPPORT_INBOX`, part of `EMAIL_FROM`) |
| 1b | **Brevo account** (free, 300 emails/day) | Actually sends sign-up codes, password-reset links and notices. Render's free plan blocks Gmail SMTP, so emails go through Brevo's API. | brevo.com → sign up → Senders → add the Gmail from step 1 and confirm it → SMTP & API → API Keys → Generate | Paste `BREVO_API_KEY` into Render yourself (Environment tab); tell me when done |
| 2 | **Gemini API key** | All AI: recipe ideas, adapting recipes, fridge scan, reading links, watching YouTube and saved TikTok/Instagram videos | aistudio.google.com → Get API key (Google login, no card) | `GEMINI_API_KEY` |
| 3 | **New Neon password** | The old one was shared in chat | console.neon.tech → your project → Roles → reset password | The two new connection strings |
| 4 | **GitHub account** | Render deploys the server from a repository | github.com | Your username (I create the repository and push) |
| 5 | **Render account** (sign in with GitHub) | Free hosting for the API and the privacy/terms/support pages | render.com → New → Blueprint → pick the repo (`render.yaml` is ready) | Tell me when it is connected |
| 6 | **cron-job.org account** | Pings the server every 10 minutes so the free Render server is awake when Apple reviews the app | cron-job.org → new job → `https://<your-render-url>/health/live` every 10 min (this URL does not wake the database) | Nothing |
| 6b | **Google Cloud OAuth client** (free) — only if you want "Continue with Google" | Google sign-in on iPhone | console.cloud.google.com → new project → OAuth consent screen (External, publish) → Credentials → OAuth client ID → type **iOS**, bundle `com.fridgr.app` | The client id (public): `GOOGLE_CLIENT_ID_IOS` on Render and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in EAS |
| 7 | **Expo account** | Builds the iPhone app and delivers push notifications (free tier) | expo.dev → sign up → Account settings → Access tokens | `EXPO_ACCESS_TOKEN` and your Expo username |
| 8 | **RevenueCat account** | Subscriptions and "Restore purchases" (free until you earn money) | app.revenuecat.com | Set up together after step 12 |

## With the Apple Developer account (€99)

| # | What | Give me |
|---|---|---|
| 9 | Your **Team ID** (developer.apple.com → Membership) | `APPLE_TEAM_ID` |
| 10 | **App ID** `com.fridgr.app` with *Sign in with Apple* and *Push Notifications* ticked (or tell me a different bundle id) | Confirmation |
| 11 | A **Sign in with Apple key** (Keys → + → Sign in with Apple → download the `.p8`) | `APPLE_KEY_ID` + the `.p8` file contents (`APPLE_PRIVATE_KEY`) |
| 12 | An **App Store Connect** app record named FRIDGR, plus the two subscriptions `fridgr_premium_monthly` (€6.99) and `fridgr_premium_yearly` (€42), each with a 7-day free trial | Confirmation; I connect them to RevenueCat |
| 13 | **Paid Applications Agreement** + bank + tax forms in App Store Connect (free, required to sell subscriptions) | Confirmation it shows "Active" |

## Details only you can give

| # | What | Used for |
|---|---|---|
| 14 | Your **legal name** (or company) and **country** | Privacy policy and Terms of Use (Apple reads them) |
| 15 | **Release order:** iPhone only for now? (Google Play costs €25, so I suggest skipping Android until there is money) | Build setup |

## Free on purpose — what this means

- **No domain:** the privacy, terms, support and password-reset pages live on the free Render address (`https://<name>.onrender.com/legal/privacy`). Apple accepts these URLs.
- **Emails come from the Gmail address via Brevo** instead of `@fridgr.app`. Some may land in spam; a domain later (with Resend or Brevo) fixes that. Without any email key the server refuses sign-ups with a clear message instead of pretending to send codes.
- **Render free sleeps after 15 minutes idle;** the cron-job.org ping keeps it awake (750 free hours/month covers one server).
- **Gemini free tier** has per-minute limits; plenty for testing and early users. The app already caps free users per day.
- **Neon free:** 0.5 GB storage, enough for thousands of users.
- **Recipe library (TheMealDB):** the free key is for development only. Before the App Store release, choose one: hide the library (the app still has AI recipes, imports and community recipes), or pay TheMealDB's small one-off supporter fee later when you can.

## Already done and waiting for these

Better Auth sign-up/sign-in with email codes, password reset (with "password changed" emails), Sign in with Apple, Google sign-in for iPhone, data export by email, account deletion with Apple revocation, support form with confirmation emails, the recipe library, AI generation grounded on real recipes, link and video import, scanning, subscriptions, push reminders, privacy/terms/support pages, Render blueprint, iPhone build profiles.

## The order we will go in

1. You send items **1, 2, 3** → I switch emails and AI on and test with your phone.
2. Items **4–7** → I put the server online and make the first iPhone build.
3. Apple items **9–13** and **14** → Sign in with Apple, subscriptions, TestFlight, then App Store submission.
