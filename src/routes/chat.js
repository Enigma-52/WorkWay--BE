import express from 'express';
import { chatStreamHandler } from "../services/chatService.js"

const router = express.Router();

router.post("/", chatStreamHandler)

export default router;
