import { useState, useEffect } from 'react';
import VideoInput from '../components/VideoInput';
import VideoList from '../components/VideoList';
import { videoApi } from '../services/api';

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

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
    </div>
  );
}
