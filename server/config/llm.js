/**
 * Central LLM configuration.
 * Model options from Groq Free Plan:
 *   - 'openai/gpt-oss-120b'  (Recommended: best reasoning & quality)
 *   - 'qwen/qwen3.8-27b'     (Fast, excellent performance)
 *   - 'openai/gpt-oss-20b'   (Lightweight & fast)
 */
export const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

