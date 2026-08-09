import express from 'express';
import { getPublicStats30d } from '../services/analyticsService.js';
import { getMixpanelStats30d } from '../services/mixpanelStatsService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /public-stats — last-30-day site totals shown as social proof on /jobs.
// No auth: the numbers themselves aren't sensitive, same tier as job counts.
// Defaults to Mixpanel (filters `is_bot`, tagged at collection time) since
// GA4 has no equivalent way to exclude bot traffic after the fact — pass
// ?source=ga4 to compare against the raw GA4 numbers.
router.get('/public-stats', async (req, res) => {
  try {
    const stats =
      req.query.source === 'ga4' ? await getPublicStats30d() : await getMixpanelStats30d();
    res.json(stats);
  } catch (err) {
    logger.error('get public analytics stats failed', { error: err.message });
    res.status(500).json({ configured: false, last30Days: null });
  }
});

export default router;
