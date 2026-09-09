import { useNavigate } from 'react-router-dom';
import { videoApi } from '../services/api';

const formatDuration = (seconds) => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const StatusBadge = ({ status }) => {
  const styles = {
    ready: 'bg-emerald-400/15 text-emerald-400',
    pending: 'bg-amber-400/15 text-amber-400',
    processing: 'bg-accent/15 text-accent',
    failed: 'bg-red-400/15 text-red-400',
  };
  const dotStyles = {
    ready: 'bg-emerald-400 shadow-[0_0_6px_#34d399]',
    pending: 'bg-amber-400',
    processing: 'bg-accent animate-pulse',
    failed: 'bg-red-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[status]}`} />
      {status}
    </span>
  );
};

export default function VideoList({ videos, onDelete, onRefresh }) {
  const navigate = useNavigate();

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this video and all its data?')) return;
    try {
      await videoApi.delete(id);
      onDelete?.(id);
    } catch (err) {
      console.error('Delete failed:', err.message);
    }
  };

  const handleChat = (e, video) => {
    e.stopPropagation();
    if (video.status !== 'ready') return;
    navigate(`/chat/${video.videoId}`, { state: { video } });
  };

  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500">
        <div className="text-5xl mb-3">📼</div>
        <p>No videos yet. Add a YouTube URL above to get started.</p>
      </div>
    );
  }

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-5">
        <span className="text-base font-bold text-slate-400 uppercase tracking-wider">Your Video Library ({videos.length})</span>
        <button id="refresh-library-btn" className="px-3.5 py-1.5 text-sm font-semibold text-slate-400 border border-white/10 rounded-md hover:text-slate-200 hover:border-accent/40 hover:bg-slate-800 transition-all" onClick={onRefresh}>
          ↻ Refresh
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
          <div
            key={video._id}
            id={`video-card-${video.videoId}`}
            className="group relative flex flex-col gap-3 bg-slate-900 border border-white/10 rounded-2xl p-5 cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40"
            onClick={(e) => handleChat(e, video)}
          >
            {/* Hover gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

            <div className="flex items-center justify-between gap-2 z-10">
              <StatusBadge status={video.status} />
              {video.duration > 0 && (
                <span className="text-xs text-slate-500">
                  ⏱ {formatDuration(video.duration)}
                </span>
              )}
            </div>

            <p className="font-semibold text-sm text-slate-200 line-clamp-2 z-10">
              {video.title !== 'Unknown Title' ? video.title : video.videoId}
            </p>

            <p className="text-xs text-slate-500 truncate z-10">{video.url}</p>

            <div className="flex gap-3 text-xs text-slate-500 z-10">
              {video.chunkCount > 0 && (
                <span>📦 {video.chunkCount} chunks</span>
              )}
              <span>🕐 {new Date(video.createdAt).toLocaleDateString()}</span>
            </div>

            {video.status === 'failed' && (
              <p className="text-xs text-red-400 z-10">
                ⚠ {video.errorMessage}
              </p>
            )}

            <div className="flex gap-2 mt-auto z-10">
              <button
                id={`chat-btn-${video.videoId}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-gradient-to-br from-accent to-[#8b69ff] text-white font-semibold rounded-md text-sm shadow-[0_4px_20px_rgba(99,135,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_6px_28px_rgba(99,135,255,0.25)] transition-all"
                onClick={(e) => handleChat(e, video)}
                disabled={video.status !== 'ready'}
              >
                {video.status === 'processing' ? (
                  <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing</>
                ) : video.status === 'ready' ? (
                  '💬 Chat'
                ) : (
                  video.status
                )}
              </button>
              <button
                id={`delete-btn-${video.videoId}`}
                className="opacity-0 group-hover:opacity-100 p-2 text-red-400 bg-red-400/15 border border-red-400/25 rounded-md hover:bg-red-400/25 transition-all"
                onClick={(e) => handleDelete(e, video._id)}
                title="Delete video"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
