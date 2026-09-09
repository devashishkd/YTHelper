import express from 'express';
import { chat } from '../controllers/chatController.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/', aiLimiter, chat);

export default router;
