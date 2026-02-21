import express from 'express';
import { generateCompanyDesc , generateEmbeddings , searchJobsByQuery} from '../services/aiService.js';
const router = express.Router();

router.get('/company_desc', async (req, res) => {
  const companyDesc = await generateCompanyDesc();
  res.json(companyDesc);
});

router.get('/generate_embeddings', async (req, res) => {
  const type = req.query.type;
  const embeddings = await generateEmbeddings(type);
  res.json(embeddings);
});

router.get('/query_jobs', async (req, res) => {
  const queryText = req.query.queryText;
  const jobs = await searchJobsByQuery(queryText);
  res.json(jobs);
});

export default router;
