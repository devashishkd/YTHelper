import Video from '../models/Video.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { getStreamingChain, formatContext } from '../rag/nodes/generator.js';
import { queryAnalyzerNode } from '../rag/nodes/queryAnalyzer.js';
import { retrieverNode } from '../rag/nodes/retriever.js';
import { graderNode } from '../rag/nodes/grader.js';
import { hallucinationCheckerNode } from '../rag/nodes/hallucinationChecker.js';
import { getClipUrl } from '../services/transcriptService.js';
import { readLongTermMemory, updateLongTermMemory } from '../memory/longTermMemory.js';

/**
 * POST /api/chat
 * Runs the full RAG pipeline and streams the answer via SSE.
 * Short-term memory  → LangGraph MemorySaver (thread_id = session._id)
 * Long-term memory   → VideoMemory MongoDB document (injected as priming context)
 *
 * Request body: { videoId, question, sessionId? }
 * Response: SSE stream with events: status | token | sources | verification | done | error
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
  const isNewSession = !sessionId;
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

  const threadId = session._id.toString(); // LangGraph MemorySaver thread key

  // ─── Load recent chat history from MongoDB (seed for first turn) ───
  // MemorySaver handles subsequent turns natively via thread_id.
  // We still load from MongoDB so history survives server restarts.
  const recentMessages = await Message.find({ sessionId: session._id })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();
  const chatHistory = recentMessages.reverse().map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // ─── Long-term memory: read prior video memory ─────────────────────
  // Only inject on first turn of a new session to avoid stale priming mid-session.
  let longTermContext = '';
  if (isNewSession) {
    const ltm = await readLongTermMemory(videoId);
    if (ltm) {
      const factsText = ltm.keyFacts.length > 0
        ? `\nKey facts from prior sessions:\n${ltm.keyFacts.map((f) => `• ${f}`).join('\n')}`
        : '';
      longTermContext = `${ltm.summary}${factsText}`;
      console.log(`[LongTermMemory] Injecting memory for video ${videoId} (${ltm.totalQuestions} prior questions)`);
    }
  }

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
    // ─── Run pipeline nodes (non-streaming phases) ────────────────────
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

    // Fallback: if no chunks passed grading, use top retrieved chunks
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
      longTermContext: longTermContext || 'No prior memory for this video.',
    });

    let fullAnswer = '';
    for await (const chunk of stream) {
      fullAnswer += chunk;
      sendEvent('token', { token: chunk });
    }

    // ─── Hallucination check ──────────────────────────────────────────
    sendEvent('status', { message: 'Verifying answer against transcript...' });
    const checkResult = await hallucinationCheckerNode({ answer: fullAnswer, context });

    sendEvent('verification', {
      isGrounded: checkResult.isGrounded,
      verificationStatus: checkResult.verificationStatus,
      warning: checkResult.warning,
    });

    // ─── Sources ──────────────────────────────────────────────────────
    const sources = gradedChunks.map((c) => ({
      text: c.text.substring(0, 200) + (c.text.length > 200 ? '...' : ''),
      timestamp: c.timestamp,
      startTime: c.startTime,
      score: c.score,
      clipUrl: getClipUrl(videoId, c.startTime, 2),
    }));
    sendEvent('sources', { sources });

    // ─── Save assistant message to MongoDB ────────────────────────────
    await Message.create({
      sessionId: session._id,
      videoId,
      role: 'assistant',
      content: fullAnswer,
      sources,
      queryType,
      isGrounded: checkResult.isGrounded,
      verificationStatus: checkResult.verificationStatus,
      warning: checkResult.warning,
    });

    // ─── Update session ────────────────────────────────────────────────
    await Session.findByIdAndUpdate(session._id, {
      $inc: { messageCount: 2 },
      lastActive: new Date(),
    });

    sendEvent('done', {
      sessionId: threadId,
      memoryInjected: !!longTermContext,
    });
    res.end();

    // ─── Update long-term memory async (non-blocking) ─────────────────
    // Fire-and-forget: runs after response is sent so it doesn't delay the user
    updateLongTermMemory(videoId, video.title, session._id.toString()).catch((err) =>
      console.warn('[LongTermMemory] Background update failed:', err.message)
    );

  } catch (err) {
    console.error('[Chat] Error:', err.message);
    sendEvent('error', { message: err.message || 'An error occurred.' });
    res.end();
  }
};
