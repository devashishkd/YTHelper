import { ChatGroq } from '@langchain/groq';
import { z } from 'zod';
import { hallucinationPrompt } from '../prompts/index.js';
import { GROQ_MODEL } from '../../config/llm.js';

const GroundedSchema = z.object({
  grounded: z.enum(['yes', 'no']),
});

const getLLM = () =>
  new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: GROQ_MODEL,
    temperature: 0,
    maxTokens: 50,
  });

/**
 * LangGraph Node: Hallucination Checker
 * Verifies the generated answer is grounded in retrieved context.
 * Uses Zod schema + withStructuredOutput to enforce { grounded: 'yes' | 'no' }.
 * Sets state.isGrounded = true/false.
 */
export const hallucinationCheckerNode = async (state) => {
  const { answer, context } = state;

  try {
    const llm = getLLM().withStructuredOutput(GroundedSchema);
    const result = await hallucinationPrompt.pipe(llm).invoke({ context, answer });
    const isGrounded = result.grounded === 'yes';
    console.log(`[HallucinationChecker] Grounded: ${isGrounded}`);
    return {
      isGrounded,
      verificationStatus: isGrounded ? 'verified' : 'unverified',
      warning: isGrounded
        ? null
        : '⚠️ This answer may contain details not fully grounded in the video transcript.',
    };
  } catch (err) {
    // Graceful degradation: fail-open with an explicit degradation notice
    console.warn('[HallucinationChecker] Check failed, failing open with warning:', err.message);
    return {
      isGrounded: true,
      verificationStatus: 'degraded',
      warning: '⚠️ Transcript verification could not be completed. Please cross-reference with video timestamps.',
    };
  }
};
