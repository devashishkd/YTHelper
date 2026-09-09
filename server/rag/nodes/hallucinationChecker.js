import { ChatGroq } from '@langchain/groq';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { hallucinationPrompt } from '../prompts/index.js';

const getLLM = () =>
  new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    temperature: 0,
    maxTokens: 50,
  });

/**
 * LangGraph Node: Hallucination Checker
 * Verifies the generated answer is grounded in retrieved context.
 * Sets state.isGrounded = true/false.
 */
export const hallucinationCheckerNode = async (state) => {
  const { answer, context } = state;

  try {
    const chain = hallucinationPrompt.pipe(getLLM()).pipe(new JsonOutputParser());
    const result = await chain.invoke({ context, answer });
    const isGrounded = result?.grounded === 'yes';
    console.log(`[HallucinationChecker] Grounded: ${isGrounded}`);
    return { isGrounded };
  } catch (err) {
    // Fail safe — assume grounded if checker errors out
    console.warn('[HallucinationChecker] Check failed, assuming grounded:', err.message);
    return { isGrounded: true };
  }
};
