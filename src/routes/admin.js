import express from 'express';
import { usersDao } from '../dao/usersDao.js';
import { featureFlagsDao } from '../dao/featureFlagsDao.js';
import { sendTestEmail } from '../services/lifecycleEmailService.js';
import { hasAdminRole } from '../utils/roles.js';
import { requireInternalSecret } from '../utils/internalAuth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Only the Next.js server (which has already verified a real admin session)
// may call these — never the browser directly. requireAdmin below is a
// second, independent check on top of this.
router.use(requireInternalSecret);

async function requireAdmin(req, res, next) {
  const userId = req.body?.user_id || req.query?.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });

  try {
    const user = await usersDao.getById(userId);
    if (!user || !hasAdminRole(user.roles)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    logger.error('admin auth check failed', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /test-email — sends the given lifecycle email type to the calling admin's own inbox.
router.post('/test-email', requireAdmin, async (req, res) => {
  const { email_type } = req.body;
  if (!email_type) return res.status(400).json({ error: 'email_type required' });

  try {
    await sendTestEmail(req.adminUser, email_type);
    res.json({ success: true, sent_to: req.adminUser.email, email_type });
  } catch (err) {
    logger.error('admin test email failed', { error: err.message, email_type });
    res.status(500).json({ error: err.message });
  }
});

// GET /feature-flags?user_id=
router.get('/feature-flags', requireAdmin, async (req, res) => {
  try {
    const flags = await featureFlagsDao.getAll();
    res.json({ flags });
  } catch (err) {
    logger.error('get feature flags failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /feature-flags/:key — body: { user_id, enabled }
router.patch('/feature-flags/:key', requireAdmin, async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) required' });

  try {
    const flag = await featureFlagsDao.setEnabled(req.params.key, enabled);
    if (!flag) return res.status(404).json({ error: 'Flag not found' });
    res.json({ success: true, flag });
  } catch (err) {
    logger.error('set feature flag failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
