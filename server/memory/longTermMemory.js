import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import VideoMemory from '../models/VideoMemory.js';
import Message from '../models/Message.js';
import { GROQ_MODEL } from '../config/llm.js';

const summarizePrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a memory assistant. Given a list of Q&A pairs from a user's conversation about a YouTube video, produce:
1. A concise paragraph summary (3-5 sentences) of what topics the user explored and what they learned.
2. A list of up to 8 key facts that were established in the conversation.

Respond ONLY with valid JSON in this format:
{
  "summary": "...",
  "keyFacts": ["fact1", "fact2", ...]
}`,
  ],
  ['human', 'Video: {videoTitle}\n\nConversation Q&A:\n{qa}'],
]);

/**
 * Reads long-term memory for a video.
 * Returns { summary, keyFacts, totalQuestions } or null if no memory exists.
 */
export const readLongTermMemory = async (videoId) => {
  const mem = await VideoMemory.findOne({ videoId }).lean();
  if (!mem || !mem.summary) return null;
  return { summary: mem.summary, keyFacts: mem.keyFacts, totalQuestions: mem.totalQuestions };
};

/**
 * Updates long-term memory after a session ends.
 * Summarizes the session's messages and merges into the existing memory.
 *
 * @param {string} videoId
 * @param {string} videoTitle
 * @param {string} sessionId - MongoDB ObjectId string
 */
export const updateLongTermMemory = async (videoId, videoTitle, sessionId) => {
  try {
    // Load all messages from this session
    const messages = await Message.find({ sessionId, role: { $in: ['user', 'assistant'] } })
      .sort({ createdAt: 1 })
      .lean();

    if (messages.length < 2) return; // Not enough to summarize

    // Build Q&A pairs
    const qa = [];
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
        qa.push(`Q: ${messages[i].content}\nA: ${messages[i + 1].content.substring(0, 300)}`);
        i++; // skip the assistant message we just used
      }
    }

    if (qa.length === 0) return;

    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: GROQ_MODEL,
      temperature: 0,
      maxTokens: 512,
    });

    const chain = summarizePrompt.pipe(llm).pipe(new StringOutputParser());
    const raw = await chain.invoke({ videoTitle: videoTitle || videoId, qa: qa.join('\n\n---\n\n') });

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If JSON parse fails, store raw as summary
      parsed = { summary: raw.substring(0, 500), keyFacts: [] };
    }

    // Merge new keyFacts with existing, deduplicate, cap at 20
    const existing = await VideoMemory.findOne({ videoId }).lean();
    const mergedFacts = [...new Set([...(existing?.keyFacts || []), ...(parsed.keyFacts || [])])].slice(0, 20);

    await VideoMemory.findOneAndUpdate(
      { videoId },
      {
        $set: {
          videoTitle: videoTitle || videoId,
          summary: parsed.summary || existing?.summary || '',
          keyFacts: mergedFacts,
          lastUpdated: new Date(),
        },
        $inc: { totalQuestions: qa.length },
      },
      { upsert: true, new: true }
    );

    console.log(`[LongTermMemory] ✅ Updated memory for video ${videoId} (+${qa.length} Q&A pairs)`);
  } catch (err) {
    // Non-fatal — memory update failure should not break the chat flow
    console.warn(`[LongTermMemory] ⚠️ Failed to update memory for ${videoId}:`, err.message);
  }
};
