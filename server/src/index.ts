import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { emailStatus } from './lib/email.js';
import { logger } from './lib/logger.js';
import { scheduleExpiryReminders } from './jobs/expiryReminders.js';

/** Neon free tier suspends idle compute; the first connection can take a few seconds. */
async function connectDatabase() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info({ attempt }, 'database connected');
      return;
    } catch (e) {
      logger.warn({ attempt, err: (e as Error).message }, 'database not reachable yet');
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  // Keep serving: /health reports db=down and requests retry their own connection.
  logger.error('database unreachable after 5 attempts; continuing, /health will report it');
}

/** One line per external service so a deploy log shows what is live (names only, never values). */
function reportServices() {
  const email = emailStatus();
  const services = {
    email: email.mode === 'live' ? `${email.provider} (from ${email.from})` : email.mode,
    ai: config.GEMINI_API_KEY || config.ANTHROPIC_API_KEY ? (config.AI_PROVIDER ?? (config.ANTHROPIC_API_KEY ? 'anthropic' : 'gemini')) : 'NOT_CONFIGURED',
    appleSignIn: `bundle ${config.APPLE_BUNDLE_ID}; token revocation ${config.APPLE_TEAM_ID && config.APPLE_KEY_ID && config.APPLE_PRIVATE_KEY ? 'on' : 'off (APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY missing)'}`,
    googleSignIn: [config.GOOGLE_CLIENT_ID_IOS, config.GOOGLE_CLIENT_ID_WEB, config.GOOGLE_CLIENT_ID_ANDROID].some(Boolean) ? 'on' : 'off (GOOGLE_CLIENT_ID_* missing)',
    pushNotifications: config.EXPO_ACCESS_TOKEN ? 'on (access token)' : 'on (no access token, Expo default limits)',
    revenueCat: config.REVENUECAT_SECRET_API_KEY ? 'verified sync' : 'webhook only (REVENUECAT_SECRET_API_KEY missing)',
    publicUrl: config.BETTER_AUTH_URL ?? 'not set (links use localhost)',
  };
  logger.info(services, 'service status');
  if (email.provider === 'smtp' && process.env.RENDER) logger.warn('SMTP selected on Render: free web services block outbound SMTP ports. Use RESEND_API_KEY or BREVO_API_KEY instead.');
  if (email.mode === 'NOT_CONFIGURED') logger.error('NO EMAIL PROVIDER: verification codes and password resets cannot be delivered. Set RESEND_API_KEY, BREVO_API_KEY or SMTP_USER/SMTP_PASS.');
}

async function main() {
  await connectDatabase();
  reportServices();
  const app = createApp();
  // Daily jobs: on outside development, opt-in locally with RUN_JOBS=true, opt-out with RUN_JOBS=false.
  const runJobs = process.env.RUN_JOBS ? process.env.RUN_JOBS === 'true' : config.APP_ENV !== 'development';
  if (runJobs) scheduleExpiryReminders();

  // 0.0.0.0: reachable from the hosting platform's router (Render) and from phones on the LAN in development.
  const server = app.listen(config.PORT, '0.0.0.0', () => {
    logger.info({ port: config.PORT, env: config.APP_ENV }, 'FRIDGR API listening');
  });
  // Longer than the platform load balancer's idle timeout so kept-alive sockets are not cut mid-request.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await prisma.$disconnect().catch(() => undefined);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (e) => logger.error({ err: e instanceof Error ? e.message : String(e) }, 'unhandled rejection'));

main().catch((e) => {
  logger.fatal({ err: (e as Error).message }, 'startup failed');
  process.exit(1);
});
