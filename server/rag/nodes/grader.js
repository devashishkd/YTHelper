import { ChatGroq } from '@langchain/groq';
import { z } from 'zod';
import { graderPrompt } from '../prompts/index.js';
import { GROQ_MODEL } from '../../config/llm.js';

const RelevanceSchema = z.object({
  relevant: z.enum(['yes', 'no']),
});

const getLLM = () =>
  new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: GROQ_MODEL,
    temperature: 0,
    maxTokens: 50,
  });

/**
 * LangGraph Node: Relevance Grader
 * Filters retrieved chunks in parallel using Promise.allSettled — keeps only those relevant to the question.
 * Uses Zod schema + withStructuredOutput to enforce { relevant: 'yes' | 'no' }.
 * If < 2 chunks pass, routes to query rewriter.
 */
export const graderNode = async (state) => {
  const { question, retrievedChunks = [] } = state;

  if (!retrievedChunks || retrievedChunks.length === 0) {
    return { gradedChunks: [] };
  }

  const llm = getLLM().withStructuredOutput(RelevanceSchema);

  // Evaluate all chunks concurrently
  const gradingPromises = retrievedChunks.map(async (chunk, index) => {
    try {
      const result = await graderPrompt.pipe(llm).invoke({ question, document: chunk.text });
      return {
        chunk,
        relevant: result.relevant === 'yes',
      };
    } catch (err) {
      // Fail-open: on API/rate-limit error, include the chunk to avoid dropping context
      console.warn(`[Grader] Relevance check failed for chunk #${index}: ${err.message}. Failing open.`);
      return {
        chunk,
        relevant: true,
      };
    }
  });

  const settledResults = await Promise.allSettled(gradingPromises);

  const gradedChunks = [];
  for (const result of settledResults) {
    if (result.status === 'fulfilled') {
      if (result.value.relevant) {
        gradedChunks.push(result.value.chunk);
      }
    } else {
      // Unhandled promise rejection fallback (fail-open)
      console.warn('[Grader] Unexpected promise rejection, failing open:', result.reason);
    }
  }

  console.log(`[Grader] ${gradedChunks.length}/${retrievedChunks.length} chunks passed relevance check (parallel)`);
  return { gradedChunks };
};
