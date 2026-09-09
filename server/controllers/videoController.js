import Video from '../models/Video.js';
import {
  extractVideoId,
  fetchTranscript,
  mergeTranscriptSegments,
  getTranscriptDuration,
} from '../services/transcriptService.js';
import { ingestToVectorStore, getCollectionName, deleteVideoCollection } from '../services/vectorStoreService.js';

/**
 * POST /api/videos/ingest
 * Submits a YouTube URL for full ingestion pipeline.
 */
export const ingestVideo = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: 'YouTube URL is required.' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ success: false, error: 'Invalid YouTube URL.' });

  // Check if already ingested
  const existing = await Video.findOne({ videoId });
  if (existing && existing.status === 'ready') {
    return res.json({ success: true, video: existing, message: 'Already ingested.' });
  }

  // Create or update record
  let video = existing || new Video({ videoId, url });
  video.status = 'processing';
  await video.save();

  // Send immediate response — processing happens asynchronously
  res.json({ success: true, video, message: 'Ingestion started.' });

  // Run pipeline in background
  processVideo(video).catch((err) => {
    console.error(`[Ingestion] Failed for ${videoId}:`, err.message);
  });
};

/**
 * Background video processing pipeline.
 */
const processVideo = async (video) => {
  const { videoId } = video;
  try {
    console.log(`\n[Ingestion] Starting pipeline for videoId: ${videoId}`);

    // Step 1: Fetch transcript
    console.log('[Ingestion] Fetching transcript...');
    const transcript = await fetchTranscript(videoId);
    video.transcriptRaw = transcript;
    video.duration = getTranscriptDuration(transcript);
    await video.save();

    // Step 2: Merge segments + ingest to vector store
    console.log('[Ingestion] Merging segments and embedding...');
    const merged = mergeTranscriptSegments(transcript, 600);
    const chunkCount = await ingestToVectorStore(videoId, merged);

    // Step 3: Update record as ready
    video.status = 'ready';
    video.chunkCount = chunkCount;
    video.collectionName = getCollectionName(videoId);
    await video.save();

    console.log(`✅ [Ingestion] Done! ${chunkCount} chunks stored for videoId: ${videoId}`);
  } catch (err) {
    video.status = 'failed';
    video.errorMessage = err.message;
    await video.save();
    throw err;
  }
};

/**
 * GET /api/videos
 * Returns all ingested videos.
 */
export const getVideos = async (req, res) => {
  const videos = await Video.find().sort({ createdAt: -1 }).select('-transcriptRaw');
  res.json({ success: true, videos });
};

/**
 * GET /api/videos/:id
 * Returns a single video with full transcript.
 */
export const getVideo = async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) return res.status(404).json({ success: false, error: 'Video not found.' });
  res.json({ success: true, video });
};

/**
 * GET /api/videos/status/:videoId
 * Polls ingestion status for a given YouTube videoId.
 */
export const getVideoStatus = async (req, res) => {
  const video = await Video.findOne({ videoId: req.params.videoId }).select('-transcriptRaw');
  if (!video) return res.status(404).json({ success: false, error: 'Video not found.' });
  res.json({ success: true, video });
};

/**
 * DELETE /api/videos/:id
 * Deletes video record and its ChromaDB collection.
 */
export const deleteVideo = async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) return res.status(404).json({ success: false, error: 'Video not found.' });

  await deleteVideoCollection(video.videoId);
  await video.deleteOne();
  res.json({ success: true, message: 'Video deleted.' });
};
