'use client';

import { useState } from 'react';

type AgentEvent = {
  type: string;
  agent?: string;
  message?: string;
  patch?: unknown;
  state?: { region: string; report?: string };
};

const AGENT_LABEL: Record<string, string> = {
  data: 'Data',
  spatial: 'Spatial',
  policy: 'Policy',
  editor: 'Editor',
  done: 'Done',
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
    <div className="flex h-screen flex-col bg-zinc-50 text-zinc-900">
      {/* Top header */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">MediSim Orchestrator</h1>
          <p className="text-xs text-zinc-500">다중 에이전트가 분석하는 서울시 필수 의료 공백 지대</p>
        </div>
        <nav className="flex gap-4 text-sm text-zinc-600">
          <a
            href="https://github.com/bckim0123-lab/medical_CMUX"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-900"
          >
            GitHub
          </a>
          <a
            href="https://github.com/bckim0123-lab/medical_CMUX/blob/main/docs/PRD.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-900"
          >
            PRD
          </a>
          <a
            href="https://github.com/bckim0123-lab/medical_CMUX/blob/main/docs/api-contract.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-900"
          >
            API
          </a>
        </nav>
      </header>

      {/* 3-pane workspace */}
      <div className="grid flex-1 grid-cols-[30%_40%_30%] overflow-hidden">
        {/* Left: Agent activity log */}
        <aside className="flex flex-col overflow-hidden border-r border-zinc-200 bg-zinc-900 text-zinc-100">
          <div className="flex gap-2 border-b border-zinc-800 p-3">
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="flex-1 rounded bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="지역명 (예: 서울특별시)"
            />
            <button
              onClick={start}
              disabled={running}
              className="whitespace-nowrap rounded bg-emerald-500 px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? '실행 중...' : '분석 시작'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5">
            {events.length === 0 ? (
              <p className="text-zinc-500">
                "분석 시작"을 누르면 4개 에이전트의 작업 로그가 여기에 실시간으로 흐릅니다.
              </p>
            ) : (
              events.map((evt, i) => (
                <div key={i} className="mb-0.5">
                  <span className="text-emerald-400">
                    [{AGENT_LABEL[evt.agent ?? evt.type] ?? evt.agent ?? evt.type}]
                  </span>{' '}
                  <span className="text-zinc-300">{evt.message ?? evt.type}</span>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Center: Map placeholder */}
        <section className="flex flex-col border-r border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Live Render Map
          </h2>
          <div className="flex flex-1 flex-col items-center justify-center rounded border border-dashed border-zinc-300 text-center text-sm text-zinc-400">
            <p>MapLibre GL JS 영역</p>
            <p className="mt-1 text-xs">팀원 작업 — 마커 / 버퍼 / 취약 구역 폴리곤</p>
          </div>
        </section>

        {/* Right: Final report */}
        <aside className="overflow-y-auto bg-white p-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            최종 정책 제언 리포트
          </h2>
          {report ? (
            <pre className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">{report}</pre>
          ) : (
            <p className="text-sm text-zinc-400">오케스트레이션 종료 후 Editor Agent가 발행한 마크다운 리포트가 여기에 표시됩니다.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
