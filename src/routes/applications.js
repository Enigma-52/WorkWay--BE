import express from 'express';
import { applicationsDao } from '../dao/applicationsDao.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { user_id, job_slug, job_title, company, company_logo_url, location, employment_type } = req.body;
  if (!user_id || !job_slug) {
    return res.status(400).json({ error: 'user_id and job_slug required' });
  }
  try {
    const rows = await applicationsDao.addApplication({
      userId: user_id,
      jobSlug: job_slug,
      jobTitle: job_title,
      company,
      companyLogoUrl: company_logo_url,
      location,
      employmentType: employment_type,
    });
    res.status(201).json({ success: true, application: rows[0] ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id, status, notes } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const application = await applicationsDao.updateApplication({ id, userId: user_id, status, notes });
    res.json({ success: true, application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const summary = await applicationsDao.countByUser(user_id);
    res.json({ count: summary?.count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const applications = await applicationsDao.getByUser(user_id);
    res.json({ applications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
