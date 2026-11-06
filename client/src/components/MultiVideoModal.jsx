import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { featuresApi } from '../services/api';

export default function MultiVideoModal({ readyVideos, onClose }) {
  const [selectedIds, setSelectedIds] = useState(
    readyVideos.slice(0, 2).map((v) => v.videoId)
  );
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [error, setError] = useState('');

  const toggleSelect = (videoId) => {
    setSelectedIds((prev) =>
      prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [...prev, videoId]
    );
  };

  const handleAsk = async (e) => {
    e?.preventDefault();
    if (!question.trim() || selectedIds.length < 2) return;

    setLoading(true);
    setError('');
    setAnswer('');
    setSources([]);

    try {
      const res = await featuresApi.multiVideoChat(selectedIds, question);
      if (res.data.success) {
        setAnswer(res.data.answer);
        setSources(res.data.sources || []);
      } else {
        setError(res.data.error || 'Failed to analyze multiple videos.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease-out]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Cross-Video Multi-RAG</h3>
              <p className="text-xs text-slate-400">
                Compare or synthesize insights across multiple videos simultaneously
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Video selector bar */}
        <div className="p-4 px-6 border-b border-white/10 bg-slate-950/60 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1">Select Videos (min 2):</span>
          {readyVideos.map((v) => {
            const isSelected = selectedIds.includes(v.videoId);
            return (
              <button
                key={v.videoId}
                type="button"
                onClick={() => toggleSelect(v.videoId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <span>{isSelected ? '✓' : '+'}</span>
                <span className="max-w-[160px] truncate">{v.title !== 'Unknown Title' ? v.title : v.videoId}</span>
              </button>
            );
          })}
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              ⚠ {error}
            </div>
          )}

          {loading && (
            <div className="py-20 text-center space-y-3">
              <span className="inline-block w-8 h-8 border-4 border-slate-700 border-t-accent rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-medium">
                Querying multiple vector stores and synthesizing cross-video response...
              </p>
            </div>
          )}

          {!loading && !answer && !error && (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <span className="text-4xl block">✨</span>
              <p className="text-sm font-medium text-slate-300">Ask a question across your selected videos</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Examples: "Compare how both videos explain the topic", "Which video covers the basics better?", "Summarize the key differences between them"
              </p>
            </div>
          )}

          {answer && (
            <div className="space-y-5">
              <div className="bg-slate-900 border border-white/10 rounded-xl p-5 markdown-content text-slate-200 text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {answer}
                </ReactMarkdown>
              </div>

              {/* Attribution sources */}
              {sources.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Cross-Video Citations ({sources.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sources.map((src, i) => (
                      <div key={i} className="bg-slate-900/60 border border-white/10 rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-accent font-semibold truncate max-w-[180px]">
                            {src.videoLabel}
                          </span>
                          {src.clipUrl && (
                            <a
                              href={src.clipUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-yt-red bg-yt-red/10 px-1.5 py-0.5 rounded text-[10px] hover:bg-yt-red/20 font-semibold"
                            >
                              ▶ {src.timestamp}
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-3">{src.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input bar */}
        <form onSubmit={handleAsk} className="p-4 px-6 border-t border-white/10 bg-slate-950/80 flex gap-2">
          <input
            type="text"
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-slate-200 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
            placeholder={
              selectedIds.length < 2
                ? 'Select at least 2 videos above first...'
                : 'Ask a question comparing or combining these videos...'
            }
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading || selectedIds.length < 2}
          />
          <button
            type="submit"
            disabled={loading || !question.trim() || selectedIds.length < 2}
            className="px-5 py-2.5 bg-gradient-to-r from-accent to-[#8b69ff] text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? 'Searching...' : 'Compare ⚡'}
          </button>
        </form>
      </div>
    </div>
  );
}

