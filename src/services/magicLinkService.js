// src/services/magicLinkService.js
import crypto from 'crypto';
import { Resend } from 'resend';
import { magicLinksDao } from '../dao/magicLinksDao.js';
import { usersDao } from '../dao/usersDao.js';
import { emailLogDao } from '../dao/emailLogDao.js';
import { logger } from '../utils/logger.js';
import { magicLinkEmailHtml, EMAIL_FROM } from '../utils/emailTemplates.js';
import { sendWelcomeEmail } from './lifecycleEmailService.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export async function sendMagicLink({ email, ipAddress, userAgent, callbackUrl }) {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const insertedRow = await magicLinksDao.insert({ email, tokenHash: hash, expiresAt, ipAddress, userAgent });

  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';
  // Carries the visitor's original destination (e.g. a Pro alert email
  // linking straight to /dashboard/seeker/alerts) through the click-email
  // round trip — the token alone has no way to remember where sign-in was
  // triggered from, since verification happens on a different page/request.
  const link = callbackUrl
    ? `${frontendOrigin}/auth/verify?token=${raw}&callbackUrl=${encodeURIComponent(callbackUrl)}`
    : `${frontendOrigin}/auth/verify?token=${raw}`;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: 'Your WorkWay sign-in link',
    html: magicLinkEmailHtml({ link }),
  });

  // Only an existing user has an email_log-eligible row (the table's
  // user_id FK requires one) — a brand-new email signing in for the first
  // time has no user row yet at this point, so there's nothing to attach
  // the log to. That's fine: this is meant to diagnose "I'm not getting my
  // sign-in email" for people who already have an account, the common case.
  const existingUser = await usersDao.getByEmail(email);

  if (error) {
    logger.error('Resend email failed', { error, email });
    if (existingUser) {
      await emailLogDao.log({ userId: existingUser.id, emailType: 'magic_link', status: 'failed', error: error.message, recipient: email });
    }
    await magicLinksDao.deleteById(insertedRow.id);
    throw new Error('Failed to send magic link email');
  }

  if (existingUser) {
    await emailLogDao.log({ userId: existingUser.id, emailType: 'magic_link', providerMessageId: data?.id ?? null, recipient: email });
  }

  logger.info('Magic link sent', { email, providerMessageId: data?.id });
}

export async function verifyMagicLink({ token }) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const row = await magicLinksDao.findByHash(hash);

  if (!row) {
    return { success: false, reason: 'Invalid or unknown token' };
  }

  if (row.used_at !== null) {
    return { success: false, reason: 'Token has already been used' };
  }

  if (new Date(row.expires_at) < new Date()) {
    return { success: false, reason: 'Token has expired' };
  }

  await magicLinksDao.markUsed(row.id);

  const existingUser = await usersDao.getByEmail(row.email);

  const user = await usersDao.upsertUser({
    email: row.email,
    emailVerified: true,
    displayName: existingUser ? existingUser.display_name : row.email.split('@')[0],
    firstName: existingUser ? existingUser.first_name : null,
    lastName: existingUser ? existingUser.last_name : null,
    avatarUrl: existingUser ? existingUser.avatar_url : null,
  });

  if (!user) {
    throw new Error('Failed to create or retrieve user');
  }

  if (user.is_new) {
    sendWelcomeEmail(user).catch((err) =>
      logger.error('welcome email send failed', { userId: user.id, error: err.message })
    );
  }

  logger.info('Magic link verified', { email: row.email, userId: user.id });
  return { success: true, user };
}
