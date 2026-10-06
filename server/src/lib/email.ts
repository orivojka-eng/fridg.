import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { config } from '../config.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

/**
 * Transactional email for FRIDGR.
 *
 * Providers, in priority order (or forced with EMAIL_PROVIDER):
 *   1. Resend — RESEND_API_KEY (free 3,000/month; needs a verified domain to
 *               email anyone other than the Resend account owner)
 *   2. Brevo  — BREVO_API_KEY (free 300/day; a verified single sender address
 *               is enough, no domain needed)
 *   3. SMTP   — SMTP_USER + SMTP_PASS (Brevo SMTP relay, Gmail app password, ...)
 *   4. log    — APP_ENV=development only: the message is written to the server log.
 *
 * Outside development "log" is never used: sending throws, so nothing pretends
 * an email went out.
 */
export type EmailProvider = 'resend' | 'brevo' | 'smtp' | 'log';

const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;
const smtp =
  config.SMTP_USER && config.SMTP_PASS
    ? nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
      })
    : null;

const available = { resend: !!resend, brevo: !!config.BREVO_API_KEY, smtp: !!smtp };

function pickProvider(): EmailProvider {
  const forced = config.EMAIL_PROVIDER;
  if (forced) {
    if (available[forced]) return forced;
    logger.error({ forced }, `EMAIL_PROVIDER=${forced} but its credentials are missing; trying the others`);
  }
  if (available.resend) return 'resend';
  if (available.brevo) return 'brevo';
  if (available.smtp) return 'smtp';
  return 'log';
}

const provider = pickProvider();
const devLogAllowed = config.APP_ENV === 'development';

export const emailProvider = () => provider;
export const emailConfigured = () => provider !== 'log';
/** False when nothing can be delivered (no provider outside development). */
export const emailUsable = () => provider !== 'log' || devLogAllowed;
/** True only when codes may be shown in the server log (local development without a provider). */
export const emailDevLog = () => provider === 'log' && devLogAllowed;

/** "Name <address>" → { name, email }. */
function parseFrom(from: string) {
  const m = from.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  return m ? { name: m[1] || 'FRIDGR', email: m[2]! } : { name: 'FRIDGR', email: from.trim() };
}

/** Gmail SMTP only sends as the signed-in address; every other provider uses EMAIL_FROM. */
function senderAddress() {
  const from = parseFrom(config.EMAIL_FROM);
  if (provider === 'smtp' && config.SMTP_USER && /gmail\.com$/i.test(config.SMTP_HOST)) return `${from.name} <${config.SMTP_USER}>`;
  return `${from.name} <${from.email}>`;
}

/** Health/status summary (no secrets). */
export function emailStatus() {
  return {
    provider,
    mode: provider !== 'log' ? 'live' : devLogAllowed ? 'development-log' : 'NOT_CONFIGURED',
    from: parseFrom(senderAddress()).email,
  };
}

export interface Attachment {
  filename: string;
  /** UTF-8 text content. */
  content: string;
  contentType?: string;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: Attachment[];
}

/** Subjects carry one-time codes ("123456 is your FRIDGR code"): mask digits before logging. */
const logSubject = (subject: string) => subject.replace(/\d{4,}/g, '******');

/** Sends one email or throws an AppError. Callers decide whether a failure reaches the user. */
export async function sendMail(mail: Mail): Promise<{ provider: EmailProvider; id?: string }> {
  if (provider === 'log') {
    if (!devLogAllowed) {
      logger.error({ subject: logSubject(mail.subject) }, 'EMAIL NOT SENT: no email provider configured (set RESEND_API_KEY, BREVO_API_KEY or SMTP_USER/SMTP_PASS)');
      throw new AppError(503, 'UPSTREAM', 'Email is not available right now. Please try again later.');
    }
    // Development only: print the message so codes and links can be used locally.
    logger.info({ to: mail.to, subject: mail.subject, text: mail.text }, 'DEV EMAIL (not sent, development log mode)');
    return { provider };
  }
  const from = senderAddress();
  try {
    if (provider === 'resend') {
      const { data, error } = await resend!.emails.send({
        from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
        ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
        ...(mail.attachments?.length ? { attachments: mail.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, 'utf8') })) } : {}),
      });
      if (error) throw new Error(`${error.name}: ${error.message}`);
      logger.info({ subject: logSubject(mail.subject), provider, id: data?.id }, 'email sent');
      return { provider, id: data?.id };
    }
    if (provider === 'brevo') {
      const sender = parseFrom(from);
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': config.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: sender.name, email: sender.email },
          to: [{ email: mail.to }],
          subject: mail.subject,
          textContent: mail.text,
          ...(mail.html ? { htmlContent: mail.html } : {}),
          ...(mail.replyTo ? { replyTo: { email: mail.replyTo } } : {}),
          ...(mail.attachments?.length ? { attachment: mail.attachments.map((a) => ({ name: a.filename, content: Buffer.from(a.content, 'utf8').toString('base64') })) } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const out = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string };
      if (!res.ok) throw new Error(`brevo ${res.status} ${out.code ?? ''} ${out.message ?? ''}`.trim());
      logger.info({ subject: logSubject(mail.subject), provider, id: out.messageId }, 'email sent');
      return { provider, id: out.messageId };
    }
    const info = await smtp!.sendMail({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
      ...(mail.attachments?.length ? { attachments: mail.attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) } : {}),
    });
    logger.info({ subject: logSubject(mail.subject), provider, id: info.messageId }, 'email sent');
    return { provider, id: info.messageId };
  } catch (e) {
    logger.error({ subject: logSubject(mail.subject), provider, err: (e as Error).message }, 'email send failed');
    throw new AppError(502, 'UPSTREAM', 'We could not send the email. Try again in a minute.');
  }
}

/* ------------------------------------------------------------------ templates */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const supportAddress = () => config.SUPPORT_INBOX ?? parseFrom(config.EMAIL_FROM).email;
const FONT = '-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif';

/**
 * Table-based layout with inline styles only: renders the same in Gmail,
 * Outlook, Apple Mail and Yahoo. No images or external CSS (nothing to block).
 */
function layout(o: { preheader: string; title: string; body: string; security?: string }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#F4F6EC;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6EC;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#FFFFFF;border-radius:20px;">
<tr><td style="padding:24px 28px 4px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#14180F;border-radius:10px;padding:6px 11px;font-family:${FONT};font-weight:800;font-size:15px;letter-spacing:2px;color:#C6F24A;">FRIDGR</td></tr></table>
</td></tr>
<tr><td style="padding:16px 28px 4px 28px;font-family:${FONT};color:#14180F;">
<h1 style="margin:0 0 14px 0;font-size:22px;line-height:28px;font-weight:800;color:#14180F;">${esc(o.title)}</h1>
${o.body}
</td></tr>
<tr><td style="padding:6px 28px 26px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6EC;border-radius:12px;"><tr><td style="padding:12px 14px;font-family:${FONT};font-size:12px;line-height:18px;color:#4B5563;">
${o.security ? `${esc(o.security)}<br>` : ''}FRIDGR will never ask for your password by email. Questions? <a href="mailto:${esc(supportAddress())}" style="color:#14180F;">${esc(supportAddress())}</a>
</td></tr></table>
</td></tr>
</table>
<p style="font-family:${FONT};font-size:11px;color:#6B7280;margin:14px 0 0 0;">FRIDGR · Cook with what you have</p>
</td></tr>
</table>
</body></html>`;
}

const para = (html: string) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#14180F;">${html}</p>`;
const codeBox = (code: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 14px 0;"><tr><td align="center" style="background:#F2F7E4;border-radius:14px;padding:16px;font-family:Menlo,Consolas,monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#14180F;">${esc(code)}</td></tr></table>`;
const button = (url: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 14px 0;"><tr><td style="background:#14180F;border-radius:12px;"><a href="${esc(url)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:700;color:#C6F24A;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
const greeting = (name?: string | null) => (name?.trim() ? `Hi ${name.trim().split(/\s+/)[0]},` : 'Hi,');
const stamp = () => new Date().toUTCString().replace('GMT', 'UTC');

/** 6-digit code that confirms the email address. */
export function sendVerificationEmail(o: { to: string; name?: string | null; code: string; minutes: number }) {
  return sendMail({
    to: o.to,
    subject: `${o.code} is your FRIDGR verification code`,
    text: `${greeting(o.name)}\n\nYour FRIDGR verification code for ${o.to} is: ${o.code}\n\nIt expires in ${o.minutes} minutes and works once.\nIf you did not create a FRIDGR account, ignore this email.\n\nFRIDGR will never ask for your password by email.`,
    html: layout({
      preheader: `Your code expires in ${o.minutes} minutes.`,
      title: 'Verify your FRIDGR account',
      body: para(esc(greeting(o.name))) + para(`Enter this code in the app to confirm <strong>${esc(o.to)}</strong>:`) + codeBox(o.code) + para(`It expires in ${o.minutes} minutes and works once.`),
      security: 'If you did not create a FRIDGR account, you can ignore this email.',
    }),
  });
}

/** Password reset by link (opens the reset page served by this API). */
export function sendPasswordResetEmail(o: { to: string; name?: string | null; url: string; minutes: number }) {
  return sendMail({
    to: o.to,
    subject: 'Reset your FRIDGR password',
    text: `${greeting(o.name)}\n\nWe received a request to reset the password for ${o.to}.\nChoose a new password here: ${o.url}\n\nThe link expires in ${o.minutes} minutes and works once.\nIf you did not ask for this, ignore this email; your password stays the same.`,
    html: layout({
      preheader: `This link expires in ${o.minutes} minutes.`,
      title: 'Reset your password',
      body: para(esc(greeting(o.name))) + para(`We received a request to reset the password for <strong>${esc(o.to)}</strong>.`) + button(o.url, 'Choose a new password') + para(`The link expires in ${o.minutes} minutes and works once.`),
      security: 'If you did not ask for this, ignore this email; your password stays the same.',
    }),
  });
}

/** Password reset by 6-digit code (email-OTP flow). */
export function sendPasswordResetCodeEmail(o: { to: string; code: string; minutes: number }) {
  return sendMail({
    to: o.to,
    subject: `${o.code} is your FRIDGR password reset code`,
    text: `Your FRIDGR password reset code is: ${o.code}\nIt expires in ${o.minutes} minutes and works once.\nIf you did not ask for this, ignore this email.`,
    html: layout({
      preheader: `Your code expires in ${o.minutes} minutes.`,
      title: 'Reset your password',
      body: para('Enter this code in the app to choose a new password:') + codeBox(o.code) + para(`It expires in ${o.minutes} minutes and works once.`),
      security: 'If you did not ask for this, ignore this email; your password stays the same.',
    }),
  });
}

/** Confirmation after a password reset or change. */
export function sendPasswordChangedEmail(o: { to: string; name?: string | null; how: 'reset' | 'change' }) {
  const verb = o.how === 'reset' ? 'reset' : 'changed';
  const after = o.how === 'reset' ? 'You were signed out on every device.' : 'If you chose to, your other devices were signed out.';
  return sendMail({
    to: o.to,
    subject: 'Your FRIDGR password was changed',
    text: `${greeting(o.name)}\n\nThe password for ${o.to} was ${verb} on ${stamp()}. ${after}\n\nIf this was not you, reset your password now in the app (Log in > Forgot password) and contact ${supportAddress()}.`,
    html: layout({
      preheader: `Your password was ${verb}.`,
      title: 'Your password was changed',
      body: para(esc(greeting(o.name))) + para(`The password for <strong>${esc(o.to)}</strong> was ${verb} on ${esc(stamp())}.`) + para(after),
      security: 'If this was not you, reset your password now in the app (Log in > Forgot password) and contact support.',
    }),
  });
}

/** Account-security notices, e.g. an unverified password removed when Apple/Google sign-in claimed the email. */
export function sendSecurityAlertEmail(o: { to: string; name?: string | null; title: string; message: string }) {
  return sendMail({
    to: o.to,
    subject: `FRIDGR security notice: ${o.title}`,
    text: `${greeting(o.name)}\n\n${o.message}\n\nTime: ${stamp()}\nIf this was not you, contact ${supportAddress()}.`,
    html: layout({ preheader: o.title, title: o.title, body: para(esc(greeting(o.name))) + para(esc(o.message)) + para(`Time: ${esc(stamp())}`), security: 'If this was not you, contact support right away.' }),
  });
}

export function sendAccountDeletedEmail(o: { to: string }) {
  return sendMail({
    to: o.to,
    subject: 'Your FRIDGR account has been deleted',
    text: `Your FRIDGR account (${o.to}) and all its data were permanently deleted on ${stamp()}.\nAn App Store subscription keeps running until you cancel it in iPhone Settings > Apple ID > Subscriptions.\n\nThanks for cooking with us.`,
    html: layout({
      preheader: 'Your account and its data were deleted.',
      title: 'Account deleted',
      body: para(`Your FRIDGR account <strong>${esc(o.to)}</strong> and all its data were permanently deleted on ${esc(stamp())}.`) + para('An App Store subscription keeps running until you cancel it in iPhone Settings &gt; Apple ID &gt; Subscriptions.') + para('Thanks for cooking with us.'),
      security: 'If you did not delete your account, contact support right away.',
    }),
  });
}

export function sendDataExportEmail(o: { to: string; name?: string | null; json: string }) {
  return sendMail({
    to: o.to,
    subject: 'Your FRIDGR data export',
    text: `${greeting(o.name)}\n\nAttached is a copy of the data FRIDGR stores about your account (JSON file), requested on ${stamp()}.\nKeep it somewhere safe: it contains your personal data.`,
    html: layout({
      preheader: 'Your data export is attached.',
      title: 'Your data export',
      body: para(esc(greeting(o.name))) + para(`Attached is a copy of the data FRIDGR stores about your account, requested on ${esc(stamp())}.`) + para('Keep it somewhere safe: it contains your personal data.'),
      security: 'If you did not request this, change your password and contact support.',
    }),
    attachments: [{ filename: 'fridgr-data-export.json', content: o.json, contentType: 'application/json' }],
  });
}

export function sendSupportReceivedEmail(o: { to: string; ref: string; topic: string }) {
  return sendMail({
    to: o.to,
    replyTo: config.SUPPORT_INBOX,
    subject: `We got your message (#${o.ref})`,
    text: `Thanks for contacting FRIDGR about ${o.topic}. We reply within two working days.\nYour reference is #${o.ref}. Reply to this email to add anything.`,
    html: layout({
      preheader: `Reference #${o.ref}`,
      title: 'We got your message',
      body: para(`Thanks for getting in touch about <strong>${esc(o.topic)}</strong>. We reply within two working days.`) + para(`Your reference is <strong>#${esc(o.ref)}</strong>. Reply to this email to add anything.`),
    }),
  });
}

/** Forward of an in-app support ticket to the support inbox (plain text). */
export function sendSupportTicketToInbox(o: { inbox: string; replyTo?: string; subject: string; text: string }) {
  return sendMail({ to: o.inbox, replyTo: o.replyTo, subject: o.subject, text: o.text });
}
