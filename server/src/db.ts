import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

declare global {
  // eslint-disable-next-line no-var
  var __fridgrPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__fridgrPrisma ??
  new PrismaClient({
    log: config.isProd ? ['error'] : ['warn', 'error'],
  });

if (!config.isProd) globalThis.__fridgrPrisma = prisma;
