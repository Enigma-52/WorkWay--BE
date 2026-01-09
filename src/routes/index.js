import express from 'express';

import cronRoutes from './cron.js';
import companyRoutes from './company.js';
import jobRoutes from './job.js';
import feedRoutes from './feed.js';

const router = express.Router();

router.use('/cron', cronRoutes);
router.use('/company', companyRoutes);
router.use('/job', jobRoutes);
router.use('/feed', feedRoutes);

export default router;
