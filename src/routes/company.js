import express from 'express';
import { getCompanyDetails } from '../services/companyService.js';

const router = express.Router();

router.get('/details', async (req, res) => {
  const slug = req.query.slug;
  const companyDetails = await getCompanyDetails(slug);
  res.json(companyDetails);
});
export default router;
