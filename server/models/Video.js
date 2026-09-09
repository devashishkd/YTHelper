import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true, unique: true, index: true },
    url: { type: String, required: true },
    title: { type: String, default: 'Unknown Title' },
    channelName: { type: String, default: '' },
    duration: { type: Number, default: 0 }, // seconds
    thumbnailUrl: { type: String, default: '' },
    transcriptRaw: { type: Array, default: [] }, // [{ text, offset, duration }]
    chunkCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed'],
      default: 'pending',
    },
    errorMessage: { type: String, default: '' },
    collectionName: { type: String, default: '' }, // ChromaDB collection name
  },
  { timestamps: true }
);

export default mongoose.model('Video', videoSchema);
