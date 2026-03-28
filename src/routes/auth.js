import express from 'express';
import passport from 'passport';
import { logger } from '../utils/logger.js';
import { sendMagicLink, verifyMagicLink } from '../services/magicLinkService.js';

const router = express.Router();

// ── Google OAuth ──────────────────────────────────────────────────────────────

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/api/auth/failure' }),
  (req, res) => {
    logger.info('Auth success', { user: req.user });
    res.json({ success: true, user: req.user });
  }
);

router.get('/failure', (req, res) => {
  logger.warn('Auth failure');
  res.status(401).json({ success: false, message: 'Authentication failed' });
});

// ── Magic Links ───────────────────────────────────────────────────────────────

router.post('/magic-link/send', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'A valid email is required' });
  }

  try {
    await sendMagicLink({
      email: email.toLowerCase().trim(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: 'Magic link sent — check your email' });
  } catch (err) {
    logger.error('Magic link send failed', { error: err.message, email });
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
