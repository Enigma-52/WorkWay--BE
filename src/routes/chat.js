import express from 'express';
import rateLimit from 'express-rate-limit';
import { chatStreamHandler } from "../services/chatService.js"

const router = express.Router();

// Each call runs a real OpenAI request — cap per-IP usage to blunt cost abuse.
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages. Please wait a few minutes and try again.' },
});

router.post("/", chatLimiter, chatStreamHandler)

export default router;
