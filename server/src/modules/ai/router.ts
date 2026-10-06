import { Router } from 'express';
import { authUser, requireVerified } from '../../middleware/auth.js';
import { wrap } from '../../middleware/validate.js';
import { getQuota } from './quota.js';

export const aiRouter = Router();
aiRouter.use(requireVerified);

aiRouter.get(
  '/quota',
  wrap(async (req, res) => {
    const u = authUser(req);
    res.json({ quota: await getQuota(u.id, u.isPremium) });
  }),
);
