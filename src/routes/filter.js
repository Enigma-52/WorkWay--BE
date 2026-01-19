import express from 'express';
import { getDomainJobDetails, getAllDomainJobs } from '../services/filterService.js';

const router = express.Router();

router.get('/domain', async (req, res) => {
  const {
    slug,
    page = 1,
    employment_type = 'all',
    employment_level = 'all',
    location = 'all',
  } = req.query;
  const domainJobs = await getDomainJobDetails(
    slug,
    page,
    employment_type,
    employment_level,
    location
  );
  res.json(domainJobs);
});

router.get('/domain/all', async (req, res) => {
  const allDomainJobs = await getAllDomainJobs();
  res.json(allDomainJobs);
});
export default router;
