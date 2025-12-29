import express from 'express';

import cronRoutes from './cron.js';
import companyRoutes from './company.js';
import jobRoutes from './job.js';

const router = express.Router();

router.use('/cron', cronRoutes);
router.use('/company', companyRoutes);
router.use('/job', jobRoutes);

export default router;
