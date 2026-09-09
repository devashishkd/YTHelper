import express from 'express';
import Session from '../models/Session.js';
import Message from '../models/Message.js';

const router = express.Router();

// GET /api/sessions/:videoId — get all sessions for a video
router.get('/:videoId', async (req, res) => {
  const sessions = await Session.find({ videoId: req.params.videoId }).sort({ lastActive: -1 });
  res.json({ success: true, sessions });
});

// GET /api/sessions/:sessionId/messages — get messages for a session
router.get('/:sessionId/messages', async (req, res) => {
  const messages = await Message.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
  res.json({ success: true, messages });
});

// DELETE /api/sessions/:sessionId — delete session + messages
router.delete('/:sessionId', async (req, res) => {
  await Message.deleteMany({ sessionId: req.params.sessionId });
  await Session.findByIdAndDelete(req.params.sessionId);
  res.json({ success: true, message: 'Session cleared.' });
});

export default router;
