import express from 'express';
import { getJobDetails } from '../services/jobService.js';

const router = express.Router();

router.get('/details', async (req, res) => {
  const slug = req.query.slug;
  const jobDetails = await getJobDetails(slug);
  res.json(jobDetails);
});

export default router;
