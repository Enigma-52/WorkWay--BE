import express from 'express';
import { alertsDao } from '../dao/alertsDao.js';
import { emailLogDao } from '../dao/emailLogDao.js';
import { usersDao } from '../dao/usersDao.js';
import { isPro } from '../utils/plans.js';
import { logger } from '../utils/logger.js';
import { requireInternalSecret } from '../utils/internalAuth.js';

const router = express.Router();

// user_id here is client-supplied with no session check of its own — this
// router must only ever be reachable from the session-checked Next.js BFF
// layer, never the browser directly, or user_id becomes guessable IDOR.
router.use(requireInternalSecret);

// GET /api/alerts/recent?user_id=X — the "Alerts" dashboard tab's data source.
// Gated server-side on plan, before any job data is fetched: a free request
// never gets the job list, so there's nothing for the client to leak by
// rendering it wrong. Must stay above `GET /:id`-shaped routes if any are
// ever added, so "recent" is never captured as an :id param.
router.get('/recent', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const user = await usersDao.getById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!isPro(user)) {
      return res.json({ pro: false });
    }

    const jobs = await emailLogDao.getCompanyAlertJobsForUser(user_id, 30);
    return res.json({ pro: true, jobs });
  } catch (err) {
    logger.error('alerts recent fetch failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts?user_id=X
// GET /api/alerts?user_id=X&check=1&alert_type=company&company_slug=xxx
router.get('/', async (req, res) => {
  const { user_id, check, alert_type, company_slug } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    if (check === '1') {
      const row = await alertsDao.checkAlert({
        userId: user_id,
        alertType: alert_type ?? 'company',
        companySlug: company_slug ?? null,
      });
      return res.json({ exists: !!row, alert: row ?? null });
    }
    const alerts = await alertsDao.getByUser(user_id);
    return res.json({ alerts });
  } catch (err) {
    logger.error('alerts get failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts
router.post('/', async (req, res) => {
  const { user_id, alert_type = 'company', company_slug, company_name, company_logo_url, metadata } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const alert = await alertsDao.createAlert({
      userId: user_id,
      alertType: alert_type,
      companySlug: company_slug ?? null,
      companyName: company_name ?? null,
      companyLogoUrl: company_logo_url ?? null,
      metadata: metadata ?? {},
    });
    if (!alert) {
      return res.json({ success: true, created: false, message: 'Alert already exists' });
    }
    return res.status(201).json({ success: true, created: true, alert });
  } catch (err) {
    logger.error('alert create failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const deleted = await alertsDao.deleteAlert({ id, userId: user_id });
    if (!deleted) return res.status(404).json({ error: 'Alert not found' });
    return res.json({ success: true });
  } catch (err) {
    logger.error('alert delete failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

export default router;
