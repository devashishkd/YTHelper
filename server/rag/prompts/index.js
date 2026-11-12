import { ChatPromptTemplate } from '@langchain/core/prompts';

// ─── Query Analyzer Prompt ─────────────────────────────────────────────
export const queryAnalyzerPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert at classifying questions about YouTube video content.
Classify the user's question into ONE of these categories:
- "timestamp": User asks what happened at a specific time (e.g., "what was said at 5 minutes?")
- "topic": User asks about subjects, themes, or topics covered
- "summary": User wants a summary or overview of the video or a section
- "factual": User asks a specific factual question about the video's content
- "general": Anything else

Respond with ONLY a JSON object like: {{"queryType": "factual"}}`,
  ],
  ['human', 'Question: {question}'],
]);

// ─── Relevance Grader Prompt ───────────────────────────────────────────
export const graderPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a grader assessing whether a retrieved document chunk is relevant to a user question about a YouTube video.
Score the chunk as "yes" if it contains information that could help answer the question.
Score as "no" if it is completely off-topic or irrelevant.

Respond with ONLY a JSON object: {{"relevant": "yes"}} or {{"relevant": "no"}}`,
  ],
  ['human', 'Question: {question}\n\nDocument chunk:\n{document}'],
]);

// ─── Generator Prompt ─────────────────────────────────────────────────
export const generatorPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert assistant that answers questions about YouTube videos based on the video's transcript.

RULES:
1. Answer ONLY based on the provided transcript chunks. Do not hallucinate or add information not in the transcript.
2. When citing specific moments, ALWAYS mention the timestamp (e.g., "At 05:32, the speaker said...").
3. Each chunk includes a clip URL — when referencing a moment, append it as a markdown link: [▶ Jump to 05:32](clip_url).
4. If the answer includes a list of topics or timestamps, format them as a clean bullet list.
5. If you cannot find the answer in the provided chunks, say so honestly.
6. Keep answers concise and focused. Use markdown for formatting.
7. If long-term memory context is provided, use it to give richer, more personalised answers — but do NOT fabricate from it.

Video context chunks (with timestamps and clip URLs):
{context}

Chat history:
{chatHistory}

Long-term memory (topics this user has previously explored about this video):
{longTermContext}`,
  ],
  ['human', '{question}'],
]);

// ─── Hallucination Checker Prompt ──────────────────────────────────────
export const hallucinationPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a fact-checker. Your job is to verify whether an AI-generated answer is grounded in the provided source documents.
Check if the key claims in the answer can be traced back to the source chunks.
Respond ONLY with a JSON object: {{"grounded": "yes"}} or {{"grounded": "no"}}`,
  ],
  ['human', 'Source chunks:\n{context}\n\nGenerated answer:\n{answer}'],
]);

// ─── Query Rewriter Prompt ─────────────────────────────────────────────
export const rewriterPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a query optimizer. Rewrite the user's question to be more specific and better suited for semantic search over a YouTube video transcript.
Make it clearer, add relevant keywords, and focus on what information would be found in a spoken transcript.
Return ONLY the rewritten query as a plain string.`,
  ],
  ['human', 'Original question: {question}\nQuery type: {queryType}'],
]);
