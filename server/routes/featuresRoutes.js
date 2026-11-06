import express from 'express';
import { aiLimiter } from '../middleware/rateLimiter.js';
import {
  multiVideoChat,
  generateQuiz,
  generateStudyNotes,
  multilingualChat,
} from '../controllers/featuresController.js';

const router = express.Router();

// Feature 1: Multi-video cross-query
// POST /api/features/multi-video-chat  { videoIds: string[], question: string }
router.post('/multi-video-chat', aiLimiter, multiVideoChat);

// Feature 3: Auto quiz generator
// POST /api/features/quiz  { videoId: string, count?: number }
router.post('/quiz', aiLimiter, generateQuiz);

// Feature 4: Study notes (streamed SSE)
// POST /api/features/study-notes  { videoId: string }
router.post('/study-notes', aiLimiter, generateStudyNotes);

// Feature 5: Multilingual Q&A
// POST /api/features/multilingual-chat  { videoId: string, question: string }
router.post('/multilingual-chat', aiLimiter, multilingualChat);

export default router;

