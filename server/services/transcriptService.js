import { YoutubeTranscript } from 'youtube-transcript';

import { translate } from 'google-translate-api-x';

/**
 * Extracts a video ID from various YouTube URL formats.
 */
export const extractVideoId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
    /(?:youtube\.com\/v\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
};

/**
 * Fetches the full transcript for a YouTube video and ensures it's in English.
 */
export const fetchTranscript = async (videoId) => {
  try {
    let rawTranscript;
    let isEnglish = true;
    try {
      rawTranscript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    } catch (e) {
      rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
      isEnglish = false;
    }

    if (!rawTranscript || rawTranscript.length === 0) {
      throw new Error('No transcript available for this video.');
    }

    // If it wasn't English, translate it using google-translate-api-x in batches
    if (!isEnglish) {
      console.log(`[Transcript] Translating transcript for ${videoId} to English...`);
      const batchSize = 50; // Translate in chunks of 50 segments to avoid rate limits/payload too large
      for (let i = 0; i < rawTranscript.length; i += batchSize) {
        const batch = rawTranscript.slice(i, i + batchSize);
        const textsToTranslate = batch.map(seg => seg.text);
        
        try {
          const translatedRes = await translate(textsToTranslate, { to: 'en' });
          // translatedRes is an array of objects when passing an array of strings
          translatedRes.forEach((res, idx) => {
            rawTranscript[i + idx].text = res.text;
          });
        } catch (err) {
          console.warn(`[Transcript] Translation batch failed, keeping original language for this batch. Error: ${err.message}`);
        }
      }
    }

    // Enrich with formatted timestamps
    const enriched = rawTranscript.map((item) => {
      const startSec = item.offset / 1000;
      const endSec = (item.offset + item.duration) / 1000;
      return {
        text: item.text.replace(/\n/g, ' ').trim(),
        startTime: Math.floor(startSec),
        endTime: Math.floor(endSec),
        timestamp: formatTimestamp(startSec),
      };
    });

    return enriched;
  } catch (error) {
    if (error.message.includes('Could not retrieve')) {
      throw new Error('Transcript unavailable: this video may be private, age-restricted, or have no captions.');
    }
    throw error;
  }
};

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export const formatTimestamp = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Gets the total duration from a transcript array.
 */
export const getTranscriptDuration = (transcript) => {
  if (!transcript || transcript.length === 0) return 0;
  const last = transcript[transcript.length - 1];
  return last.endTime || 0;
};

/**
 * Generates a YouTube deep-link URL with pre-roll padding.
 * @param {string} videoId
 * @param {number} startTime - start time in seconds
 * @param {number} preRoll - seconds before speech start to begin playback (default 2s)
 */
export const getClipUrl = (videoId, startTime = 0, preRoll = 2) => {
  const padded = Math.max(0, Math.floor(startTime) - preRoll);
  return `https://youtu.be/${videoId}?t=${padded}`;
};

/**
 * Creates overlapping chunks of transcript segments while preserving exact
 * boundary timestamps (startTime, endTime, timestamp).
 * Groups complete subtitle spans up to targetLength characters with segment-level overlap.
 *
 * @param {Array} transcript - [{ text, startTime, endTime, timestamp }]
 * @param {number} targetLength - target max characters per chunk (default 800)
 * @param {number} overlapSegments - number of subtitle spans to overlap (default 2)
 * @returns {Array} chunks - [{ text, startTime, endTime, timestamp }]
 */
export const mergeTranscriptSegments = (transcript, targetLength = 800, overlapSegments = 2) => {
  if (!transcript || transcript.length === 0) return [];

  const chunks = [];
  let i = 0;

  while (i < transcript.length) {
    let charCount = 0;
    let j = i;
    const currentSlice = [];

    while (j < transcript.length && (charCount + transcript[j].text.length <= targetLength || currentSlice.length === 0)) {
      currentSlice.push(transcript[j]);
      charCount += transcript[j].text.length + 1;
      j++;
    }

    const firstSeg = currentSlice[0];
    const lastSeg = currentSlice[currentSlice.length - 1];

    chunks.push({
      text: currentSlice.map((s) => s.text).join(' ').trim(),
      startTime: firstSeg.startTime,
      endTime: lastSeg.endTime,
      timestamp: firstSeg.timestamp,
    });

    if (j >= transcript.length) break;

    // Advance window with segment overlap (minimum 1 segment forward)
    const step = Math.max(1, currentSlice.length - overlapSegments);
    i += step;
  }

  return chunks;
};
