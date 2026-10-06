/**
 * Local development database without Docker or a Postgres install.
 * Starts an embedded PostgreSQL on port 5499 (data in server/.data/pg) and
 * keeps running until Ctrl+C. Use with:
 *   DATABASE_URL=postgresql://fridgr:fridgr@localhost:5499/fridgr
 *   DIRECT_URL=postgresql://fridgr:fridgr@localhost:5499/fridgr
 */
import EmbeddedPostgres from 'embedded-postgres';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.data/pg');
const fresh = !fs.existsSync(path.join(dir, 'PG_VERSION'));
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'fridgr', password: 'fridgr', port: Number(process.env.DEV_DB_PORT ?? 5499), persistent: true });

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('fridgr').catch(() => undefined);
console.log(`[dev-db] postgres ready on port ${process.env.DEV_DB_PORT ?? 5499} (fresh=${fresh})`);

const stop = async () => {
  await pg.stop().catch(() => undefined);
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => undefined, 1 << 30);
