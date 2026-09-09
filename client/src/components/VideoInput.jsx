import { useState } from 'react';
import { videoApi } from '../services/api';

const isValidYouTubeUrl = (url) => {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url);
};

export default function VideoInput({ onIngestionStarted }) {
  const [url, setUrl]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    if (!isValidYouTubeUrl(url.trim())) {
      setError('Please enter a valid YouTube URL.');
      return;
    }

    setError('');
    setLoading(true);
    setStatusMsg('Submitting video...');

    try {
      const res = await videoApi.ingest(url.trim());
      const video = res.data.video;

      if (video.status === 'ready') {
        setStatusMsg('✅ Already processed! Ready to chat.');
        onIngestionStarted?.(video, true);
        setTimeout(() => setStatusMsg(''), 2000);
      } else {
        setStatusMsg('⚙️  Processing transcript & embeddings...');
        onIngestionStarted?.(video, false);

        // Poll until ready
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await videoApi.getStatus(video.videoId);
            const updated = statusRes.data.video;
            if (updated.status === 'ready') {
              clearInterval(pollInterval);
              setStatusMsg('✅ Video ready! Click to start chatting.');
              setLoading(false);
              onIngestionStarted?.(updated, true);
              setTimeout(() => setStatusMsg(''), 3000);
            } else if (updated.status === 'failed') {
              clearInterval(pollInterval);
              setError(`Processing failed: ${updated.errorMessage}`);
              setLoading(false);
              setStatusMsg('');
            }
          } catch {
            clearInterval(pollInterval);
            setLoading(false);
          }
        }, 3000);
      }

      setUrl('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit video.');
      setLoading(false);
      setStatusMsg('');
    }
  };

  return (
    <section className="pt-16 pb-10 text-center">
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-tight mb-3 bg-gradient-to-br from-white to-accent bg-clip-text text-transparent">
        Ask Anything About<br />Any YouTube Video
      </h1>
      <p className="text-lg text-slate-400 mb-10">
        Paste a YouTube link → AI fetches the transcript → Chat with it instantly
      </p>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex flex-col sm:flex-row gap-3 max-w-[700px] mx-auto">
          <input
            id="youtube-url-input"
            className="flex-1 px-5 py-3.5 bg-slate-900 border border-white/10 rounded-xl text-slate-200 text-sm focus:border-accent focus:ring-4 focus:ring-accent/20 outline-none transition-all"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            disabled={loading}
          />
          <button
            id="ingest-btn"
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-gradient-to-br from-accent to-[#8b69ff] text-white font-semibold rounded-xl text-base shadow-[0_4px_20px_rgba(99,135,255,0.25)] hover:shadow-[0_6px_28px_rgba(99,135,255,0.25)] hover:-translate-y-[1px] active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing</>
            ) : (
              <> Analyze</>
            )}
          </button>
        </div>
      </form>

      {(statusMsg || error) && (
        <div className="max-w-[700px] mx-auto mt-5 bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-left">
          {statusMsg && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              {loading && <span className="w-4 h-4 border-2 border-white/10 border-t-accent rounded-full animate-spin shrink-0" />}
              <span>{statusMsg}</span>
            </div>
          )}
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>
      )}
    </section>
  );
}
