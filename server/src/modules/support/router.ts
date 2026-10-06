import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { sendSupportReceivedEmail, sendSupportTicketToInbox } from '../../lib/email.js';
import { logger } from '../../lib/logger.js';
import { authUser, optionalAuth } from '../../middleware/auth.js';
import { sendCodeLimiter } from '../../middleware/rateLimit.js';
import { body, wrap } from '../../middleware/validate.js';

export const supportRouter = Router();

/**
 * In-app contact form (App Store: a visible way to reach you). Works signed
 * out too, so a user locked out of their account can still write in.
 * Stores the ticket and forwards it to the support inbox.
 */
supportRouter.post(
  '/tickets',
  optionalAuth,
  sendCodeLimiter,
  body(
    z.object({
      topic: z.enum(['bug', 'question', 'feedback', 'account', 'billing']),
      message: z.string().trim().min(10).max(4000),
      email: z.string().trim().email().max(254).optional(),
      appVersion: z.string().max(40).optional(),
      platform: z.string().max(20).optional(),
      osVersion: z.string().max(40).optional(),
    }),
  ),
  wrap(async (req, res) => {
    const user = req.auth ? authUser(req) : null;
    const email = req.body.email ?? user?.email;
    const ticket = await prisma.supportTicket.create({
      data: { userId: user?.id, email, topic: req.body.topic, message: req.body.message, appVersion: req.body.appVersion, platform: req.body.platform, osVersion: req.body.osVersion },
    });
    const to = config.SUPPORT_INBOX;
    if (to) {
      sendSupportTicketToInbox({
        inbox: to,
        replyTo: email,
        subject: `[FRIDGR ${req.body.topic}] ticket ${ticket.id.slice(0, 8).toUpperCase()}`,
        text: `${req.body.message}\n\n—\nfrom: ${email ?? 'anonymous'}${user ? ` (user ${user.id})` : ''}\napp: ${req.body.appVersion ?? '?'} · ${req.body.platform ?? '?'} ${req.body.osVersion ?? ''}\nticket: ${ticket.id}`,
      }).catch((e) => logger.warn({ err: e }, 'support forward failed'));
    }
    // Confirmation to the user; replies go straight to the support inbox.
    if (email) {
      const ref = ticket.id.slice(0, 8).toUpperCase();
      const topicLabel = { bug: 'a bug', question: 'a question', feedback: 'feedback', account: 'your account', billing: 'billing' }[req.body.topic as string] ?? req.body.topic;
      sendSupportReceivedEmail({ to: email, ref, topic: topicLabel }).catch((e) => logger.warn({ err: e }, 'support ack failed'));
    }
    res.status(201).json({ ok: true, ticketId: ticket.id });
  }),
);
