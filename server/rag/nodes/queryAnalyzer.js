import { ChatGroq } from '@langchain/groq';
import { z } from 'zod';
import { queryAnalyzerPrompt } from '../prompts/index.js';

const QueryTypeSchema = z.object({
  queryType: z.enum(['factual', 'timestamp', 'topic', 'summary', 'general']),
});

const getLLM = () =>
  new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    temperature: 0,
    maxTokens: 100,
  });

/**
 * LangGraph Node: Query Analyzer
 * Classifies the user's question type: factual | timestamp | topic | summary | general
 * Uses Zod schema + withStructuredOutput to enforce valid enum values.
 */
export const queryAnalyzerNode = async (state) => {
  const { question } = state;

  try {
    const llm = getLLM().withStructuredOutput(QueryTypeSchema);
    const result = await queryAnalyzerPrompt.pipe(llm).invoke({ question });
    const queryType = result.queryType;
    console.log(`[QueryAnalyzer] Type: ${queryType} | Q: "${question}"`);
    return { queryType };
  } catch (err) {
    console.warn('[QueryAnalyzer] Failed to classify, defaulting to general:', err.message);
    return { queryType: 'general' };
  }
};
