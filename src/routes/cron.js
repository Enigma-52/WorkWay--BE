import express from 'express';
import { fetchGreenhouseJobs, insertGreenhouseCompanies , insertYCcompanies ,  insertLeverCompanies , fetchLeverJobs , insertAshbyCompanies , fetchAshbyJobs , insertWorkableCompanies} from '../services/cronService.js';
import { backfillSkillsFromStoredDescriptions } from '../services/backfillService.js'
import { insertGreenhouseJobsDaily , insertWorkableJobsDaily , insertYCJobsDaily} from "../services/dailyService.js";

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
  const result = await insertYCJobsDaily();
  res.json(result);
});

export default router;