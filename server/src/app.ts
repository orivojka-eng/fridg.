import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { prisma } from './db.js';
import { emailStatus } from './lib/email.js';
import { requestScope } from './lib/requestScope.js';
import { logger } from './lib/logger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { accountRouter } from './modules/account/router.js';
import { aiRouter } from './modules/ai/router.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { collectionsRouter } from './modules/collections/router.js';
import { cookingRouter } from './modules/cooking/router.js';
import { discoverRouter } from './modules/discover/router.js';
import { foodsRouter } from './modules/foods/router.js';
import { fridgeRouter } from './modules/fridge/router.js';
import { notificationsRouter } from './modules/notifications/router.js';
import { foodProfileRouter, profileRouter } from './modules/profile/router.js';
import { recipesRouter } from './modules/recipes/router.js';
import { recipesAiRouter } from './modules/recipes/ai.js';
import { importRouter } from './modules/recipes/import.js';
import { externalRecipesRouter } from './modules/recipes/external.js';
import { scanRouter } from './modules/fridge/scan.js';
import { shoppingRouter } from './modules/shopping/router.js';
import { socialRouter } from './modules/social/router.js';
import { subscriptionsRouter } from './modules/subscriptions/router.js';
import { supportRouter } from './modules/support/router.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { usersRouter } from './modules/users/router.js';

/** Path without query string; the reset token in /api/auth/reset-password/<token> is masked. */
export const safeUrl = (url: string | undefined) => (url ?? '').split('?')[0]!.replace(/(\/reset-password\/)[^/]+/, '$1[redacted]');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Hops of reverse proxy in front of the API (Render: 1). Check with GET /health/ip after deploying.
  app.set('trust proxy', config.TRUST_PROXY_HOPS);

  app.use(helmet());
  app.use(
    cors({
      // Native apps send no Origin; browsers (Expo web/dev) must be listed.
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)),
      credentials: true,
      // The app reads the session token from this header after sign-in (Better Auth bearer plugin).
      exposedHeaders: ['set-auth-token'],
    }),
  );
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/health/live' },
      // Query strings and reset-token path segments can carry one-time secrets: never log them.
      serializers: { req: (req) => ({ id: req.id, method: req.method, url: safeUrl(req.url) }), res: (res) => ({ statusCode: res.statusCode }) },
    }),
  );

  // Better Auth (sign-up, sign-in, Apple, email codes, password reset, sign-out) reads its own body,
  // so it is mounted before the JSON parser.
  // Better Auth only reads the client IP from headers, so the proxy-aware Express value is passed in a
  // header that is overwritten on every request (clients cannot spoof it). Without this every user
  // would share one rate-limit bucket in production.
  const authHandler = toNodeHandler(auth);
  app.all('/api/auth/*', (req, res) => {
    req.headers['x-fridgr-client-ip'] = req.ip ?? '';
    return requestScope.run({}, () => authHandler(req, res));
  });

  // Webhooks need the raw body and must be mounted before the JSON parser.
  app.use('/v1/subscriptions', subscriptionsRouter);

  app.use(express.json({ limit: '1mb' }));

  /**
   * Liveness only: no database call. Use this for keep-awake pings (cron-job.org)
   * so the Render instance stays warm without keeping Neon's compute awake.
   */
  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok', service: 'fridgr-api', uptimeS: Math.round(process.uptime()) });
  });

  /** The caller's IP as the API sees it: after deploying it must show your own public IP, not a proxy's. */
  app.get('/health/ip', (req, res) => {
    res.set('cache-control', 'no-store').json({ ip: req.ip });
  });

  /** Readiness: database reachable + which email mode is active (no secrets). */
  app.get('/health', async (_req, res) => {
    let db = 'ok';
    try {
      // Bounded so load-balancer checks fail fast; 5 s leaves room for Neon waking from idle.
      await Promise.race([prisma.$queryRaw`SELECT 1`, new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout')), 5000))]);
    } catch {
      db = 'down';
    }
    const email = emailStatus().mode;
    res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', service: 'fridgr-api', env: config.APP_ENV, db, email, time: new Date().toISOString() });
  });

  const v1 = express.Router();
  v1.use(apiLimiter);
  v1.use('/users', usersRouter);
  v1.use('/profile', profileRouter);
  v1.use('/food-profile', foodProfileRouter);
  v1.use('/fridge/scan', scanRouter);
  v1.use('/fridge', fridgeRouter);
  v1.use('/foods', foodsRouter);
  v1.use('/recipes/import', importRouter);
  v1.use('/recipes/external', externalRecipesRouter);
  v1.use('/recipes', recipesAiRouter);
  v1.use('/recipes', recipesRouter);
  v1.use('/discover', discoverRouter);
  v1.use('/social', socialRouter);
  v1.use('/collections', collectionsRouter);
  v1.use('/shopping', shoppingRouter);
  v1.use('/cooking', cookingRouter);
  v1.use('/notifications', notificationsRouter);
  v1.use('/ai', aiRouter);
  v1.use('/account', accountRouter);
  v1.use('/support', supportRouter);
  app.use('/v1', v1);

  // Public pages (privacy, terms, support, password reset) are served from server/web.
  // They work at the API address, so no separate website or domain is needed.
  // Contact addresses are filled in from config (SUPPORT_INBOX).
  const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
  const page = (file: string) => (_req: express.Request, res: express.Response) => {
    const contact = config.SUPPORT_INBOX ?? 'support@fridgr.app';
    const html = readFileSync(path.join(webDir, file), 'utf8')
      .replaceAll('support@fridgr.app', contact)
      .replaceAll('privacy@fridgr.app', contact)
      .replace(/href="(privacy|terms|support)\.html"/g, 'href="/legal/$1"')
      .replace(/href="site\.css"/g, 'href="/legal/site.css"');
    res.type('html').send(html);
  };
  for (const name of ['privacy', 'terms', 'support']) app.get([`/legal/${name}`, `/legal/${name}.html`, `/${name}`], page(`${name}.html`));
  app.get('/reset-password', (_req, res, next) => {
    res.setHeader('cache-control', 'no-store');
    next();
  }, page('reset-password.html'));
  app.get('/legal/reset-password.js', (_req, res) => res.type('application/javascript').sendFile(path.join(webDir, 'reset-password.js')));
  app.get('/legal/site.css', (_req, res) => res.sendFile(path.join(webDir, 'site.css')));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
