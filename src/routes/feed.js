import express from 'express';
import { getHomeJobFeed } from '../services/feedService.js';

const router = express.Router();

router.get('/home', async (req, res) => {
  const options = req.query.options;
  const fetchHomeJobFeed = await getHomeJobFeed(options);
  res.json(fetchHomeJobFeed);
});

export default router;
