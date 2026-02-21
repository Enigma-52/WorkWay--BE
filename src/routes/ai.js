import express from 'express';
import { generateCompanyDesc } from '../services/aiService.js';
const router = express.Router();

router.get('/company_desc', async (req, res) => {
  const companyDesc = await generateCompanyDesc();
  res.json(companyDesc);
});

export default router;
