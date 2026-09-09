import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true, index: true },
    videoTitle: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    messageCount: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('Session', sessionSchema);
