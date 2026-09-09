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
 * Merges small transcript segments into larger text blocks for better chunking.
 * Groups segments until they reach targetLength characters.
 */
export const mergeTranscriptSegments = (transcript, targetLength = 800) => {
  const merged = [];
  let current = { text: '', startTime: 0, endTime: 0, timestamp: '' };

  for (const seg of transcript) {
    if (current.text === '') {
      current = { ...seg };
    } else if (current.text.length + seg.text.length < targetLength) {
      current.text += ' ' + seg.text;
      current.endTime = seg.endTime;
    } else {
      merged.push({ ...current });
      current = { ...seg };
    }
  }
  if (current.text) merged.push(current);
  return merged;
};
