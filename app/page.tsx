'use client';

import { useState } from 'react';

type AgentEvent = {
  type: string;
  agent?: string;
  message?: string;
  patch?: unknown;
  state?: { region: string; report?: string };
};

export default function Home() {
  const [region, setRegion] = useState('서울특별시');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [report, setReport] = useState<string>('');
  const [running, setRunning] = useState(false);

  const start = () => {
    setEvents([]);
    setReport('');
    setRunning(true);
    const es = new EventSource(`/api/orchestrate?region=${encodeURIComponent(region)}`);
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data) as AgentEvent;
      setEvents((prev) => [...prev, evt]);
      if (evt.type === 'done') {
        setReport(evt.state?.report ?? '');
        setRunning(false);
        es.close();
      }
    };
    es.onerror = () => {
      setRunning(false);
      es.close();
    };
  };

  return (
    <div className="grid h-screen grid-cols-[30%_40%_30%] bg-zinc-50 text-zinc-900">
      {/* Left: Agent activity log */}
      <aside className="overflow-y-auto border-r border-zinc-200 bg-zinc-900 p-4 font-mono text-xs text-zinc-100">
        <div className="mb-3 flex gap-2">
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="flex-1 rounded bg-zinc-800 px-2 py-1 text-zinc-100"
            placeholder="지역명"
          />
          <button
            onClick={start}
            disabled={running}
            className="rounded bg-emerald-500 px-3 py-1 text-zinc-900 disabled:opacity-50"
          >
            {running ? '실행중' : '시작'}
          </button>
        </div>
        {events.map((evt, i) => (
          <div key={i} className="mb-1">
            <span className="text-emerald-400">[{evt.agent ?? evt.type}]</span> {evt.message ?? evt.type}
          </div>
        ))}
      </aside>

      {/* Center: Map placeholder */}
      <section className="border-r border-zinc-200 bg-white p-4">
        <div className="flex h-full items-center justify-center rounded border border-dashed border-zinc-300 text-zinc-400">
          MapLibre GL JS — 팀원 영역
        </div>
      </section>

      {/* Right: Final report */}
      <aside className="overflow-y-auto bg-white p-6">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">최종 정책 제언 리포트</h2>
        <pre className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">{report || '— 오케스트레이션 종료 후 표시됨 —'}</pre>
      </aside>
    </div>
  );
}
