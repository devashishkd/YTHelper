const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function SourceViewer({ sources }) {
  if (!sources || sources.length === 0) {
    return (
      <aside className="hidden lg:flex w-96 flex-col overflow-hidden bg-[#0d1220] border-l border-white/10 shrink-0">
        <div className="shrink-0 p-4 px-5 border-b border-white/10">
          <p className="text-sm font-bold uppercase tracking-wider text-slate-500">📎 Source Chunks</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex flex-col items-center gap-2 py-8 px-4 text-center text-slate-500 text-sm">
            <span className="text-3xl">🔍</span>
            <p>Source chunks from the transcript will appear here after you ask a question.</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex w-96 flex-col overflow-hidden bg-[#0d1220] border-l border-white/10 shrink-0">
      <div className="shrink-0 p-4 px-5 border-b border-white/10">
        <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
          📎 Source Chunks ({sources.length})
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {sources.map((src, i) => (
          <div key={i} className="bg-slate-900 border border-white/10 rounded-xl p-3.5 transition-colors hover:border-accent/40" id={`source-card-${i}`}>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 bg-accent/10 border border-accent/20 rounded-full text-xs font-semibold text-accent font-mono">
              ⏱ {src.timestamp || formatTime(src.startTime)}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{src.text}</p>
            {src.score !== undefined && (
              <div className="mt-2 text-[0.7rem] text-slate-500 font-mono">
                <span>Relevance: {(src.score * 100).toFixed(0)}%</span>
                <div className="h-1 bg-slate-800 rounded-sm mt-1 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-[#8b69ff] rounded-sm transition-all duration-500"
                    style={{ width: `${Math.min(src.score * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
