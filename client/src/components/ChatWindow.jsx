import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PROMPT_CHIPS = [
  '📝 Summarize this video',
  '📋 What topics are covered?',
  '🕐 What happens at the 5 minute mark?',
  '💡 What are the key takeaways?',
  '🎯 Who is the target audience?',
];

const MessageBubble = ({ message }) => (
  <div className={`flex gap-3 max-w-[90%] animate-[slideUp_0.2s_ease-out] ${message.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
    <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-sm mt-0.5 ${
      message.role === 'user' 
        ? 'bg-gradient-to-br from-accent to-[#8b69ff]' 
        : 'bg-gradient-to-br from-yt-red to-[#ff6b6b] shadow-[0_0_40px_rgba(255,69,69,0.15)]'
    }`}>
      {message.role === 'user' ? '👤' : '🤖'}
    </div>
    
    <div className={`px-4 py-3.5 rounded-2xl text-sm leading-relaxed relative ${
      message.role === 'user'
        ? 'bg-gradient-to-br from-accent/20 to-indigo-500/20 border border-accent/30 text-slate-200 rounded-br-md'
        : 'bg-slate-900 border border-white/10 text-slate-200 rounded-bl-md markdown-content'
    }`}>
      {message.role === 'assistant' ? (
        <>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || ' '}
          </ReactMarkdown>
          {message.streaming && <span className="inline-block w-0.5 h-[1em] bg-accent ml-0.5 align-text-bottom animate-blink" />}
        </>
      ) : (
        <span>{message.content}</span>
      )}
    </div>
  </div>
);

export default function ChatWindow({
  messages,
  isStreaming,
  statusText,
  onSendMessage,
  inputValue,
  onInputChange,
}) {
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage(inputValue);
    }
  };

  const handleChip = (chip) => {
    // Strip emoji prefix
    const text = chip.replace(/^[^\s]+\s/, '');
    onSendMessage(text);
  };

  return (
    <>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10">
            <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-indigo-500/20 border border-accent/30 rounded-3xl flex items-center justify-center text-3xl">💬</div>
            <h3 className="text-xl font-bold">Start asking questions</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Ask about topics, timestamps, summaries, or anything mentioned in the video.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {PROMPT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  className="px-3.5 py-2 bg-slate-900 border border-white/10 rounded-full text-xs text-slate-400 cursor-pointer transition-all hover:border-accent/40 hover:text-accent hover:bg-slate-800 disabled:opacity-50"
                  onClick={() => handleChip(chip)}
                  disabled={isStreaming}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {statusText && (
          <div className="flex items-center gap-2 px-2 text-xs text-slate-500">
            <span className="w-3 h-3 border-2 border-slate-700 border-t-accent rounded-full animate-spin shrink-0" />
            {statusText}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 p-4 px-6 border-t border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="flex items-end gap-2.5">
          <textarea
            id="chat-input"
            ref={inputRef}
            className="flex-1 min-h-[44px] max-h-[140px] px-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-slate-200 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none resize-none leading-relaxed"
            placeholder="Ask anything about this video… (Enter to send, Shift+Enter for newline)"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            rows={1}
          />
          <button
            id="send-btn"
            className="inline-flex shrink-0 items-center justify-center w-11 h-11 bg-gradient-to-br from-accent to-[#8b69ff] text-white rounded-xl shadow-[0_4px_20px_rgba(99,135,255,0.25)] hover:shadow-[0_6px_28px_rgba(99,135,255,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onSendMessage(inputValue)}
            disabled={isStreaming || !inputValue.trim()}
          >
            {isStreaming ? '⏳' : '➤'}
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
