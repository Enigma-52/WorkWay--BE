import express from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';
import { sendMagicLink, verifyMagicLink } from '../services/magicLinkService.js';
import { isAllowedEmailDomain } from '../utils/allowedEmailDomains.js';

const router = express.Router();

const magicLinkSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts. Please try again in a few minutes.' },
});

// ── Magic Links ───────────────────────────────────────────────────────────────

router.post('/magic-link/send', magicLinkSendLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'A valid email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!isAllowedEmailDomain(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Please use a personal email from a supported provider (Gmail, Yahoo, Outlook, Proton, iCloud, etc.), or sign in with Google instead.',
    });
  }

  try {
    await sendMagicLink({
      email: normalizedEmail,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: 'Magic link sent — check your email' });
  } catch (err) {
    logger.error('Magic link send failed', { error: err.message, email: normalizedEmail });
    res.status(500).json({ success: false, message: 'Failed to send magic link' });
  }
});

router.get('/magic-link/verify', async (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  try {
    const result = await verifyMagicLink({ token });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    await new Promise((resolve, reject) => {
      req.login(result.user, (err) => (err ? reject(err) : resolve()));
    });

    res.json({ success: true, user: result.user });
  } catch (err) {
    logger.error('Magic link verify failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

export default router;
