import express from 'express';
import {
  getJobDetails,
  getJobList,
  getJobFilters,
  normalizeAndValidateListParams,
} from '../services/jobService.js';

const router = express.Router();

router.get('/details', async (req, res) => {
  try {
    const slug = req.query.slug;
    const jobDetails = await getJobDetails(slug);
    res.json(jobDetails);
  } catch (err) {
    console.error('GET /api/job/details error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err?.message ?? 'Failed to fetch job details',
    });
  }
});

router.get('/list', async (req, res) => {
  try {
    const validated = normalizeAndValidateListParams(req.query);
    if (validated.error) {
      return res.status(validated.status).json({
        error: 'Validation error',
        message: validated.message,
      });
    }
    const payload = await getJobList(validated);
    res.json(payload);
  } catch (err) {
    console.error('GET /api/job/list error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err?.message ?? 'Failed to fetch job list',
    });
  }
});

router.get('/filters', async (req, res) => {
  try {
    const payload = await getJobFilters();
    res.json(payload);
  } catch (err) {
    console.error('GET /api/job/filters error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err?.message ?? 'Failed to fetch filters',
    });
  }
});

export default router;
