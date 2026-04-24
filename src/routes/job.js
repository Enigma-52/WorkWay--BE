import express from 'express';
import {
  getJobDetails,
  getJobList,
  getJobFilters,
  getSalaryInsights,
  normalizeAndValidateListParams,
} from '../services/jobService.js';
import { recordJobView } from '../services/jobViewEventsService.js';

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

router.post('/view', async (req, res) => {
  try {
    const body = req.body || {};

    // Skip recording local development traffic (localhost views)
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    const host = typeof req.headers.host === 'string' ? req.headers.host : '';
    if (origin.includes('localhost') || host.includes('localhost')) {
      return res.status(204).json({ skipped: true });
    }

    console.log("body", body);
    const slug =
      body.jobSlug ||
      body.slug ||
      body.job_slug ||
      (typeof req.query.slug === 'string' ? req.query.slug : undefined);

    const viewerCountry =
      body.viewer_country || body.viewerCountry || body.country || null;
    const viewerCity =
      body.viewer_city || body.viewerCity || body.city || null;
    const sourcePage =
      body.source_page || body.sourcePage || body.source || 'job';
    const userAgent = req.headers['user-agent'] || null;

    const event = await recordJobView({
      slug,
      viewerCountry,
      viewerCity,
      sourcePage,
      userAgent,
    });

    res.status(201).json({
      success: true,
      event,
    });
  } catch (err) {
    console.error('POST /api/job/view error:', err);
    const status = err?.statusCode && Number.isInteger(err.statusCode)
      ? err.statusCode
      : 500;
    res.status(status).json({
      error: 'Internal server error',
      message: err?.message ?? 'Failed to record job view',
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

router.get('/salary-insights', async (req, res) => {
  try {
    const { page, limit, sort, domain, experience_level, employment_type, equity, bonus, location } = req.query;
    const data = await getSalaryInsights({
      filters: { domain, experience_level, employment_type, equity, bonus, location },
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort: sort || 'salary_desc',
    });
    res.json(data);
  } catch (err) {
    console.error('GET /api/job/salary-insights error:', err);
    res.status(500).json({ error: 'Internal server error', message: err?.message });
  }
});

export default router;
