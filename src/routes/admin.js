import express from 'express';
import { usersDao } from '../dao/usersDao.js';
import { featureFlagsDao } from '../dao/featureFlagsDao.js';
import { plansDao } from '../dao/plansDao.js';
import { subscriptionsDao } from '../dao/subscriptionsDao.js';
import { grantPlan, cancelSubscription } from '../services/subscriptionsService.js';
import { sendTestEmail } from '../services/lifecycleEmailService.js';
import { sendTestCompanyAlertEmail } from '../services/companyAlertService.js';
import { getAnalyticsOverview } from '../services/analyticsService.js';
import { getMixpanelStats30d } from '../services/mixpanelStatsService.js';
import { requireAdmin } from '../utils/roles.js';
import { requireInternalSecret } from '../utils/internalAuth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Only the Next.js server (which has already verified a real admin session)
// may call these — never the browser directly. requireAdmin below is a
// second, independent check on top of this.
router.use(requireInternalSecret);

// POST /test-email — sends the given lifecycle email type to the calling admin's own inbox.
router.post('/test-email', requireAdmin, async (req, res) => {
  const { email_type } = req.body;
  if (!email_type) return res.status(400).json({ error: 'email_type required' });

  try {
    if (email_type === 'company_alert') {
      await sendTestCompanyAlertEmail(req.adminUser);
    } else {
      await sendTestEmail(req.adminUser, email_type);
    }
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

// GET /analytics/overview — GA4 (raw, includes bot traffic) alongside
// Mixpanel's 30-day total (filters `is_bot`) for comparison.
router.get('/analytics/overview', requireAdmin, async (req, res) => {
  try {
    const [ga4, mixpanel] = await Promise.all([getAnalyticsOverview(), getMixpanelStats30d()]);
    res.json({ ...ga4, mixpanelLast30Days: mixpanel.configured ? mixpanel.last30Days : null });
  } catch (err) {
    logger.error('get analytics overview failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /plans — plan catalog, for populating an admin dropdown
router.get('/plans', requireAdmin, async (req, res) => {
  try {
    const plans = await plansDao.getAllActive();
    res.json({ plans });
  } catch (err) {
    logger.error('get plans failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /users/search?user_id=&q= — search by email or display name, for the admin user picker
router.get('/users/search', requireAdmin, async (req, res) => {
  const { q } = req.query;
  if (!q || String(q).trim().length < 2) {
    return res.status(400).json({ error: 'q (2+ characters) required' });
  }

  try {
    const users = await usersDao.search(q);
    res.json({ users });
  } catch (err) {
    logger.error('user search failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /grant-plan — body: { user_id (admin), target_email, plan_key, duration_days? }
// duration_days omitted/null = unlimited. Computed server-side, never trust a client-supplied date.
router.post('/grant-plan', requireAdmin, async (req, res) => {
  const { target_email, plan_key, duration_days } = req.body;
  if (!target_email || !plan_key) {
    return res.status(400).json({ error: 'target_email and plan_key required' });
  }
  if (duration_days != null && (!Number.isFinite(Number(duration_days)) || Number(duration_days) <= 0)) {
    return res.status(400).json({ error: 'duration_days must be a positive number, or omitted for unlimited' });
  }

  try {
    const targetUser = await usersDao.getByEmail(target_email);
    if (!targetUser) return res.status(404).json({ error: 'No user with that email' });

    const expiresAt = duration_days
      ? new Date(Date.now() + Number(duration_days) * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const result = await grantPlan({
      userId: targetUser.id,
      planKey: plan_key,
      source: 'admin_grant',
      expiresAt,
    });
    logger.info('Plan granted', { adminId: req.adminUser.id, targetEmail: target_email, planKey: plan_key, expiresAt });
    res.status(201).json({ success: true, ...result, target_email, expires_at: expiresAt });
  } catch (err) {
    logger.error('grant plan failed', { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

// POST /grant-role — body: { user_id (admin), target_email, role }
// Roles (e.g. "admin") are permanent flags, not time-limited like plans.
router.post('/grant-role', requireAdmin, async (req, res) => {
  const { target_email, role } = req.body;
  if (!target_email || !role) {
    return res.status(400).json({ error: 'target_email and role required' });
  }

  try {
    const targetUser = await usersDao.getByEmail(target_email);
    if (!targetUser) return res.status(404).json({ error: 'No user with that email' });

    const updated = await usersDao.addRole(targetUser.id, role);
    logger.info('Role granted', { adminId: req.adminUser.id, targetEmail: target_email, role });
    res.status(201).json({ success: true, user: updated });
  } catch (err) {
    logger.error('grant role failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /revoke-role — body: { user_id (admin), target_email, role }
router.post('/revoke-role', requireAdmin, async (req, res) => {
  const { target_email, role } = req.body;
  if (!target_email || !role) {
    return res.status(400).json({ error: 'target_email and role required' });
  }

  try {
    const targetUser = await usersDao.getByEmail(target_email);
    if (!targetUser) return res.status(404).json({ error: 'No user with that email' });

    const updated = await usersDao.removeRole(targetUser.id, role);
    logger.info('Role revoked', { adminId: req.adminUser.id, targetEmail: target_email, role });
    res.json({ success: true, user: updated });
  } catch (err) {
    logger.error('revoke role failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /subscriptions?user_id=&target_email= — view a user's subscription history
router.get('/subscriptions', requireAdmin, async (req, res) => {
  const { target_email } = req.query;
  if (!target_email) return res.status(400).json({ error: 'target_email required' });

  try {
    const targetUser = await usersDao.getByEmail(target_email);
    if (!targetUser) return res.status(404).json({ error: 'No user with that email' });

    const subscriptions = await subscriptionsDao.getByUser(targetUser.id);
    res.json({ subscriptions, plan_key: targetUser.plan_key });
  } catch (err) {
    logger.error('get subscriptions failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /cancel-subscription — body: { user_id (admin), target_email, subscription_id }
router.post('/cancel-subscription', requireAdmin, async (req, res) => {
  const { target_email, subscription_id } = req.body;
  if (!target_email || !subscription_id) {
    return res.status(400).json({ error: 'target_email and subscription_id required' });
  }

  try {
    const targetUser = await usersDao.getByEmail(target_email);
    if (!targetUser) return res.status(404).json({ error: 'No user with that email' });

    const result = await cancelSubscription({ subscriptionId: subscription_id, userId: targetUser.id });
    if (!result) return res.status(404).json({ error: 'Subscription not found for that user' });

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('cancel subscription failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
