import { ChatGroq } from '@langchain/groq';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { queryAnalyzerPrompt } from '../prompts/index.js';

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
 */
export const queryAnalyzerNode = async (state) => {
  const { question } = state;

  try {
    const chain = queryAnalyzerPrompt.pipe(getLLM()).pipe(new JsonOutputParser());
    const result = await chain.invoke({ question });
    const queryType = result?.queryType || 'general';
    console.log(`[QueryAnalyzer] Type: ${queryType} | Q: "${question}"`);
    return { queryType };
  } catch (err) {
    console.warn('[QueryAnalyzer] Failed to classify, defaulting to general:', err.message);
    return { queryType: 'general' };
  }
};
