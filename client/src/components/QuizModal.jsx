import { useState, useEffect } from 'react';
import { featuresApi } from '../services/api';

export default function QuizModal({ videoId, videoTitle, onClose }) {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState([]);
  const [error, setError] = useState('');
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    featuresApi.getQuiz(videoId, 5)
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.quiz)) {
          setQuiz(res.data.quiz);
        } else {
          setError('Failed to generate quiz questions.');
        }
      })
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [videoId]);

  const handleSelect = (qIdx, optionKey) => {
    if (showResults) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optionKey }));
  };

  const calculateScore = () => {
    let correct = 0;
    quiz.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.answer) correct++;
    });
    return correct;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease-out]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🎯</span>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Video Knowledge Quiz</h3>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-16 text-center space-y-3">
              <span className="inline-block w-8 h-8 border-4 border-slate-700 border-t-accent rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-medium">Generating questions from video transcript...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              ⚠ {error}
            </div>
          )}

          {!loading && !error && quiz.map((q, idx) => {
            const chosen = selectedAnswers[idx];
            const isCorrect = chosen === q.answer;

            return (
              <div key={idx} className="bg-slate-900/90 border border-white/10 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-sm text-slate-200">
                    <span className="text-accent mr-2 font-mono">Q{idx + 1}.</span>
                    {q.question}
                  </p>
                  {q.timestamp && (
                    <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
                      ⏱ {q.timestamp}
                    </span>
                  )}
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {Object.entries(q.options || {}).map(([key, text]) => {
                    let optionStyle = 'bg-slate-800/60 border-white/5 hover:border-accent/40 text-slate-300';
                    if (chosen === key) {
                      optionStyle = 'bg-accent/20 border-accent text-accent font-medium';
                    }
                    if (showResults) {
                      if (key === q.answer) {
                        optionStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-medium';
                      } else if (chosen === key && !isCorrect) {
                        optionStyle = 'bg-red-500/20 border-red-500 text-red-300 font-medium';
                      }
                    }

                    return (
                      <button
                        key={key}
                        onClick={() => handleSelect(idx, key)}
                        disabled={showResults}
                        className={`text-left p-3 rounded-lg border text-xs transition-all flex items-center gap-2.5 ${optionStyle}`}
                      >
                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold font-mono text-[10px] bg-white/10 shrink-0">
                          {key}
                        </span>
                        <span>{text}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation on results */}
                {showResults && (
                  <div className="pt-2 text-xs text-slate-400 border-t border-white/5 space-y-1">
                    <p className={`font-semibold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isCorrect ? '✓ Correct!' : `✗ Incorrect (Correct answer: ${q.answer})`}
                    </p>
                    {q.explanation && <p className="text-slate-400">{q.explanation}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {!loading && !error && quiz.length > 0 && (
          <div className="p-4 px-6 border-t border-white/10 bg-slate-900/60 flex items-center justify-between">
            {showResults ? (
              <div className="text-sm font-semibold text-slate-200">
                Score: <span className="text-accent text-base">{calculateScore()} / {quiz.length}</span> (
                {Math.round((calculateScore() / quiz.length) * 100)}%)
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                {Object.keys(selectedAnswers).length} of {quiz.length} answered
              </div>
            )}

            <div className="flex gap-2">
              {!showResults ? (
                <button
                  onClick={() => setShowResults(true)}
                  disabled={Object.keys(selectedAnswers).length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-accent to-[#8b69ff] text-white text-xs font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  Submit Answers
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelectedAnswers({});
                    setShowResults(false);
                  }}
                  className="px-4 py-2 bg-slate-800 text-slate-200 border border-white/10 text-xs font-semibold rounded-lg hover:bg-slate-700 transition-all"
                >
                  Retake Quiz
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

