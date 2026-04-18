import express from 'express';

import cronRoutes from './cron.js';
import companyRoutes from './company.js';
import jobRoutes from './job.js';
import feedRoutes from './feed.js';
import sitemapRoutes from './sitemap.js';
import filterPagesRoutes from './filter.js';
import aiRoutes from './ai.js';
import chatRoutes from './chat.js';
import syncRoutes from './sync.js'
import feedbackRoutes from './feedback.js';
import authRoutes from './auth.js';
import userRoutes from './user.js';
import applicationsRoutes from './applications.js';
import savedJobsRoutes from './savedJobs.js';
import alertsRoutes from './alerts.js';
import seoRoutes from './seo.js';
import scriptRoutes from './script.js'

const router = express.Router();

router.use('/cron', cronRoutes);
router.use('/company', companyRoutes);
router.use('/job', jobRoutes);
router.use('/feed', feedRoutes);
router.use('/filter', filterPagesRoutes);
router.use('/ai', aiRoutes);
router.use('/chat', chatRoutes);
router.use('/sync', syncRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/applications', applicationsRoutes);
router.use('/saved-jobs', savedJobsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/scripts' , scriptRoutes)

router.use('/seo', seoRoutes);
router.use('/', sitemapRoutes); // backward compatibility

export default router;
