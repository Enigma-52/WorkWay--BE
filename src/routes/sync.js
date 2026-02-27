import express from 'express';

const router = express.Router();


router.get('/sync_skill_groups', async (req, res) => {
  res.json({success:"true"})
});
export default router;
