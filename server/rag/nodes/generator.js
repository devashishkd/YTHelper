import { ChatGroq } from '@langchain/groq';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { generatorPrompt } from '../prompts/index.js';

/**
 * Returns a streaming Groq LLM instance for answer generation.
 */
export const getGeneratorLLM = () =>
  new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 1024,
    streaming: true,
  });

/**
 * Formats chunks into a readable context string for the prompt.
 * Includes clip URL for Feature 2 (Clip Finder).
 */
const formatContext = (chunks) =>
  chunks
    .map(
      (c, i) =>
        `[Source ${i + 1} | Timestamp: ${c.timestamp}${c.clipUrl ? ` | Clip: ${c.clipUrl}` : ''}]\n${c.text}`
    )
    .join('\n\n---\n\n');

/**
 * LangGraph Node: Generator
 * Generates an answer from graded chunks using Groq LLM.
 * Stores the full answer in state for hallucination checking.
 * Streaming is handled separately in the controller.
 */
export const generatorNode = async (state) => {
  const { question, gradedChunks, chatHistory = [] } = state;

  const context = formatContext(gradedChunks);
  const historyText = chatHistory
    .map((m) => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const llm = getGeneratorLLM();
  const chain = generatorPrompt.pipe(llm).pipe(new StringOutputParser());

  const answer = await chain.invoke({
    question,
    context,
    chatHistory: historyText || 'No prior conversation.',
  });

  console.log(`[Generator] Answer generated (${answer.length} chars)`);
  return { answer, context };
};

/**
 * Returns a streaming chain for SSE — used directly in the controller.
 */
export const getStreamingChain = () => {
  const llm = getGeneratorLLM();
  return generatorPrompt.pipe(llm).pipe(new StringOutputParser());
};

export { formatContext };
