import { NomicEmbeddings } from '@langchain/nomic';

let _embeddings = null;

/**
 * Returns a singleton NomicEmbeddings instance.
 * Uses nomic-embed-text-v1.5 — free tier, high quality.
 */
export const getEmbeddings = () => {
  if (!_embeddings) {
    if (!process.env.NOMIC_API_KEY) {
      throw new Error('NOMIC_API_KEY is not set in environment variables.');
    }
    _embeddings = new NomicEmbeddings({
      apiKey: process.env.NOMIC_API_KEY,
      model: 'nomic-embed-text-v1.5',
    });
    console.log('✅ Nomic embeddings initialized (nomic-embed-text-v1.5)');
  }
  return _embeddings;
};

/**
 * Embeds a list of strings and returns their vector representations.
 */
export const embedTexts = async (texts) => {
  const embeddings = getEmbeddings();
  return embeddings.embedDocuments(texts);
};

/**
 * Embeds a single query string.
 */
export const embedQuery = async (text) => {
  const embeddings = getEmbeddings();
  return embeddings.embedQuery(text);
};
