import { ChatGroq } from '@langchain/groq';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { rewriterPrompt } from '../prompts/index.js';
import { GROQ_MODEL } from '../../config/llm.js';

const getLLM = () =>
  new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: GROQ_MODEL,
    temperature: 0.5,
    maxTokens: 150,
  });

/**
 * LangGraph Node: Query Rewriter
 * Reformulates the failed query and increments retry counter.
 * Clears previous results for a fresh retrieval pass.
 */
export const queryRewriterNode = async (state) => {
  const { question, queryType, retries = 0 } = state;

  try {
    const chain = rewriterPrompt.pipe(getLLM()).pipe(new StringOutputParser());
    const rewrittenQuestion = await chain.invoke({ question, queryType });
    console.log(`[QueryRewriter] Retry ${retries + 1} | Original: "${question}" → "${rewrittenQuestion}"`);
    return {
      question: rewrittenQuestion.trim(),
      retries: retries + 1,
      retrievedChunks: [],
      gradedChunks: [],
      answer: '',
      isGrounded: false,
    };
  } catch (err) {
    console.warn('[QueryRewriter] Rewrite failed, using original:', err.message);
    return { retries: retries + 1 };
  }
};
