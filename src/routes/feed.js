import express from 'express';
import { getHomeJobFeed } from '../services/feedService.js';
import { getRecentJobViewEvents } from '../services/jobViewEventsService.js';

const router = express.Router();

router.get('/home', async (req, res) => {
  const options = req.query.options;
  const fetchHomeJobFeed = await getHomeJobFeed(options);
  res.json(fetchHomeJobFeed);
});

router.get('/job-views', async (req, res) => {
  try {
    const limitRaw = req.query.limit;
    const limit =
      typeof limitRaw === 'string' ? parseInt(limitRaw, 10) || 20 : 20;

    const events = await getRecentJobViewEvents({ limit });
    res.json({ events });
  } catch (err) {
    console.error('GET /api/feed/job-views error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err?.message ?? 'Failed to fetch job view events',
    });
  }
});

export default router;
