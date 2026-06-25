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
