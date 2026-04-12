import express from 'express';
import { usersDao } from '../dao/usersDao.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Called by NextAuth jwt callback to upsert user and return roles
router.post('/sync', async (req, res) => {
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
    return res.json({ success: true, user });
  } catch (err) {
    logger.error('user sync failed', { error: err.message });
    return res.status(500).json({ success: false, message: 'sync failed' });
  }
});

// Called by onboarding to save role + display_name
router.patch('/me', async (req, res) => {
  const { email, role, display_name } = req.body;

  if (!email || !role) {
    return res.status(400).json({ success: false, message: 'email and role required' });
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
