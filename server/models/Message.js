import mongoose from 'mongoose';

const sourceSchema = new mongoose.Schema(
  {
    text: String,
    startTime: Number,   // seconds
    endTime: Number,
    timestamp: String,   // formatted "MM:SS"
    score: Number,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    videoId: { type: String, required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    sources: { type: [sourceSchema], default: [] },
    queryType: {
      type: String,
      enum: ['factual', 'timestamp', 'topic', 'summary', 'general'],
      default: 'general',
    },
    retries: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Message', messageSchema);
