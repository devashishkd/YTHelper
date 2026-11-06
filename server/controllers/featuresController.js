import { ChatGroq } from '@langchain/groq';
import { StringOutputParser, JsonOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import Video from '../models/Video.js';
import {
  quizPrompt,
  studyNotesPrompt,
  translateAnswerPrompt,
  multiVideoGeneratorPrompt,
  languageDetectPrompt,
} from '../rag/prompts/featuresPrompts.js';
import { retrieveChunks } from '../services/vectorStoreService.js';
import { formatContext } from '../rag/nodes/generator.js';
import { queryAnalyzerNode } from '../rag/nodes/queryAnalyzer.js';
import { graderNode } from '../rag/nodes/grader.js';

// ─── Shared LLM factory ───────────────────────────────────────────────
const getLLM = (temperature = 0.3, maxTokens = 2048) =>
  new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    temperature,
    maxTokens,
  });

// ─── Language Detection Schema ────────────────────────────────────────
const LangSchema = z.object({
  language: z.string(),
  code: z.string(),
});

// ─── Feature 5 helper: detect question language ───────────────────────
const detectLanguage = async (text) => {
  try {
    const llm = getLLM(0, 50).withStructuredOutput(LangSchema);
    const result = await languageDetectPrompt.pipe(llm).invoke({ text });
    return result; // { language: 'Hindi', code: 'hi' }
  } catch {
    return { language: 'English', code: 'en' };
  }
};

// ─── Feature 5 helper: translate text to a target language ───────────
const translateTo = async (text, targetLanguage) => {
  try {
    const chain = translateAnswerPrompt
      .pipe(getLLM(0.1, 2048))
      .pipe(new StringOutputParser());
    return await chain.invoke({ text, targetLanguage });
  } catch {
    return text; // Fallback: return original if translation fails
  }
};

/**
 * ─── Feature 1: Multi-video Cross-query ───────────────────────────────
 * POST /api/features/multi-video-chat
 * Body: { videoIds: string[], question: string }
 *
 * Retrieves and grades chunks from EACH video's ChromaDB collection,
 * then synthesises a single answer that attributes info per video.
 */
export const multiVideoChat = async (req, res) => {
  const { videoIds, question } = req.body;

  if (!videoIds || !Array.isArray(videoIds) || videoIds.length < 2) {
    return res.status(400).json({ success: false, error: 'Provide at least 2 videoIds.' });
  }
  if (!question) {
    return res.status(400).json({ success: false, error: 'question is required.' });
  }

  // Verify all videos are ready
  const videos = await Video.find({ videoId: { $in: videoIds }, status: 'ready' }).select('videoId title url');
  if (videos.length !== videoIds.length) {
    const foundIds = videos.map((v) => v.videoId);
    const missing = videoIds.filter((id) => !foundIds.includes(id));
    return res.status(400).json({ success: false, error: `Videos not ready or not found: ${missing.join(', ')}` });
  }

  try {
    // Classify question type once (shared across all videos)
    const { queryType } = await queryAnalyzerNode({ question });

    const kMap = { summary: 8, topic: 6, timestamp: 5, factual: 4, general: 5 };
    const k = kMap[queryType] || 5;

    // Retrieve + grade chunks from each video in parallel
    const perVideoChunks = await Promise.all(
      videos.map(async (video, idx) => {
        const chunks = await retrieveChunks(video.videoId, question, k);
        const { gradedChunks } = await graderNode({ question, retrievedChunks: chunks });
        const finalChunks = gradedChunks.length > 0 ? gradedChunks : chunks.slice(0, 2);

        // Add clip URLs and video label metadata
        return finalChunks.map((c) => ({
          ...c,
          videoLabel: `Video ${idx + 1}: ${video.title || video.videoId}`,
          videoId: video.videoId,
          clipUrl: `https://youtu.be/${video.videoId}?t=${c.startTime}`,
        }));
      })
    );

    // Build labelled context for the prompt
    const context = perVideoChunks
      .map((chunks) => {
        if (chunks.length === 0) return null;
        const label = chunks[0].videoLabel;
        return `### ${label}\n` +
          chunks
            .map((c, i) => `[Chunk ${i + 1} | ${c.timestamp} | ${c.clipUrl}]\n${c.text}`)
            .join('\n\n');
      })
      .filter(Boolean)
      .join('\n\n---\n\n');

    // Generate answer
    const chain = multiVideoGeneratorPrompt
      .pipe(getLLM(0.3, 1500))
      .pipe(new StringOutputParser());

    const answer = await chain.invoke({ question, context });

    // Build sources
    const sources = perVideoChunks.flat().map((c) => ({
      videoLabel: c.videoLabel,
      videoId: c.videoId,
      timestamp: c.timestamp,
      startTime: c.startTime,
      clipUrl: c.clipUrl,
      text: c.text.substring(0, 200) + (c.text.length > 200 ? '...' : ''),
      score: c.score,
    }));

    return res.json({ success: true, answer, sources, queryType });
  } catch (err) {
    console.error('[MultiVideoChat] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * ─── Feature 3: Auto Quiz Generator ──────────────────────────────────
 * POST /api/features/quiz
 * Body: { videoId: string, count?: number (default 5) }
 *
 * Fetches broad chunks from the video and generates MCQ quiz questions.
 */
export const generateQuiz = async (req, res) => {
  const { videoId, count = 5 } = req.body;

  if (!videoId) return res.status(400).json({ success: false, error: 'videoId is required.' });
  if (count < 1 || count > 15) {
    return res.status(400).json({ success: false, error: 'count must be between 1 and 15.' });
  }

  const video = await Video.findOne({ videoId, status: 'ready' });
  if (!video) return res.status(404).json({ success: false, error: 'Video not ready or not found.' });

  try {
    // Fetch broad chunks for quiz coverage (larger k for variety)
    const chunks = await retrieveChunks(videoId, 'key concepts main points topics covered', Math.min(count * 2, 20));
    const context = formatContext(chunks);

    const chain = quizPrompt
      .pipe(getLLM(0.5, 2048))
      .pipe(new JsonOutputParser());

    const quiz = await chain.invoke({ context, count });

    return res.json({ success: true, quiz, videoId, videoTitle: video.title || videoId });
  } catch (err) {
    console.error('[Quiz] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * ─── Feature 4: Structured Study Notes ───────────────────────────────
 * POST /api/features/study-notes
 * Body: { videoId: string }
 *
 * Fetches comprehensive chunks and generates structured markdown notes.
 */
export const generateStudyNotes = async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) return res.status(400).json({ success: false, error: 'videoId is required.' });

  const video = await Video.findOne({ videoId, status: 'ready' });
  if (!video) return res.status(404).json({ success: false, error: 'Video not ready or not found.' });

  try {
    // Fetch broad coverage chunks — summary-level retrieval
    const chunks = await retrieveChunks(videoId, 'overview summary main topics key points', 15);
    const context = formatContext(chunks);

    // Set SSE headers for streaming notes
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const llm = getLLM(0.4, 2048);
    llm.streaming = true;
    const streamingChain = studyNotesPrompt.pipe(llm).pipe(new StringOutputParser());
    const stream = await streamingChain.stream({ context });

    let fullNotes = '';
    for await (const chunk of stream) {
      fullNotes += chunk;
      sendEvent('token', { token: chunk });
    }

    sendEvent('done', {
      videoId,
      videoTitle: video.title || videoId,
      charCount: fullNotes.length,
    });
    res.end();
  } catch (err) {
    console.error('[StudyNotes] Error:', err.message);
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
  }
};

/**
 * ─── Feature 5: Multilingual Q&A ─────────────────────────────────────
 * POST /api/features/multilingual-chat
 * Body: { videoId: string, question: string, sessionId?: string }
 *
 * Detects the question's language, runs the RAG pipeline in English,
 * then translates the answer back to the user's language.
 */
export const multilingualChat = async (req, res) => {
  const { videoId, question } = req.body;

  if (!videoId || !question) {
    return res.status(400).json({ success: false, error: 'videoId and question are required.' });
  }

  const video = await Video.findOne({ videoId, status: 'ready' });
  if (!video) return res.status(404).json({ success: false, error: 'Video not ready or not found.' });

  try {
    // Step 1: Detect question language
    const { language, code } = await detectLanguage(question);
    const isEnglish = code === 'en';

    // Step 2: Run standard RAG pipeline (always in English internally)
    const { queryType } = await queryAnalyzerNode({ question });
    const kMap = { summary: 10, topic: 8, timestamp: 6, factual: 5, general: 6 };
    const k = kMap[queryType] || 6;

    const chunks = await retrieveChunks(videoId, question, k);
    const { gradedChunks } = await graderNode({ question, retrievedChunks: chunks });
    const finalChunks = gradedChunks.length > 0 ? gradedChunks : chunks.slice(0, 4);

    const context = formatContext(finalChunks);

    const { generatorPrompt } = await import('../rag/prompts/index.js');
    const chain = generatorPrompt
      .pipe(getLLM(0.3, 1024))
      .pipe(new StringOutputParser());

    const englishAnswer = await chain.invoke({
      question,
      context,
      chatHistory: 'No prior conversation.',
    });

    // Step 3: Translate answer back if not English
    const finalAnswer = isEnglish
      ? englishAnswer
      : await translateTo(englishAnswer, language);

    // Build sources with clip URLs
    const sources = finalChunks.map((c) => ({
      timestamp: c.timestamp,
      startTime: c.startTime,
      clipUrl: `https://youtu.be/${videoId}?t=${c.startTime}`,
      text: c.text.substring(0, 200) + (c.text.length > 200 ? '...' : ''),
      score: c.score,
    }));

    return res.json({
      success: true,
      answer: finalAnswer,
      detectedLanguage: language,
      languageCode: code,
      translatedFromEnglish: !isEnglish,
      sources,
      queryType,
    });
  } catch (err) {
    console.error('[MultilingualChat] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

