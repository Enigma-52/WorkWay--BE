import express from 'express';

import cronRoutes from './cron.js';

const router = express.Router();

router.use('/cron', cronRoutes);

export default router;
