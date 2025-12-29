import express from 'express';
import { fetchGreenhouseJobs, insertGreenhouseCompanies } from '../services/cronService.js';

const router = express.Router();

router.get('/insert_greenhouse', async (req, res) => {
  const result = await fetchGreenhouseJobs();
  res.json(result);
});

router.get('/insert_greenhouse_companies', async (req, res) => {
  const result = await insertGreenhouseCompanies();
  res.json(result);
});

export default router;
