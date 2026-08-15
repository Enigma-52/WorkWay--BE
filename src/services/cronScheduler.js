import cron from 'node-cron';
import { runCronJob } from './cronRunner.js';
import { defaultPgDao } from '../dao/dao.js';
import {
  insertGreenhouseJobsDaily,
  insertYCJobsDaily,
} from './dailyService.js';
import { fetchAshbyJobs } from './cronService.js';
import { runFeedbackRequestCron, runWeeklySummaryCron } from './lifecycleEmailService.js';
import { runCompanyAlertCheckCron } from './companyAlertService.js';
import { runExpireOldJobsCron } from '../dao/jobsDao.js';

export const JOBS = [
  // Greenhouse: every 4hrs → 0, 4, 8, 12, 16, 20
  { tag: 'daily_greenhouse', fn: insertGreenhouseJobsDaily, schedule: '0 0,4,8,12,16,20 * * *' },
  // Ashby: every 8hrs → 2, 10, 18  (2hr gap from GH)
  { tag: 'daily_ashby',      fn: fetchAshbyJobs,            schedule: '0 2,10,18 * * *' },
  // YC: every 8hrs → 6, 14, 22  (2hr gap from both GH and Ashby)
  { tag: 'daily_yc',         fn: insertYCJobsDaily,         schedule: '0 6,14,22 * * *' },
  // Lifecycle emails: both gated behind the lifecycle_emails_enabled feature
  // flag internally, so it's safe for this cron to run even before that's on.
  { tag: 'feedback_7day_email', fn: runFeedbackRequestCron, schedule: '0 9 * * *' },
  { tag: 'weekly_summary_email', fn: runWeeklySummaryCron,  schedule: '0 9 * * 1' },
  // Company alert poller: standalone, not chained onto ingestion — polls for
  // jobs newer than its own watermark every 10 minutes. Gated internally
  // behind company_alert_emails_enabled, so safe to run before that's on.
  { tag: 'company_alert_check', fn: runCompanyAlertCheckCron, schedule: '*/10 * * * *' },
  // Flips is_active off for postings older than EXPIRE_OLD_JOBS_DAYS
  // (jobsDao.js) — age-only proxy until real closure tracking exists, but
  // every public listing/count/search query now filters on is_active, so
  // this is what actually removes an old job from the app once it runs.
  { tag: 'expire_old_jobs', fn: runExpireOldJobsCron, schedule: '0 3 * * *' },
];

// Every job in JOBS gets an explicit cron_config row the moment it's
// registered here — enabled by default, but from now on because a row says
// so, not because `runCronJob` silently treats "no row" as enabled. Keeps
// the admin panel's toggle list complete without a separate manual step
// each time a new cron is added.
async function ensureCronConfigRows() {
  for (const job of JOBS) {
    try {
      await defaultPgDao.getQ({
        sql: `INSERT INTO cron_config (tag, enabled) VALUES ($1, true) ON CONFLICT (tag) DO NOTHING`,
        values: [job.tag],
      });
    } catch (err) {
      console.error(`[CRON] Failed to ensure cron_config row for "${job.tag}":`, err.message);
    }
  }
}

export async function startCronScheduler({ dryRun = false } = {}) {
  await ensureCronConfigRows();

  for (const job of JOBS) {
    cron.schedule(job.schedule, () => {
      runCronJob({ tag: job.tag, fn: job.fn, dryRun });
    });
    console.log(`[CRON] Scheduled "${job.tag}" → ${job.schedule}${dryRun ? ' (dry run)' : ''}`);
  }
}

/**
 * Parse a cron schedule and find the next matching time after `from`.
 * Supports: minute, hour, day-of-month, month, day-of-week (5-field).
 */
export function getNextRunTime(schedule, from = new Date()) {
  const [minExpr, hourExpr] = schedule.split(' ');

  const expandField = (expr, max) => {
    if (expr === '*') return Array.from({ length: max }, (_, i) => i);
    if (expr.startsWith('*/')) {
      const step = parseInt(expr.slice(2));
      return Array.from({ length: max }, (_, i) => i).filter((v) => v % step === 0);
    }
    return expr.split(',').map(Number);
  };

  const minutes = expandField(minExpr, 60);
  const hours = expandField(hourExpr, 24);

  // Search up to 48 hours ahead
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1); // start from next minute

  for (let i = 0; i < 2880; i++) {
    if (hours.includes(cursor.getHours()) && minutes.includes(cursor.getMinutes())) {
      return cursor;
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return null;
}
