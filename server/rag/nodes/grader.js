import { ChatGroq } from '@langchain/groq';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { graderPrompt } from '../prompts/index.js';

const getLLM = () =>
  new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    temperature: 0,
    maxTokens: 50,
  });

/**
 * LangGraph Node: Relevance Grader
 * Filters retrieved chunks — keeps only those relevant to the question.
 * If < 2 chunks pass, routes to query rewriter.
 */
export const graderNode = async (state) => {
  const { question, retrievedChunks } = state;
  const chain = graderPrompt.pipe(getLLM()).pipe(new JsonOutputParser());

  const gradedChunks = [];

  for (const chunk of retrievedChunks) {
    try {
      const result = await chain.invoke({ question, document: chunk.text });
      if (result?.relevant === 'yes') {
        gradedChunks.push(chunk);
      }
    } catch (err) {
      // On error, include the chunk to be safe (fail open)
      gradedChunks.push(chunk);
    }
  }

  console.log(`[Grader] ${gradedChunks.length}/${retrievedChunks.length} chunks passed relevance check`);
  return { gradedChunks };
};
