import mongoose from 'mongoose';

/**
 * Long-term memory: stores a rolling summary of what a user has asked
 * about a specific video across all sessions.
 * One document per videoId (upserted on each session end).
 */
const videoMemorySchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true, unique: true, index: true },
    videoTitle: { type: String, default: '' },
    // Rolling summary of past Q&A — fed as long-term context into new sessions
    summary: { type: String, default: '' },
    // Key facts extracted from past answers (for quick recall)
    keyFacts: { type: [String], default: [] },
    // Total questions asked about this video across all sessions
    totalQuestions: { type: Number, default: 0 },
    // Last time memory was updated
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('VideoMemory', videoMemorySchema);
