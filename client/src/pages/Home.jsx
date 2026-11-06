import { useState, useEffect } from 'react';
import VideoInput from '../components/VideoInput';
import VideoList from '../components/VideoList';
import MultiVideoModal from '../components/MultiVideoModal';
import { videoApi } from '../services/api';

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMultiModal, setShowMultiModal] = useState(false);

  const readyVideos = videos.filter((v) => v.status === 'ready');

  const loadVideos = async () => {
    try {
      const res = await videoApi.getAll();
      setVideos(res.data.videos || []);
    } catch (err) {
      console.error('Failed to load videos:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVideos(); }, []);

  const handleIngestionStarted = (newVideo, isReady) => {
    setVideos((prev) => {
      const exists = prev.find((v) => v.videoId === newVideo.videoId);
      if (exists) {
        return prev.map((v) => v.videoId === newVideo.videoId ? { ...v, ...newVideo } : v);
      }
      return [newVideo, ...prev];
    });
  };

  const handleDelete = (deletedId) => {
    setVideos((prev) => prev.filter((v) => v._id !== deletedId));
  };

  return (
    <div className="flex-1 w-full max-w-[1280px] mx-auto px-6 pb-12">
      <VideoInput onIngestionStarted={handleIngestionStarted} />

      {readyVideos.length >= 2 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-accent/15 via-indigo-500/10 to-transparent border border-accent/30 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h4 className="font-bold text-slate-200 text-sm">Feature 1: Cross-Video Comparison</h4>
              <p className="text-xs text-slate-400">
                You have {readyVideos.length} ready videos. Query and compare insights across them simultaneously.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowMultiModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-accent to-[#8b69ff] text-white text-xs font-semibold rounded-xl hover:shadow-[0_4px_20px_rgba(99,135,255,0.35)] transition-all shrink-0"
          >
            Launch Multi-RAG ⚡
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center p-10 text-slate-500">
          <span className="inline-block w-6 h-6 border-4 border-slate-700 border-t-accent rounded-full animate-spin" />
        </div>
      ) : (
        <VideoList
          videos={videos}
          onDelete={handleDelete}
          onRefresh={loadVideos}
        />
      )}

      {showMultiModal && (
        <MultiVideoModal
          readyVideos={readyVideos}
          onClose={() => setShowMultiModal(false)}
        />
      )}
    </div>
  );
}
