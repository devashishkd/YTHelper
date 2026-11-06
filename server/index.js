import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { limiter } from './middleware/rateLimiter.js';
import videoRoutes from './routes/videoRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import featuresRoutes from './routes/featuresRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Connect Database ─────────────────────────────────────────────────
await connectDB();

// ─── Middleware ───────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(limiter);

// ─── Routes ───────────────────────────────────────────────────────────
app.use('/api/videos', videoRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/features', featuresRoutes);

// ─── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 YTHelper server running on http://localhost:${PORT}`);
  console.log(`📊 LangSmith tracing: ${process.env.LANGSMITH_TRACING === 'true' ? '✅ enabled' : '❌ disabled'}`);
  console.log(`🤖 LLM: Groq (${process.env.GROQ_API_KEY ? 'key set' : '⚠️  KEY MISSING'})`);
  console.log(`🔢 Embeddings: Nomic (${process.env.NOMIC_API_KEY ? 'key set' : '⚠️  KEY MISSING'})\n`);
});

export default app;
