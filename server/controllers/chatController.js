import Video from '../models/Video.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { runRagPipeline } from '../rag/graph.js';
import { getStreamingChain, formatContext } from '../rag/nodes/generator.js';
import { queryAnalyzerNode } from '../rag/nodes/queryAnalyzer.js';
import { retrieverNode } from '../rag/nodes/retriever.js';
import { graderNode } from '../rag/nodes/grader.js';

/**
 * POST /api/chat
 * Runs the full LangGraph RAG pipeline and streams the answer via SSE.
 *
 * Request body: { videoId, question, sessionId? }
 * Response: SSE stream with events: token | sources | done | error
 */
export const chat = async (req, res) => {
  const { videoId, question, sessionId } = req.body;

  if (!videoId || !question) {
    return res.status(400).json({ success: false, error: 'videoId and question are required.' });
  }

  // ─── Verify video is ready ─────────────────────────────────────────
  const video = await Video.findOne({ videoId }).select('-transcriptRaw');
  if (!video) return res.status(404).json({ success: false, error: 'Video not found.' });
  if (video.status !== 'ready') {
    return res.status(400).json({
      success: false,
      error: `Video is not ready yet (status: ${video.status}).`,
    });
  }

  // ─── Get or create session ─────────────────────────────────────────
  let session;
  if (sessionId) {
    session = await Session.findById(sessionId);
  }
  if (!session) {
    session = await Session.create({
      videoId,
      videoTitle: video.title,
      videoUrl: video.url,
    });
  }

  // ─── Load recent chat history (last 6 messages) ────────────────────
  const recentMessages = await Message.find({ sessionId: session._id })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();
  const chatHistory = recentMessages.reverse().map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // ─── Save user message ─────────────────────────────────────────────
  await Message.create({
    sessionId: session._id,
    videoId,
    role: 'user',
    content: question,
  });

  // ─── Set SSE headers ───────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // ─── Run RAG pipeline (non-streaming phases) ─────────────────────
    sendEvent('status', { message: 'Analyzing question...' });
    const analyzerResult = await queryAnalyzerNode({ question, videoId, chatHistory });
    const queryType = analyzerResult.queryType;

    sendEvent('status', { message: 'Searching video transcript...' });
    const retrieverResult = await retrieverNode({ question, videoId, queryType });

    sendEvent('status', { message: 'Grading results...' });
    const graderResult = await graderNode({
      question,
      retrievedChunks: retrieverResult.retrievedChunks,
    });

    let gradedChunks = graderResult.gradedChunks;

    // Fallback: if no chunks passed grading, use all retrieved chunks
    if (gradedChunks.length === 0) {
      gradedChunks = retrieverResult.retrievedChunks.slice(0, 4);
    }

    // ─── Stream LLM answer ────────────────────────────────────────────
    sendEvent('status', { message: 'Generating answer...' });

    const context = formatContext(gradedChunks);
    const historyText = chatHistory
      .map((m) => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const streamingChain = getStreamingChain();
    const stream = await streamingChain.stream({
      question,
      context,
      chatHistory: historyText || 'No prior conversation.',
    });

    let fullAnswer = '';
    for await (const chunk of stream) {
      fullAnswer += chunk;
      sendEvent('token', { token: chunk });
    }

    // ─── Send sources (Feature 2: Clip Finder — include deep-link URLs) ──
    const sources = gradedChunks.map((c) => ({
      text: c.text.substring(0, 200) + (c.text.length > 200 ? '...' : ''),
      timestamp: c.timestamp,
      startTime: c.startTime,
      score: c.score,
      clipUrl: `https://youtu.be/${videoId}?t=${c.startTime}`,
    }));
    sendEvent('sources', { sources });

    // ─── Save assistant message ────────────────────────────────────────
    await Message.create({
      sessionId: session._id,
      videoId,
      role: 'assistant',
      content: fullAnswer,
      sources,
      queryType,
    });

    // ─── Update session ────────────────────────────────────────────────
    await Session.findByIdAndUpdate(session._id, {
      $inc: { messageCount: 2 },
      lastActive: new Date(),
    });

    sendEvent('done', { sessionId: session._id.toString() });
    res.end();
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    sendEvent('error', { message: err.message || 'An error occurred.' });
    res.end();
  }
};
