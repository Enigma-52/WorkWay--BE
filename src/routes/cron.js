import express from 'express';

const router = express.Router();

router.get('/hehe', async (req, res) => {
  res.json({ message: 'cron route is working' });
});
export default router;
