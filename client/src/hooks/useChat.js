import { useState, useCallback, useRef } from 'react';

/**
 * Parses a raw SSE message block (between double newlines) into { event, data }.
 */
const parseSSEBlock = (block) => {
  const lines = block.split('\n');
  let event = 'message';
  let dataStr = '';
  for (const line of lines) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    if (line.startsWith('data: '))  dataStr = line.slice(6).trim();
  }
  try { return { event, data: JSON.parse(dataStr) }; }
  catch { return null; }
};

/**
 * useChat — SSE streaming chat hook.
 * Manages messages, sources, streaming state, and session.
 */
export const useChat = (videoId) => {
  const [messages, setMessages]      = useState([]);
  const [sources, setSources]        = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText]  = useState('');
  const [sessionId, setSessionId]    = useState(null);

  const abortRef = useRef(null);

  const sendMessage = useCallback(
    async (question) => {
      if (!question.trim() || isStreaming) return;

      // ── Add user message ──────────────────────────────────────────────
      setMessages((prev) => [...prev, { role: 'user', content: question, id: Date.now() }]);
      setIsStreaming(true);
      setStatusText('Thinking...');
      setSources([]);

      // ── Streaming assistant message placeholder ────────────────────────
      const assistantMsgId = Date.now() + 1;
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', streaming: true },
      ]);

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, question, sessionId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(err.error || 'Chat request failed');
        }

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = '';
        let fullAnswer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE blocks are separated by double newline
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop(); // Keep incomplete block

          for (const block of blocks) {
            if (!block.trim()) continue;
            const parsed = parseSSEBlock(block);
            if (!parsed) continue;
            const { event, data } = parsed;

            if (event === 'token') {
              fullAnswer += data.token;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullAnswer } : m))
              );
              setStatusText('');

            } else if (event === 'status') {
              setStatusText(data.message || '');

            } else if (event === 'sources') {
              setSources(data.sources || []);

            } else if (event === 'verification') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        isGrounded: data.isGrounded,
                        verificationStatus: data.verificationStatus,
                        warning: data.warning,
                      }
                    : m
                )
              );

            } else if (event === 'done') {
              if (data.sessionId) setSessionId(data.sessionId);
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, streaming: false } : m))
              );

            } else if (event === 'error') {
              throw new Error(data.message || 'Unknown error');
            }
          }
        }

        // Finalize — mark as done if not already
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId && m.streaming ? { ...m, streaming: false } : m))
        );

      } catch (err) {
        if (err.name === 'AbortError') {
          // Mark as stopped
          setMessages((prev) =>
            prev.map((m) =>
              m.id && m.streaming ? { ...m, streaming: false, content: m.content + ' *(stopped)*' } : m
            )
          );
          return;
        }
        console.error('[useChat] Error:', err.message);
        setMessages((prev) =>
          prev.map((m) =>
            m.streaming
              ? { ...m, streaming: false, content: `❌ ${err.message}` }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
        setStatusText('');
      }
    },
    [videoId, sessionId, isStreaming]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setSources([]);
    setSessionId(null);
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    sources,
    isStreaming,
    statusText,
    sessionId,
    sendMessage,
    clearChat,
    stopStreaming,
  };
};
