import express from 'express';
import {
  getCompanyDetails,
  getCompanyOverview,
  getAllCompanies,
  generateCompanyEmbeddings,
} from '../services/companyService.js';

const router = express.Router();

router.get('/details', async (req, res) => {
  const slug = req.query.slug;
  const companyDetails = await getCompanyDetails(slug);
  res.json(companyDetails);
});

router.get('/', async (req, res) => {
  try {
    const { q = '', page = '1', limit = '20', letter = 'ALL', hiring = 'false' } = req.query;

    const params = {
      q,
      page: Number(page),
      limit: Number(limit),
      letter,
      hiring: hiring === 'true',
    };

    const result = await getAllCompanies(params);

    res.json(result);
  } catch (err) {
    console.error('GET /api/company failed:', err); // <-- IMPORTANT
    res.status(500).json({
      error: 'Internal server error',
      detail: err.message,
    });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const result = await getAllCompanies({ q, page: 1, limit: 10, letter: 'ALL', hiring: false });
    res.json(result.companies);
  } catch (err) {
    console.error('GET /api/company/search failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const data = await getCompanyOverview();
    res.json(data);
  } catch (err) {
    console.error('GET /api/company/overview failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/generate-embeddings', async (req, res) => {
  try {
    const result = await generateCompanyEmbeddings();
    res.json(result);
  } catch (err) {
    console.error('POST /api/company/generate-embeddings failed:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

export default router;
