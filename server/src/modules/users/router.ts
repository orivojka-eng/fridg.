import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { authUser, requireAuth } from '../../middleware/auth.js';
import { body, params, wrap } from '../../middleware/validate.js';
import { loadUser, serializePublicUser, serializeUser } from './serialize.js';

export const usersRouter = Router();

usersRouter.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ user: serializeUser(await loadUser(authUser(req).id)) });
  }),
);

usersRouter.patch(
  '/me',
  requireAuth,
  body(
    z.object({
      firstName: z.string().trim().min(1).max(60).optional(),
      lastName: z.string().trim().min(1).max(60).optional(),
      handle: z
        .string()
        .trim()
        .regex(/^@?[a-z0-9_]{3,24}$/i, 'Handles are 3–24 letters, numbers or underscores.')
        .transform((h) => h.replace(/^@/, '').toLowerCase())
        .optional(),
    }),
  ),
  wrap(async (req, res) => {
    const { id } = authUser(req);
    if (req.body.handle) {
      const taken = await prisma.user.findFirst({ where: { handle: req.body.handle, NOT: { id } }, select: { id: true } });
      if (taken) throw AppError.conflict('That handle is taken.');
    }
    await prisma.user.update({ where: { id }, data: req.body });
    res.json({ user: serializeUser(await loadUser(id)) });
  }),
);

usersRouter.get(
  '/:id/public',
  params(z.object({ id: z.string().uuid() })),
  wrap(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, firstName: true, lastName: true, handle: true, profile: { select: { bio: true, avatarIndex: true } }, _count: { select: { recipes: { where: { visibility: 'public' } }, followers: true } } },
    });
    if (!u) throw AppError.notFound('User');
    res.json({ user: serializePublicUser(u) });
  }),
);
