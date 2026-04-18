import express from 'express';
import { alertsDao } from '../dao/alertsDao.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

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
