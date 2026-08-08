import { Resend } from 'resend';
import { usersDao } from '../dao/usersDao.js';
import { emailLogDao } from '../dao/emailLogDao.js';
import { savedJobsDao } from '../dao/savedJobsDao.js';
import { applicationsDao } from '../dao/applicationsDao.js';
import { jobsDao } from '../dao/jobsDao.js';
import { featureFlagsDao } from '../dao/featureFlagsDao.js';
import { generateUnsubscribeToken } from '../utils/unsubscribeToken.js';
import {
  welcomeEmailHtml,
  feedbackRequestEmailHtml,
  weeklySummaryEmailHtml,
} from '../utils/emailTemplates.js';
import { logger } from '../utils/logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@workway.dev';
const SITE_URL = process.env.FRONTEND_ORIGIN || 'https://www.workway.dev';
const LIFECYCLE_FLAG = 'lifecycle_emails_enabled';

async function send({ to, subject, html }) {
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(error.message || 'Resend send failed');
}

export async function sendWelcomeEmail(user, { isTest = false } = {}) {
  const html = welcomeEmailHtml({
    displayName: user.display_name || user.first_name || null,
    jobsUrl: `${SITE_URL}/jobs`,
  });
  await send({ to: user.email, subject: 'Welcome to WorkWay', html });
  await emailLogDao.log({ userId: user.id, emailType: 'welcome', isTest });
  logger.info('Welcome email sent', { userId: user.id, isTest });
}

export async function sendFeedbackRequestEmail(user, { isTest = false } = {}) {
  const html = feedbackRequestEmailHtml({
    displayName: user.display_name || user.first_name || null,
    feedbackUrl: 'https://workway.featurebase.app/',
  });
  await send({ to: user.email, subject: "How's WorkWay working for you?", html });
  await emailLogDao.log({ userId: user.id, emailType: 'feedback_7day', isTest });
  logger.info('7-day feedback email sent', { userId: user.id, isTest });
}

export async function sendWeeklySummaryEmail(user, { isTest = false } = {}) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [savedJobsCount, applicationsCount, trendingDomains] = await Promise.all([
    savedJobsDao.countByUserSince(user.id, since),
    applicationsDao.countByUserSince(user.id, since),
    jobsDao.getTrendingDomainsSince(since, 5),
  ]);

  const unsubscribeUrl = `${SITE_URL.replace(/\/$/, '')}/api/user/unsubscribe?uid=${user.id}&token=${generateUnsubscribeToken(user.id)}`;

  const html = weeklySummaryEmailHtml({
    displayName: user.display_name || user.first_name || null,
    savedJobsCount,
    applicationsCount,
    trendingDomains: trendingDomains.map((d) => ({ domain: d.domain, count: d.count })),
    jobsUrl: `${SITE_URL}/jobs`,
    unsubscribeUrl,
  });

  await send({ to: user.email, subject: 'Your week on WorkWay', html });
  await emailLogDao.log({ userId: user.id, emailType: 'weekly_summary', isTest });
  logger.info('Weekly summary email sent', { userId: user.id, isTest });
}

const SENDERS = {
  welcome: sendWelcomeEmail,
  feedback_7day: sendFeedbackRequestEmail,
  weekly_summary: sendWeeklySummaryEmail,
};

export async function sendTestEmail(user, emailType) {
  const fn = SENDERS[emailType];
  if (!fn) throw new Error(`Unknown email type: ${emailType}`);
  return fn(user, { isTest: true });
}

// ── Scheduled runs (real users, gated by feature flag) ──

export async function runFeedbackRequestCron() {
  if (!(await featureFlagsDao.isEnabled(LIFECYCLE_FLAG))) {
    return { skipped: true, reason: 'lifecycle_emails_enabled is off' };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const users = await usersDao.getUsersDueForEmail({
    emailType: 'feedback_7day',
    createdBefore: sevenDaysAgo,
  });

  let sent = 0;
  for (const user of users) {
    try {
      await sendFeedbackRequestEmail(user);
      sent++;
    } catch (err) {
      logger.error('feedback_7day send failed', { userId: user.id, error: err.message });
    }
  }
  return { sent, candidates: users.length };
}

export async function runWeeklySummaryCron() {
  if (!(await featureFlagsDao.isEnabled(LIFECYCLE_FLAG))) {
    return { skipped: true, reason: 'lifecycle_emails_enabled is off' };
  }

  const users = await usersDao.getUsersDueForEmail({
    emailType: 'weekly_summary',
    withinDays: 7,
  });

  let sent = 0;
  for (const user of users) {
    try {
      await sendWeeklySummaryEmail(user);
      sent++;
    } catch (err) {
      logger.error('weekly_summary send failed', { userId: user.id, error: err.message });
    }
  }
  return { sent, candidates: users.length };
}
