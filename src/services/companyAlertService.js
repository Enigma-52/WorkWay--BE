import { Resend } from 'resend';
import { alertsDao } from '../dao/alertsDao.js';
import { alertCheckpointDao } from '../dao/alertCheckpointDao.js';
import { emailLogDao } from '../dao/emailLogDao.js';
import { jobsDao } from '../dao/jobsDao.js';
import { featureFlagsDao } from '../dao/featureFlagsDao.js';
import { generateUnsubscribeToken } from '../utils/unsubscribeToken.js';
import { companyAlertEmailHtml, shortenCompanyName, EMAIL_FROM } from '../utils/emailTemplates.js';
import { isPro } from '../utils/plans.js';
import { logger } from '../utils/logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = EMAIL_FROM;
const SITE_URL = process.env.FRONTEND_ORIGIN || 'https://www.workway.dev';
const FLAG = 'company_alert_emails_enabled';
const EMAIL_TYPE = 'company_alert';
const ALERTS_URL = `${SITE_URL}/dashboard/seeker/alerts`;

// Shortened names keep the subject line readable in inbox previews — full
// names still appear in the email body.
function subjectFor(groups) {
  if (groups.length === 1) {
    const g = groups[0];
    return `${shortenCompanyName(g.companyName)} just posted ${g.jobs.length === 1 ? 'a new role' : 'new roles'}`;
  }
  const named = groups.slice(0, 2).map((g) => shortenCompanyName(g.companyName));
  const extra = groups.length - named.length;
  const namesPart = extra > 0 ? `${named.join(', ')} +${extra} more` : named.join(' & ');
  return `${namesPart} posted new roles`;
}

async function sendDigest(user, groups) {
  const unsubscribeUrl = `${SITE_URL.replace(/\/$/, '')}/api/user/unsubscribe?uid=${user.user_id ?? user.id}&token=${generateUnsubscribeToken(user.user_id ?? user.id)}`;
  const html = companyAlertEmailHtml({
    displayName: user.display_name,
    groups: groups.map((g) => ({
      companyName: g.companyName,
      companySlug: g.companySlug,
      jobs: g.jobs.map((j) => ({
        title: j.title,
        location: j.location,
        url: `${SITE_URL}/job/${j.slug}`,
      })),
    })),
    unsubscribeUrl,
    alertsUrl: ALERTS_URL,
  });

  const { error } = await resend.emails.send({ from: FROM, to: user.email, subject: subjectFor(groups), html });
  if (error) throw new Error(error.message || 'Resend send failed');
}

/**
 * Runs on a fixed interval (see cronScheduler.js). Finds jobs inserted since
 * the last watermark, matches them against followers, and emails Pro
 * followers a digest — grouped by company, never one email per job.
 *
 * Decoupled from the ingestion crons on purpose: there's no hook system to
 * chain onto, and a poll-based design means an Ashby failure can't block a
 * Greenhouse-sourced alert.
 */
export async function runCompanyAlertCheckCron() {
  const checkpoint = await alertCheckpointDao.get();
  const newJobs = await jobsDao.getNewJobsSince(checkpoint);

  if (!newJobs.length) {
    return { checked: 0, matchedCompanies: 0, sent: 0 };
  }

  const maxId = newJobs.reduce((max, j) => Math.max(max, Number(j.id)), checkpoint);
  const slugs = [...new Set(newJobs.map((j) => j.company_slug).filter(Boolean))];

  if (!slugs.length) {
    await alertCheckpointDao.advance(maxId);
    return { checked: newJobs.length, matchedCompanies: 0, sent: 0 };
  }

  const flagOn = await featureFlagsDao.isEnabled(FLAG);
  const followers = await alertsDao.getFollowersForCompanySlugs(slugs);

  // company_slug -> jobs posted this run
  const jobsByCompany = new Map();
  for (const job of newJobs) {
    if (!job.company_slug) continue;
    if (!jobsByCompany.has(job.company_slug)) jobsByCompany.set(job.company_slug, []);
    jobsByCompany.get(job.company_slug).push(job);
  }

  // user_id -> { user, companies: Map<slug, { companyName, jobs }> }
  const byUser = new Map();
  for (const follower of followers) {
    const jobs = jobsByCompany.get(follower.company_slug);
    if (!jobs) continue;
    if (!byUser.has(follower.user_id)) {
      byUser.set(follower.user_id, { user: follower, companies: new Map() });
    }
    byUser.get(follower.user_id).companies.set(follower.company_slug, {
      companyName: follower.company_name || jobs[0].company_name,
      jobs,
    });
  }

  let sent = 0;
  let skippedNotPro = 0;
  let skippedOptedOut = 0;

  // When the flag is off, still advance the checkpoint and skip every
  // candidate below (counted, nothing sent) — the same safe-rollout shape
  // lifecycle_emails_enabled already uses, so flipping this on later never
  // triggers a backlog flood of everything matched while it was off.
  for (const [userId, { user, companies }] of byUser) {
    if (user.emails_opted_out) {
      skippedOptedOut++;
      continue;
    }
    if (!isPro(user)) {
      skippedNotPro++;
      continue;
    }
    if (!flagOn) continue;

    // Per-job dedup so a follow/unfollow/refollow or a retried run never
    // emails the same user about the same job twice.
    const groups = [];
    for (const [companySlug, { companyName, jobs }] of companies) {
      const unseen = [];
      for (const job of jobs) {
        const already = await emailLogDao.hasSent({ userId, emailType: EMAIL_TYPE, referenceId: String(job.id) });
        if (!already) unseen.push(job);
      }
      if (unseen.length) groups.push({ companySlug, companyName, jobs: unseen });
    }
    if (!groups.length) continue;

    try {
      await sendDigest({ user_id: userId, email: user.email, display_name: user.display_name }, groups);
      for (const g of groups) {
        for (const job of g.jobs) {
          await emailLogDao.log({ userId, emailType: EMAIL_TYPE, referenceId: String(job.id) });
        }
      }
      sent++;
    } catch (err) {
      logger.error('company_alert send failed', { userId, error: err.message });
    }
  }

  await alertCheckpointDao.advance(maxId);

  return {
    checked: newJobs.length,
    matchedCompanies: slugs.length,
    matchedFollowers: byUser.size,
    sent,
    skippedNotPro,
    skippedOptedOut,
    flagOn,
  };
}

/** Admin test-send: synthetic data, no real job/follower lookups involved. */
export async function sendTestCompanyAlertEmail(user) {
  const groups = [
    {
      companyName: 'Acme Inc (sample)',
      companySlug: 'acme-inc',
      jobs: [
        { title: 'Senior Product Designer', location: 'Remote', url: `${SITE_URL}/jobs` },
        { title: 'Backend Engineer', location: 'San Francisco, CA', url: `${SITE_URL}/jobs` },
      ],
    },
    {
      companyName: 'Globex Corp (sample)',
      companySlug: 'globex-corp',
      jobs: [{ title: 'Growth Marketer', location: 'Remote', url: `${SITE_URL}/jobs` }],
    },
    {
      companyName: 'Initech (sample)',
      companySlug: 'initech',
      jobs: [{ title: 'Support Engineer', location: 'Austin, TX', url: `${SITE_URL}/jobs` }],
    },
  ];

  const html = companyAlertEmailHtml({ displayName: user.display_name, groups, alertsUrl: ALERTS_URL });
  const { error } = await resend.emails.send({ from: FROM, to: user.email, subject: subjectFor(groups), html });
  if (error) throw new Error(error.message || 'Resend send failed');

  await emailLogDao.log({ userId: user.id, emailType: EMAIL_TYPE, isTest: true });
  logger.info('Test company alert email sent', { userId: user.id });
}
