import express from 'express';
import passport from 'passport';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Redirect user to Google login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google callback
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

export default router;
