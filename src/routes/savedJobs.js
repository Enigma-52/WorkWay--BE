import express from 'express';
import { savedJobsDao } from '../dao/savedJobsDao.js';

const router = express.Router();

router.get('/summary', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const result = await savedJobsDao.countByUser(user_id);
    res.json({ count: result?.count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const jobs = await savedJobsDao.getByUser(user_id);
    res.json({ saved_jobs: jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { user_id, job_slug, job_title, company, company_logo_url, location, employment_type, job_url } = req.body;
  if (!user_id || !job_slug) return res.status(400).json({ error: 'user_id and job_slug required' });
  try {
    const rows = await savedJobsDao.saveJob({ userId: user_id, jobSlug: job_slug, jobTitle: job_title, company, companyLogoUrl: company_logo_url, location, employmentType: employment_type, jobUrl: job_url });
    res.status(201).json({ success: true, saved: rows[0] ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:slug', async (req, res) => {
  const { user_id } = req.query;
  const { slug } = req.params;
  if (!user_id || !slug) return res.status(400).json({ error: 'user_id and slug required' });
  try {
    await savedJobsDao.unsaveJob({ userId: user_id, jobSlug: slug });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
