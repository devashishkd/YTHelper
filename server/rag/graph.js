import { StateGraph, END } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';

import { queryAnalyzerNode } from './nodes/queryAnalyzer.js';
import { retrieverNode } from './nodes/retriever.js';
import { graderNode } from './nodes/grader.js';
import { generatorNode } from './nodes/generator.js';
import { hallucinationCheckerNode } from './nodes/hallucinationChecker.js';
import { queryRewriterNode } from './nodes/queryRewriter.js';
import { getCheckpointer } from '../memory/checkpointer.js';

const MAX_RETRIES = 3;

// ─── State Annotation ─────────────────────────────────────────────────
const GraphState = Annotation.Root({
  // Input
  question:         Annotation({ reducer: (a, b) => b ?? a }),
  videoId:          Annotation({ reducer: (a, b) => b ?? a }),
  chatHistory:      Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),

  // Long-term memory context (injected at session start)
  longTermContext:  Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),

  // Processing
  queryType:        Annotation({ reducer: (a, b) => b ?? a, default: () => 'general' }),
  retrievedChunks:  Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  gradedChunks:     Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  retries:          Annotation({ reducer: (a, b) => b ?? a, default: () => 0 }),

  // Output
  answer:             Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
  context:            Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
  isGrounded:         Annotation({ reducer: (a, b) => b ?? a, default: () => false }),
  verificationStatus: Annotation({ reducer: (a, b) => b ?? a, default: () => 'unverified' }),
  warning:            Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
});

// ─── Conditional Edge: After Grading ──────────────────────────────────
const shouldRewriteAfterGrading = (state) => {
  const { gradedChunks, retries } = state;
  if (retries >= MAX_RETRIES) {
    console.log(`[Graph] Max retries (${MAX_RETRIES}) reached — proceeding with available chunks`);
    return 'generate';
  }
  if (!gradedChunks || gradedChunks.length < 2) {
    console.log('[Graph] Not enough relevant chunks — rewriting query');
    return 'rewrite';
  }
  return 'generate';
};

// ─── Conditional Edge: After Hallucination Check ──────────────────────
const shouldRewriteAfterHallucinationCheck = (state) => {
  const { isGrounded, retries } = state;
  if (retries >= MAX_RETRIES) {
    console.log('[Graph] Max retries reached — returning answer as-is');
    return 'end';
  }
  if (!isGrounded) {
    console.log('[Graph] Answer not grounded — rewriting query');
    return 'rewrite';
  }
  return 'end';
};

// ─── Build Graph with MemorySaver Checkpointer ────────────────────────
const buildGraph = () => {
  const checkpointer = getCheckpointer();
  const graph = new StateGraph(GraphState);

  // Add nodes
  graph.addNode('queryAnalyzer', queryAnalyzerNode);
  graph.addNode('retriever', retrieverNode);
  graph.addNode('grader', graderNode);
  graph.addNode('generator', generatorNode);
  graph.addNode('hallucinationChecker', hallucinationCheckerNode);
  graph.addNode('queryRewriter', queryRewriterNode);

  // Entry point
  graph.setEntryPoint('queryAnalyzer');

  // Linear edges
  graph.addEdge('queryAnalyzer', 'retriever');
  graph.addEdge('retriever', 'grader');
  graph.addEdge('generator', 'hallucinationChecker');
  graph.addEdge('queryRewriter', 'retriever');

  // Conditional edges
  graph.addConditionalEdges('grader', shouldRewriteAfterGrading, {
    generate: 'generator',
    rewrite: 'queryRewriter',
  });

  graph.addConditionalEdges('hallucinationChecker', shouldRewriteAfterHallucinationCheck, {
    end: END,
    rewrite: 'queryRewriter',
  });

  // Compile with MemorySaver — enables short-term memory per thread_id
  return graph.compile({ checkpointer });
};

// ─── Singleton compiled graph ──────────────────────────────────────────
let _graph = null;
export const getGraph = () => {
  if (!_graph) _graph = buildGraph();
  return _graph;
};

/**
 * Runs the full RAG pipeline for a question about a video.
 *
 * @param {Object} opts
 * @param {string} opts.question
 * @param {string} opts.videoId
 * @param {string} opts.threadId   — session._id.toString() for MemorySaver thread isolation
 * @param {Array}  opts.chatHistory — recent messages from MongoDB (seed for first turn)
 * @param {string} opts.longTermContext — summary from VideoMemory (long-term priming)
 */
export const runRagPipeline = async ({
  question,
  videoId,
  threadId,
  chatHistory = [],
  longTermContext = '',
}) => {
  const graph = getGraph();

  // thread_id scopes the MemorySaver checkpoint — each session is isolated
  const config = threadId ? { configurable: { thread_id: threadId } } : undefined;

  const result = await graph.invoke(
    {
      question,
      videoId,
      chatHistory,
      longTermContext,
      queryType: 'general',
      retrievedChunks: [],
      gradedChunks: [],
      retries: 0,
      answer: '',
      context: '',
      isGrounded: false,
      verificationStatus: 'unverified',
      warning: null,
    },
    config
  );

  return {
    answer: result.answer,
    gradedChunks: result.gradedChunks,
    queryType: result.queryType,
    retries: result.retries,
    isGrounded: result.isGrounded,
    verificationStatus: result.verificationStatus,
    warning: result.warning,
  };
};
