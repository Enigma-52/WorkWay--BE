import express from 'express';
import { syncSkills } from '../services/syncService.js'
const router = express.Router();

router.get('/sync_skills', async (req, res) => {
  const result = await syncSkills();
  res.json(result)
});

export default router;
