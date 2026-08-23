import express from 'express';
import { usersDao } from '../dao/usersDao.js';
import { sendWelcomeEmail } from '../services/lifecycleEmailService.js';
import { verifyUnsubscribeToken } from '../utils/unsubscribeToken.js';
import { requireInternalSecret } from '../utils/internalAuth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

function fireWelcomeEmailIfNew(user) {
  if (!user?.is_new) return;
  sendWelcomeEmail(user).catch((err) =>
    logger.error('welcome email send failed', { userId: user.id, error: err.message })
  );
}

// Called by NextAuth jwt callback (server-side only) to upsert user and return roles
router.post('/sync', requireInternalSecret, async (req, res) => {
  const { email, display_name, first_name, last_name, avatar_url } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'email required' });
  }

  try {
    const user = await usersDao.upsertUser({
      email,
      emailVerified: true,
      displayName: display_name ?? null,
      firstName: first_name ?? null,
      lastName: last_name ?? null,
      avatarUrl: avatar_url ?? null,
    });
    fireWelcomeEmailIfNew(user);
    return res.json({ success: true, user });
  } catch (err) {
    logger.error('user sync failed', { error: err.message });
    return res.status(500).json({ success: false, message: 'sync failed' });
  }
});

// GET /me?user_id= — lets the frontend detect when its cached session JWT
// (plan_key, roles) has drifted from the DB, e.g. right after a Dodo
// checkout or an admin-panel grant, neither of which updates the browser's
// existing session cookie on their own.
//
// Gated on the internal secret: user_id/email here comes straight from the
// request with no session check of its own, so this must only ever be
// reachable from the session-checked Next.js BFF layer, never the browser
// directly.
router.get('/me', requireInternalSecret, async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const user = await usersDao.getById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, plan_key: user.plan_key, roles: user.roles, display_name: user.display_name });
  } catch (err) {
    logger.error('get /user/me failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /unsubscribe?uid=&token= — one-click unsubscribe link from weekly summary emails
router.get('/unsubscribe', async (req, res) => {
  const { uid, token } = req.query;
  if (!uid || !token || !verifyUnsubscribeToken(uid, token)) {
    return res.status(400).send('Invalid or expired unsubscribe link.');
  }

  try {
    await usersDao.setEmailsOptedOut(uid, true);
    res.send('You have been unsubscribed from WorkWay weekly summary emails.');
  } catch (err) {
    logger.error('unsubscribe failed', { error: err.message, uid });
    res.status(500).send('Something went wrong. Please try again later.');
  }
});

// Never allow arbitrary role strings here — "admin" must only ever be
// granted directly in the database, never through a public API.
const ONBOARDING_ROLES = new Set(['seeker', 'hirer']);

// Called by onboarding to save role + display_name. Gated on the internal
// secret: `email` here is client-supplied with no session check, and this
// can set role — an unauthenticated caller could otherwise grant themselves
// (or anyone) 'hirer' by guessing an email.
router.patch('/me', requireInternalSecret, async (req, res) => {
  const { email, role, display_name } = req.body;

  if (!email || !role) {
    return res.status(400).json({ success: false, message: 'email and role required' });
  }
  if (!ONBOARDING_ROLES.has(role)) {
    return res.status(400).json({ success: false, message: `role must be one of: ${[...ONBOARDING_ROLES].join(', ')}` });
  }

  try {
    const user = await usersDao.updateRoleAndName({ email, role, displayName: display_name });
    return res.json({ success: true, user });
  } catch (err) {
    logger.error('user update failed', { error: err.message });
    return res.status(500).json({ success: false, message: 'update failed', detail: err.message });
  }
});

export default router;
