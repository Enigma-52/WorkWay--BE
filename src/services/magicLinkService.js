// src/services/magicLinkService.js
import crypto from 'crypto';
import { Resend } from 'resend';
import { magicLinksDao } from '../dao/magicLinksDao.js';
import { usersDao } from '../dao/usersDao.js';
import { logger } from '../utils/logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export async function sendMagicLink({ email, ipAddress, userAgent }) {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const insertedRow = await magicLinksDao.insert({ email, tokenHash: hash, expiresAt, ipAddress, userAgent });

  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';
  const link = `${frontendOrigin}/auth/verify?token=${raw}`;

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'noreply@workway.dev',
    to: email,
    subject: 'Your WorkWay sign-in link',
    html: `
      <p>Click the link below to sign in to WorkWay. This link expires in 15 minutes and can only be used once.</p>
      <p><a href="${link}">Sign in to WorkWay</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (error) {
    logger.error('Resend email failed', { error, email });
    await magicLinksDao.deleteById(insertedRow.id);
    throw new Error('Failed to send magic link email');
  }

  logger.info('Magic link sent', { email });
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

  logger.info('Magic link verified', { email: row.email, userId: user.id });
  return { success: true, user };
}
