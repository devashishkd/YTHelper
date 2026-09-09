import { retrieveChunks } from '../../services/vectorStoreService.js';

/**
 * LangGraph Node: Retriever
 * Performs semantic similarity search against the video's ChromaDB collection.
 * Retrieves more chunks for summary/topic queries, fewer for factual.
 */
export const retrieverNode = async (state) => {
  const { question, videoId, queryType } = state;

  const kMap = {
    summary: 10,
    topic: 8,
    timestamp: 6,
    factual: 5,
    general: 6,
  };
  const k = kMap[queryType] || 6;

  const chunks = await retrieveChunks(videoId, question, k);
  console.log(`[Retriever] Retrieved ${chunks.length} chunks for "${question}"`);
  return { retrievedChunks: chunks };
};
