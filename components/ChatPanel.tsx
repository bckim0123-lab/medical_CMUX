'use client';

import { useCallback, useRef, useState } from 'react';

type Role = 'user' | 'assistant';
type UIMessage = {
  id: string;
  role: Role;
  text: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  pending?: boolean;
};

type ChatStreamEvent =
  | { type: 'tool'; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; name: string; resultPreview: string }
  | { type: 'text'; delta: string }
  | { type: 'done'; text: string }
  | { type: 'error'; message: string };

interface ChatPanelProps {
  sessionId: string;
  hasState: boolean;
}

const SUGGESTIONS = [
  '취약 자치구 Top 3',
  '강남구 vs 마포구 영유아당 의원수',
  '은평구 정책 대안 비교',
];

export default function ChatPanel({ sessionId, hasState }: ChatPanelProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const submit = useCallback(
    async (override?: string) => {
      const text = (override ?? input).trim();
      if (!text || busy) return;
      const userMsg: UIMessage = { id: `u-${Date.now()}`, role: 'user', text };
      const assistantMsg: UIMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: '',
        toolCalls: [],
        pending: true,
      };
      const nextHistory = [...messages, userMsg];
      setMessages([...nextHistory, assistantMsg]);
      setInput('');
      setBusy(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            messages: nextHistory.map((m) => ({ role: m.role, content: m.text })),
          }),
        });
        if (!res.body) throw new Error('스트림이 없습니다');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        const updateAssistant = (mut: (m: UIMessage) => UIMessage) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? mut(m) : m)),
          );
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const chunk of parts) {
            const line = chunk.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            try {
              const evt = JSON.parse(line.slice(6)) as ChatStreamEvent;
              if (evt.type === 'tool') {
                updateAssistant((m) => ({
                  ...m,
                  toolCalls: [...(m.toolCalls ?? []), { name: evt.name, args: evt.args }],
                }));
              } else if (evt.type === 'done') {
                updateAssistant((m) => ({ ...m, text: evt.text, pending: false }));
              } else if (evt.type === 'error') {
                updateAssistant((m) => ({
                  ...m,
                  text: `⚠ ${evt.message}`,
                  pending: false,
                }));
              }
            } catch {
              // ignore parse error
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, text: `⚠ 통신 실패: ${msg}`, pending: false } : m,
          ),
        );
      } finally {
        setBusy(false);
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
        });
      }
    },
    [input, busy, messages, sessionId],
  );

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 leading-5">
              공공데이터(HIRA · KOSIS) 기반으로 답변드려요. 일반 의료·진단 질문은 답변 못 해요.
            </p>
            {!hasState && (
              <p className="text-[11px] text-amber-400">
                먼저 "분석 시작"을 눌러 분석 결과를 만든 뒤 질문하시면 더 정확해요.
              </p>
            )}
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  disabled={busy}
                  className="w-full text-left text-[11px] text-zinc-300 bg-zinc-800/60 hover:bg-zinc-800 rounded px-2.5 py-1.5 disabled:opacity-50"
                >
                  💬 {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={
                m.role === 'user'
                  ? 'inline-block max-w-[85%] bg-sky-600 text-white text-[12px] leading-5 px-3 py-1.5 rounded-lg rounded-tr-sm'
                  : 'inline-block max-w-[90%] bg-zinc-800 text-zinc-100 text-[12px] leading-5 px-3 py-2 rounded-lg rounded-tl-sm'
              }
            >
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mb-1.5 space-y-0.5">
                  {m.toolCalls.map((t, i) => (
                    <div key={i} className="text-[10px] text-fuchsia-300 font-mono">
                      ⚙ {t.name}({Object.entries(t.args).map(([k, v]) => `${k}="${v}"`).join(', ')})
                    </div>
                  ))}
                </div>
              )}
              {m.pending && !m.text ? (
                <span className="text-zinc-400">생각하는 중…</span>
              ) : (
                <span className="whitespace-pre-wrap">{m.text}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-zinc-800 p-2.5 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          className="flex-1 rounded bg-zinc-800 px-3 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-500 disabled:opacity-50"
          placeholder={hasState ? '예: 마포구 의원 몇 개?' : '먼저 분석 시작…'}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded bg-sky-500 px-3 text-[12px] font-medium text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          전송
        </button>
      </form>
    </div>
  );
}
