/**
 * Central LLM configuration.
 * Change the model here to update it across the entire app.
 *
 * Available Groq models (pick one):
 *   - 'llama-3.1-70b-versatile'   (best quality, widely available)
 *   - 'llama3-70b-8192'           (stable, fast)
 *   - 'llama-3.1-8b-instant'      (fastest, lower quality)
 *   - 'mixtral-8x7b-32768'        (good for structured output)
 */
export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';

