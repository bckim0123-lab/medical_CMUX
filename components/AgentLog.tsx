'use client';

import { useEffect, useRef } from 'react';

export interface LogEntry {
  tag: string;
  text: string;
  kind: 'log' | 'tool' | 'error' | 'state' | 'done';
}

interface AgentLogProps {
  logs: LogEntry[];
  isRunning: boolean;
  region: string;
  onRegionChange: (v: string) => void;
  onStart: () => void;
  onStop: () => void;
}

const TAG_COLOR: Record<string, string> = {
  data: 'text-sky-400',
  spatial: 'text-emerald-400',
  policy: 'text-yellow-400',
  editor: 'text-orange-400',
  done: 'text-emerald-300',
  error: 'text-red-400',
};

const KIND_COLOR: Record<string, string> = {
  tool: 'text-fuchsia-400',
  error: 'text-red-400',
  state: 'text-sky-400',
  done: 'text-emerald-300',
  log: '',
};

function tagColor(tag: string, kind: string) {
  if (kind !== 'log') return KIND_COLOR[kind] ?? 'text-zinc-400';
  return TAG_COLOR[tag] ?? 'text-zinc-400';
}

export default function AgentLog({ logs, isRunning, region, onRegionChange, onStart, onStop }: AgentLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-zinc-800">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">에이전트 활동 로그</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={region}
            onChange={(e) => onRegionChange(e.target.value)}
            disabled={isRunning}
            placeholder="지역명 입력..."
            className="flex-1 min-w-0 bg-zinc-800 text-zinc-100 text-sm px-3 py-1.5 rounded border border-zinc-700 focus:outline-none focus:border-sky-500 disabled:opacity-50"
          />
          <button
            onClick={isRunning ? onStop : onStart}
            className={`shrink-0 px-4 py-1.5 rounded text-sm font-semibold transition-colors ${
              isRunning
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-900'
            }`}
          >
            {isRunning ? '중지' : '분석 시작'}
          </button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {(['data', 'spatial', 'policy', 'editor'] as const).map((a) => (
            <span key={a} className={`text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 ${TAG_COLOR[a]}`}>
              {a}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5 space-y-0.5">
        {logs.length === 0 ? (
          <p className="text-zinc-600 mt-6 text-center">"분석 시작"을 누르면 4개 에이전트의<br />작업 로그가 실시간으로 흐릅니다.</p>
        ) : (
          logs.map((l, i) => (
            <div key={i}>
              <span className={tagColor(l.tag, l.kind)}>[{l.tag}]</span>{' '}
              <span className="text-zinc-300">{l.text}</span>
            </div>
          ))
        )}
        {isRunning && <span className="text-zinc-500 animate-pulse">▋</span>}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
