import express from 'express';
import { fetchGreenhouseJobs, insertGreenhouseCompanies , insertYCcompanies ,  insertLeverCompanies , fetchLeverJobs , insertAshbyCompanies , fetchAshbyJobs , insertWorkableCompanies} from '../services/cronService.js';
import { backfillSkillsFromStoredDescriptions } from '../services/backfillService.js'
import { insertGreenhouseJobsDaily , insertWorkableJobsDaily , insertYCJobsDaily} from "../services/dailyService.js";
import { runCronJob } from '../services/cronRunner.js';
import { JOBS } from '../services/cronScheduler.js';
import { defaultPgDao } from '../dao/dao.js';

const router = express.Router();

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

// Manually trigger any registered job by tag — ?dry=true for dry run, ?force=true to bypass disabled
router.get('/run/:tag', async (req, res) => {
  const { tag } = req.params;
  const dryRun = req.query.dry === 'true';
  const force = req.query.force === 'true';
  const job = JOBS.find((j) => j.tag === tag);
  if (!job) return res.status(404).json({ error: `Unknown job tag: ${tag}` });

  const result = await runCronJob({ tag: job.tag, fn: job.fn, dryRun, force });
  res.json(result);
});

// Enable or disable a cron job — /toggle/daily_yc?enabled=false
router.get('/toggle/:tag', async (req, res) => {
  const { tag } = req.params;
  const enabled = req.query.enabled !== 'false'; // defaults to true
  await defaultPgDao.getQ({
    sql: `INSERT INTO cron_config (tag, enabled) VALUES ($1, $2)
          ON CONFLICT (tag) DO UPDATE SET enabled = $2`,
    values: [tag, enabled],
  });
  res.json({ tag, enabled });
});

// View all cron config flags
router.get('/config', async (req, res) => {
  const rows = await defaultPgDao.getAllRows({ tableName: 'cron_config' });
  res.json(rows);
});

// View run history
router.get('/runs', async (req, res) => {
  const tag = req.query.tag;
  const where = tag ? `tag = '${tag}'` : undefined;
  const rows = await defaultPgDao.getAllRows({
    tableName: 'cron_runs',
    where,
    orderBy: 'id DESC',
    limit: 50,
  });
  res.json(rows);
});

export default router;