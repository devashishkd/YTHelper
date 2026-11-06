import { ChatPromptTemplate } from '@langchain/core/prompts';

// ─── Quiz Generator Prompt ─────────────────────────────────────────────
export const quizPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert educator. Generate a quiz based ONLY on the provided YouTube video transcript chunks.
Create exactly {count} multiple-choice questions. Each question must:
1. Be answerable from the transcript chunks provided.
2. Have exactly 4 options (A, B, C, D) with only one correct answer.
3. Include the timestamp where the answer can be found.

Respond with ONLY a valid JSON array in this exact format:
[
  {{
    "question": "...",
    "options": {{ "A": "...", "B": "...", "C": "...", "D": "..." }},
    "answer": "A",
    "explanation": "Brief explanation of why this is correct.",
    "timestamp": "MM:SS"
  }}
]`,
  ],
  ['human', 'Transcript chunks:\n{context}'],
]);

// ─── Study Notes Prompt ───────────────────────────────────────────────
export const studyNotesPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert at creating structured study notes from video transcripts.
Generate comprehensive study notes from the provided transcript chunks.
Structure them as:
- A brief introduction
- Main topics as ## headings
- Key points as bullet lists under each topic
- Include timestamps in brackets like [05:32] for key moments
- A "Key Takeaways" section at the end

Use clean markdown formatting. Be thorough but concise.`,
  ],
  ['human', 'Video transcript chunks:\n{context}'],
]);

// ─── Translation Prompt ───────────────────────────────────────────────
export const translateAnswerPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a professional translator. Translate the given text to {targetLanguage}.
Preserve all markdown formatting, timestamps, and technical terms.
Return ONLY the translated text with no extra explanation.`,
  ],
  ['human', '{text}'],
]);

// ─── Multi-video Generator Prompt ─────────────────────────────────────
export const multiVideoGeneratorPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert assistant that answers questions by synthesizing information across multiple YouTube videos.

RULES:
1. Answer ONLY based on the provided transcript chunks from multiple videos.
2. Clearly attribute information to the correct video using the video label (e.g., "In Video 1...", "Video 2 explains...").
3. When comparing or contrasting, use a structured format.
4. Always cite timestamps when referencing specific moments.
5. If a video is irrelevant to the question, ignore it and say so briefly.
6. Use markdown formatting for clarity.

Video transcript chunks (with video labels and timestamps):
{context}`,
  ],
  ['human', '{question}'],
]);

// ─── Language Detection Prompt ────────────────────────────────────────
export const languageDetectPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `Detect the language of the given text. Respond ONLY with a JSON object like:
{{"language": "English", "code": "en"}}
Use the full language name and ISO 639-1 code.`,
  ],
  ['human', '{text}'],
]);

