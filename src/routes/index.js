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
import talentProfilesRoutes from './talentProfiles.js';
import adminRoutes from './admin.js';
import analyticsRoutes from './analytics.js';
import billingRoutes from './billing.js';
import { requireInternalSecret } from '../utils/internalAuth.js';

const router = express.Router();

// Internal ops/ingestion tools — never called by any user-facing frontend,
// only ever triggered manually or server-to-server. Publicly reachable
// otherwise (no nginx carve-out routes these to the session-checked Next.js
// layer), so they need their own gate: unauthenticated access would let
// anyone trigger expensive scraping/embedding jobs, disable cron ingestion,
// or run up OpenAI billing.
router.use('/cron', requireInternalSecret, cronRoutes);
router.use('/ai', requireInternalSecret, aiRoutes);
router.use('/sync', requireInternalSecret, syncRoutes);
router.use('/scripts', requireInternalSecret, scriptRoutes);

router.use('/company', companyRoutes);
router.use('/job', jobRoutes);
router.use('/feed', feedRoutes);
router.use('/filter', filterPagesRoutes);
router.use('/chat', chatRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/applications', applicationsRoutes);
router.use('/saved-jobs', savedJobsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/talent-profiles', talentProfilesRoutes);
router.use('/admin', adminRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/billing', billingRoutes);

router.use('/seo', seoRoutes);
router.use('/', sitemapRoutes); // backward compatibility

export default router;
