import { Chroma } from '@langchain/community/vectorstores/chroma';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import { getEmbeddings } from './embeddingService.js';

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';

/**
 * Returns the ChromaDB collection name for a given videoId.
 */
export const getCollectionName = (videoId) => `video_${videoId}`;

/**
 * Ingests transcript chunks into ChromaDB for a given video.
 * Each chunk gets metadata: { videoId, startTime, endTime, timestamp }
 *
 * @param {string} videoId
 * @param {Array} mergedSegments - [{ text, startTime, endTime, timestamp }]
 * @returns {number} number of chunks stored
 */
export const ingestToVectorStore = async (videoId, chunks) => {
  const collectionName = getCollectionName(videoId);
  const embeddings = getEmbeddings();

  // Create documents directly from time-aware chunks with preserved boundary timestamps
  const docs = chunks.map(
    (chunk) =>
      new Document({
        pageContent: chunk.text,
        metadata: {
          videoId,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          timestamp: chunk.timestamp,
          source: `Timestamp: ${chunk.timestamp}`,
        },
      })
  );

  // Store in ChromaDB (persistent to disk)
  const vectorStore = await Chroma.fromDocuments(docs, embeddings, {
    collectionName,
    url: CHROMA_URL,
    collectionMetadata: { 'hnsw:space': 'cosine' },
  });

  console.log(`✅ Stored ${docs.length} time-aligned chunks in ChromaDB collection: ${collectionName}`);
  return docs.length;
};

/**
 * Retrieves the top-k most relevant chunks for a query from a video's collection.
 *
 * @param {string} videoId
 * @param {string} query
 * @param {number} k - number of chunks to retrieve
 * @returns {Array<Document>}
 */
export const retrieveChunks = async (videoId, query, k = 6) => {
  const collectionName = getCollectionName(videoId);
  const embeddings = getEmbeddings();

  const vectorStore = await Chroma.fromExistingCollection(embeddings, {
    collectionName,
    url: CHROMA_URL,
  });

  const results = await vectorStore.similaritySearchWithScore(query, k);

  return results.map(([doc, score]) => ({
    text: doc.pageContent,
    startTime: doc.metadata?.startTime || 0,
    endTime: doc.metadata?.endTime || 0,
    timestamp: doc.metadata?.timestamp || '00:00',
    videoId: doc.metadata?.videoId || videoId,
    score: Math.round(score * 1000) / 1000,
  }));
};

/**
 * Deletes a ChromaDB collection for a given video.
 */
export const deleteVideoCollection = async (videoId) => {
  const collectionName = getCollectionName(videoId);
  const embeddings = getEmbeddings();
  try {
    const vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName,
      url: CHROMA_URL,
    });
    await vectorStore.delete({ filter: {} });
    console.log(`🗑️  Deleted ChromaDB collection: ${collectionName}`);
  } catch (err) {
    console.warn(`Could not delete collection ${collectionName}:`, err.message);
  }
};
