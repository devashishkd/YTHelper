import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';
import SourceViewer from '../components/SourceViewer';
import { useChat } from '../hooks/useChat';
import { videoApi } from '../services/api';

export default function Chat() {
  const { videoId } = useParams();
  const location    = useLocation();
  const navigate    = useNavigate();

  const [video, setVideo]   = useState(location.state?.video || null);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(!location.state?.video);

  const { messages, sources, isStreaming, statusText, sendMessage, clearChat } = useChat(videoId);

  // Load video if not passed via navigation state
  useEffect(() => {
    if (!video) {
      videoApi.getStatus(videoId)
        .then((res) => setVideo(res.data.video))
        .catch(() => navigate('/'))
        .finally(() => setLoading(false));
    }
  }, [videoId]);

  const handleSend = (question) => {
    if (!question.trim()) return;
    setInput('');
    sendMessage(question);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <span className="w-8 h-8 border-4 border-slate-700 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!video || video.status !== 'ready') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-4">
        <p className="text-slate-500">
          {video ? `Video is ${video.status}. Please wait or go back.` : 'Video not found.'}
        </p>
        <Link to="/" className="px-4 py-2 text-sm font-semibold text-slate-400 border border-white/10 rounded-md hover:text-slate-200 hover:border-accent/40 hover:bg-slate-800 transition-all">
          ← Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden w-full">
      {/* Main Chat Column */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="shrink-0 p-4 px-6 border-b border-white/10 bg-[#0d1220] flex items-center gap-3">
          <Link to="/" className="p-2 text-slate-400 border border-white/10 rounded-md hover:text-slate-200 hover:border-accent/40 hover:bg-slate-800 transition-all" title="Back to library">←</Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">
              {video.title !== 'Unknown Title' ? video.title : videoId}
            </p>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 truncate hover:text-accent transition-colors block"
            >
              {video.url}
            </a>
          </div>
          <button
            id="clear-chat-btn"
            className="px-3.5 py-1.5 text-sm font-semibold text-slate-400 border border-white/10 rounded-md hover:text-slate-200 hover:border-accent/40 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={clearChat}
            disabled={isStreaming || messages.length === 0}
          >
            Clear
          </button>
        </header>

        {/* Chat window */}
        <ChatWindow
          messages={messages}
          isStreaming={isStreaming}
          statusText={statusText}
          onSendMessage={handleSend}
          inputValue={input}
          onInputChange={setInput}
        />
      </main>

      {/* Source Panel */}
      <SourceViewer sources={sources} />
    </div>
  );
}
