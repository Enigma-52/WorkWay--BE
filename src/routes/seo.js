import express from 'express';
import { getValidLocationCombos } from '../services/sitemapService.js';

const router = express.Router();

/**
 * GET /api/seo/valid-location-combos
 * Returns role+location slug pairs that have >5 matching jobs.
 * Used by the Next.js location-jobs hub page to filter links.
 */
router.get('/valid-location-combos', async (req, res) => {
  const combos = await getValidLocationCombos().catch(() => []);
  res
    .setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    .json({ combos });
});

export default router;
