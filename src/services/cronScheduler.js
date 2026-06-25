import cron from 'node-cron';
import { runCronJob } from './cronRunner.js';
import {
  insertGreenhouseJobsDaily,
  insertYCJobsDaily,
} from './dailyService.js';
import { fetchAshbyJobs } from './cronService.js';

export const JOBS = [
  // Greenhouse: every 2 hrs — 0,2,4,6,8,10,12,14,16,18,20,22
  { tag: 'daily_greenhouse', fn: insertGreenhouseJobsDaily, schedule: '0 */2 * * *' },
  // Ashby: every 4 hrs — 1,5,9,13,17,21  (offset by 1hr to avoid collision)
  { tag: 'daily_ashby',      fn: fetchAshbyJobs,            schedule: '0 1,5,9,13,17,21 * * *' },
  // YC: every 7 hrs — 0,7,14,21  (offset by 30min to avoid collision with greenhouse)
  { tag: 'daily_yc',         fn: insertYCJobsDaily,         schedule: '30 0,7,14,21 * * *' },
];

export function startCronScheduler({ dryRun = false } = {}) {
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
