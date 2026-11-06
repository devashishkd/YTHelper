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
 * Filters retrieved chunks — keeps only those relevant to the question.
 * Uses Zod schema + withStructuredOutput to enforce { relevant: 'yes' | 'no' }.
 * If < 2 chunks pass, routes to query rewriter.
 */
export const graderNode = async (state) => {
  const { question, retrievedChunks } = state;
  const llm = getLLM().withStructuredOutput(RelevanceSchema);

  const gradedChunks = [];

  for (const chunk of retrievedChunks) {
    try {
      const result = await graderPrompt.pipe(llm).invoke({ question, document: chunk.text });
      if (result.relevant === 'yes') {
        gradedChunks.push(chunk);
      }
    } catch (err) {
      // On error, include the chunk to be safe (fail open)
      gradedChunks.push(chunk);
    }
  }

  console.log(`[Grader] ${gradedChunks.length}/${retrievedChunks.length} chunks passed relevance check`);
  return { gradedChunks };
};
