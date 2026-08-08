import express from 'express';
import { fetchGreenhouseJobs, insertGreenhouseCompanies , insertYCcompanies ,  insertLeverCompanies , fetchLeverJobs , insertAshbyCompanies , fetchAshbyJobs , insertWorkableCompanies} from '../services/cronService.js';
import { backfillSkillsFromStoredDescriptions } from '../services/backfillService.js'
import { insertGreenhouseJobsDaily , insertWorkableJobsDaily , insertYCJobsDaily} from "../services/dailyService.js";
import { runCronJob } from '../services/cronRunner.js';
import { JOBS, getNextRunTime } from '../services/cronScheduler.js';
import { defaultPgDao, runPgStatement } from '../dao/dao.js';
import { requireAdmin } from '../utils/roles.js';

const router = express.Router();

function toIST(date) {
  if (!date) return null;
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, dateStyle: 'medium', timeStyle: 'short' });
}

router.get('/insert_greenhouse', async (req, res) => {
  console.log('Cron job /insert_greenhouse triggered');
  const result = await fetchGreenhouseJobs();
  res.json(result);
});

router.get('/insert_greenhouse_companies', async (req, res) => {
  const result = await insertGreenhouseCompanies();
  res.json(result);
});

router.get('/insert_lever_jobs', async (req, res) => {
  const result = await fetchLeverJobs();
  res.json(result);
});

router.get('/insert_lever_companies', async (req, res) => {
  const result = await insertLeverCompanies();
  res.json(result);
});

router.get('/insert_ashby_companies', async (req, res) => {
  const result = await insertAshbyCompanies();
  res.json(result);
});

router.get('/insert_workable_companies', async (req, res) => {
  const result = await insertWorkableCompanies();
  res.json(result);
});

router.get('/insert_yc_companies', async (req, res) => {
  const result = await insertYCcompanies();
  res.json(result);
});

router.get('/insert_ashby_jobs', async (req, res) => {
  const result = await fetchAshbyJobs();
  res.json(result);
});

router.get('/bf_skills', async (req, res) => {
  const result = await backfillSkillsFromStoredDescriptions();
  res.json(result);
});

/// Daily ///

router.get('/daily_greenhouse', async (req, res) => {
  console.log('Cron job /insert_greenhouse triggered for daily');
  const result = await insertGreenhouseJobsDaily();
  res.json(result);
});

router.get('/daily_workable', async (req, res) => {
  console.log('Cron job for workable triggered for daily');
  const result = await insertWorkableJobsDaily();
  res.json(result);
});

router.get('/daily_yc', async (req, res) => {
  console.log('Cron job for yc triggered for daily');
  try {
    const result = await insertYCJobsDaily();
    res.json(result);
  } catch (err) {
    console.error('daily_yc route error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/// Cron Runner ///
//
// The routes below are reachable through the admin panel's Next.js BFF
// (src/app/api/admin/cron/*), which already checks the caller has an admin
// session before forwarding — but that forward is authenticated only by the
// shared internal secret, which proves "this came from our own server," not
// "this specific user is an admin." requireAdmin re-verifies the latter
// independently, same belt-and-suspenders pattern as routes/admin.js.

// Manually trigger any registered job by tag — ?dry=true for dry run, ?force=true to bypass disabled
router.get('/run/:tag', requireAdmin, async (req, res) => {
  const { tag } = req.params;
  const dryRun = req.query.dry === 'true';
  const force = req.query.force === 'true';
  const job = JOBS.find((j) => j.tag === tag);
  if (!job) return res.status(404).json({ error: `Unknown job tag: ${tag}` });

  const result = await runCronJob({ tag: job.tag, fn: job.fn, dryRun, force });
  res.json(result);
});

// Enable or disable a cron job — /toggle/daily_yc?enabled=false
router.get('/toggle/:tag', requireAdmin, async (req, res) => {
  const { tag } = req.params;
  const job = JOBS.find((j) => j.tag === tag);
  if (!job) return res.status(404).json({ error: `Unknown job tag: ${tag}` });

  const enabled = req.query.enabled !== 'false'; // defaults to true
  await defaultPgDao.getQ({
    sql: `INSERT INTO cron_config (tag, enabled) VALUES ($1, $2)
          ON CONFLICT (tag) DO UPDATE SET enabled = $2`,
    values: [job.tag, enabled],
  });
  res.json({ tag: job.tag, enabled });
});

// View all cron config flags
router.get('/config', requireAdmin, async (req, res) => {
  const rows = await defaultPgDao.getAllRows({ tableName: 'cron_config' });
  res.json(rows);
});

// Status of all jobs — next run time + currently running
router.get('/status', requireAdmin, async (req, res) => {
  const now = new Date();

  // Check which jobs are currently running (status = 'started' and no finished_at)
  const running = await defaultPgDao.getQ({
    sql: `SELECT tag, id as run_id, started_at FROM cron_runs
          WHERE status = 'started' AND finished_at IS NULL
          ORDER BY started_at DESC`,
    values: [],
  });
  const runningByTag = {};
  for (const row of running) {
    runningByTag[row.tag] = { runId: row.run_id, startedAt: row.started_at, runningFor: Math.round((now - new Date(row.started_at)) / 1000) + 's' };
  }

  // Get enabled/disabled flags
  const configRows = await defaultPgDao.getQ({
    sql: `SELECT tag, enabled FROM cron_config`,
    values: [],
  });
  const enabledByTag = {};
  for (const row of configRows) {
    enabledByTag[row.tag] = row.enabled;
  }

  const status = JOBS.map((job) => {
    const nextRun = getNextRunTime(job.schedule, now);
    const nextRunIn = nextRun ? Math.round((nextRun - now) / 60000) : null;
    const enabled = enabledByTag[job.tag] !== undefined ? enabledByTag[job.tag] : true;
    return {
      tag: job.tag,
      schedule: job.schedule,
      enabled,
      running: runningByTag[job.tag] || false,
      nextRunAt: enabled ? (toIST(nextRun) || null) : null,
      nextRunInMinutes: enabled ? nextRunIn : null,
    };
  });

  res.json(status);
});

// View run history
router.get('/runs', requireAdmin, async (req, res) => {
  const tag = req.query.tag;
  const rows = tag
    ? await runPgStatement({
        query: `SELECT * FROM cron_runs WHERE tag = $1 ORDER BY id DESC LIMIT 50`,
        values: [tag],
      })
    : await runPgStatement({
        query: `SELECT * FROM cron_runs ORDER BY id DESC LIMIT 50`,
      });
  res.json(rows);
});

export default router;