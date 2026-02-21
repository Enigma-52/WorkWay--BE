import express from 'express';

import cronRoutes from './cron.js';
import companyRoutes from './company.js';
import jobRoutes from './job.js';
import feedRoutes from './feed.js';
import sitemapRoutes from './sitemap.js';
import filterPagesRoutes from './filter.js';
import aiRoutes from './ai.js';

const router = express.Router();

router.use('/cron', cronRoutes);
router.use('/company', companyRoutes);
router.use('/job', jobRoutes);
router.use('/feed', feedRoutes);
router.use('/filter', filterPagesRoutes);
router.use('/ai', aiRoutes);
router.use('/', sitemapRoutes); // backward compatibility

export default router;
