import express from 'express';
import { fetchGreenhouseJobs, insertGreenhouseCompanies } from '../services/cronService.js';
import { backfillSkillsFromStoredDescriptions } from '../services/backfillService.js'

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

router.get('/bf_skills', async (req, res) => {
  const result = await backfillSkillsFromStoredDescriptions();
  res.json(result);
});

export default router;
