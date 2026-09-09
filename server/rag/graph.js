import { StateGraph, END } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';

import { queryAnalyzerNode } from './nodes/queryAnalyzer.js';
import { retrieverNode } from './nodes/retriever.js';
import { graderNode } from './nodes/grader.js';
import { generatorNode } from './nodes/generator.js';
import { hallucinationCheckerNode } from './nodes/hallucinationChecker.js';
import { queryRewriterNode } from './nodes/queryRewriter.js';

const MAX_RETRIES = 3;

// ─── State Annotation ─────────────────────────────────────────────────
const GraphState = Annotation.Root({
  // Input
  question:       Annotation({ reducer: (a, b) => b ?? a }),
  videoId:        Annotation({ reducer: (a, b) => b ?? a }),
  chatHistory:    Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),

  // Processing
  queryType:      Annotation({ reducer: (a, b) => b ?? a, default: () => 'general' }),
  retrievedChunks:Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  gradedChunks:   Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  retries:        Annotation({ reducer: (a, b) => b ?? a, default: () => 0 }),

  // Output
  answer:         Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
  context:        Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
  isGrounded:     Annotation({ reducer: (a, b) => b ?? a, default: () => false }),
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

// ─── Build Graph ──────────────────────────────────────────────────────
const buildGraph = () => {
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

  return graph.compile();
};

// ─── Singleton compiled graph ──────────────────────────────────────────
let _graph = null;
export const getGraph = () => {
  if (!_graph) _graph = buildGraph();
  return _graph;
};

/**
 * Runs the full RAG pipeline for a question about a video.
 * Returns { answer, gradedChunks, queryType, retries }
 */
export const runRagPipeline = async ({ question, videoId, chatHistory = [] }) => {
  const graph = getGraph();

  const result = await graph.invoke({
    question,
    videoId,
    chatHistory,
    queryType: 'general',
    retrievedChunks: [],
    gradedChunks: [],
    retries: 0,
    answer: '',
    context: '',
    isGrounded: false,
  });

  return {
    answer: result.answer,
    gradedChunks: result.gradedChunks,
    queryType: result.queryType,
    retries: result.retries,
  };
};
