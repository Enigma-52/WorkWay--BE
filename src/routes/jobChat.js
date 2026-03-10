import express from 'express';
import { sendJobChatMessage } from '../services/jobChatService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const payload = await sendJobChatMessage({
      req,
      jobSlug: body.job_slug || body.jobSlug,
      userMessage: body.message,
      sessionId: body.session_id || body.sessionId,
    });
    return res.status(200).json(payload);
  } catch (err) {
    console.error('POST /api/job-chat error:', err);
    const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
    return res.status(status).json({
      error: status >= 500 ? 'Internal server error' : 'Validation error',
      message: err?.message || 'Failed to process job chat message',
    });
  }
});

export default router;
