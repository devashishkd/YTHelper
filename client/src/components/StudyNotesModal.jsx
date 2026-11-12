import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_BASE } from '../services/api.js';

export default function StudyNotesModal({ videoId, videoTitle, onClose }) {
  const [notes, setNotes] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchNotes = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/features/study-notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done || isCancelled) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop(); // keep remainder

          for (const line of lines) {
            if (line.startsWith('event: token')) {
              const dataLine = line.split('\n').find((l) => l.startsWith('data: '));
              if (dataLine) {
                const data = JSON.parse(dataLine.replace('data: ', ''));
                if (data.token) {
                  setNotes((prev) => prev + data.token);
                }
              }
            } else if (line.startsWith('event: done')) {
              setIsStreaming(false);
            } else if (line.startsWith('event: error')) {
              const dataLine = line.split('\n').find((l) => l.startsWith('data: '));
              if (dataLine) {
                const data = JSON.parse(dataLine.replace('data: ', ''));
                setError(data.message || 'An error occurred during notes generation.');
              }
              setIsStreaming(false);
            }
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message);
          setIsStreaming(false);
        }
      } finally {
        if (!isCancelled) setIsStreaming(false);
      }
    };

    fetchNotes();

    return () => {
      isCancelled = true;
    };
  }, [videoId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([notes], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(videoTitle || videoId).replace(/[^a-z0-9]/gi, '_')}_Study_Notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease-out]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📚</span>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Structured Study Notes</h3>
              <p className="text-xs text-slate-400 truncate max-w-md">{videoTitle || videoId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              ⚠ {error}
            </div>
          )}

          {!notes && !error && (
            <div className="py-20 text-center space-y-3">
              <span className="inline-block w-8 h-8 border-4 border-slate-700 border-t-accent rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-medium">Extracting topics and synthesizing study notes...</p>
            </div>
          )}

          {notes && (
            <div className="markdown-content text-slate-200 text-sm leading-relaxed prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {notes}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-accent ml-1 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 px-6 border-t border-white/10 bg-slate-900/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {isStreaming ? (
              <span className="inline-flex items-center gap-1.5 text-accent">
                <span className="w-2 h-2 rounded-full bg-accent animate-ping" /> Generating notes...
              </span>
            ) : (
              <span>✓ Notes completed</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              disabled={!notes}
              className="px-3.5 py-1.5 bg-slate-800 text-slate-300 border border-white/10 rounded-lg text-xs font-semibold hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
            >
              {copied ? '✓ Copied!' : '📋 Copy Markdown'}
            </button>
            <button
              onClick={handleDownload}
              disabled={!notes}
              className="px-3.5 py-1.5 bg-gradient-to-r from-accent to-[#8b69ff] text-white rounded-lg text-xs font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              ⬇ Export .md
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

