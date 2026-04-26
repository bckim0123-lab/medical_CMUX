'use client';

import { useState } from 'react';

type GuCoverage = {
  gu: string;
  hospitalCount: number;
  populationU5: number;
  uncoveredPopulationU5: number;
  uncoveredRatio: number;
  riskGrade: 'High' | 'Mid' | 'Low';
};

type CoverageSummary = {
  bufferKm: number;
  vulnerableAreaKm2: number;
  totalAreaKm2: number;
  vulnerableRatio: number;
  riskGrade: 'High' | 'Mid' | 'Low';
  byGu: GuCoverage[];
};

type AgentEvent = {
  type: 'log' | 'tool' | 'state' | 'error' | 'done';
  agent?: string;
  message?: string;
  tool?: string;
  patch?: { coverage?: CoverageSummary };
  state?: { region: string; report?: string; coverage?: CoverageSummary; options?: unknown[] };
};

const AGENT_LABEL: Record<string, string> = {
  data: 'Data',
  spatial: 'Spatial',
  policy: 'Policy',
  editor: 'Editor',
  done: 'Done',
};

const GRADE_STYLE: Record<string, string> = {
  High: 'bg-red-100 text-red-700 ring-red-200',
  Mid: 'bg-amber-100 text-amber-700 ring-amber-200',
  Low: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

export default function Home() {
  const [region, setRegion] = useState('서울특별시');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [report, setReport] = useState('');
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);
  const [optionsCount, setOptionsCount] = useState(0);
  const [running, setRunning] = useState(false);

  const start = () => {
    setEvents([]);
    setReport('');
    setCoverage(null);
    setOptionsCount(0);
    setRunning(true);
    const es = new EventSource(`/api/orchestrate?region=${encodeURIComponent(region)}`);
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data) as AgentEvent;
      setEvents((prev) => [...prev, evt]);
      if (evt.type === 'state' && evt.patch?.coverage) {
        setCoverage(evt.patch.coverage);
      }
      if (evt.type === 'done') {
        setReport(evt.state?.report ?? '');
        if (evt.state?.coverage) setCoverage(evt.state.coverage);
        setOptionsCount(evt.state?.options?.length ?? 0);
        setRunning(false);
        es.close();
      }
    };
    es.onerror = () => {
      setRunning(false);
      es.close();
    };
  };

  const tagColor = (type: string) => {
    if (type === 'tool') return 'text-fuchsia-400';
    if (type === 'error') return 'text-red-400';
    if (type === 'state') return 'text-sky-400';
    if (type === 'done') return 'text-emerald-300';
    return 'text-emerald-400';
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50 text-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">MediSim Orchestrator</h1>
          <p className="text-xs text-zinc-500">다중 에이전트가 분석하는 서울시 필수 의료 공백 지대</p>
        </div>
        <nav className="flex gap-4 text-sm text-zinc-600">
          <a href="https://github.com/bckim0123-lab/medical_CMUX" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">GitHub</a>
          <a href="https://github.com/bckim0123-lab/medical_CMUX/blob/main/docs/PRD.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">PRD</a>
          <a href="https://github.com/bckim0123-lab/medical_CMUX/blob/main/docs/api-contract.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">API</a>
        </nav>
      </header>

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
              <p className="text-zinc-500">"분석 시작"을 누르면 4개 에이전트의 작업 로그가 여기에 실시간으로 흐릅니다.</p>
            ) : (
              events.map((evt, i) => (
                <div key={i} className="mb-0.5">
                  <span className={tagColor(evt.type)}>
                    [{evt.type === 'tool' ? `tool:${evt.tool}` : AGENT_LABEL[evt.agent ?? evt.type] ?? evt.agent ?? evt.type}]
                  </span>{' '}
                  <span className="text-zinc-300">{evt.message ?? evt.type}</span>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Center: Map placeholder (팀원 영역) */}
        <section className="flex flex-col border-r border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Live Render Map</h2>
          <div className="flex flex-1 flex-col items-center justify-center rounded border border-dashed border-zinc-300 text-center text-sm text-zinc-400">
            <p>MapLibre GL JS 영역</p>
            <p className="mt-1 text-xs">팀원 작업 — 마커 / 버퍼 / 취약 구역 폴리곤</p>
          </div>
        </section>

        {/* Right: Summary + Report */}
        <aside className="flex flex-col overflow-hidden bg-white">
          {/* Summary */}
          <div className="border-b border-zinc-200 bg-zinc-50 p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">분석 요약</h2>
            {coverage ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-500">종합 위험도</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ring-1 ${GRADE_STYLE[coverage.riskGrade]}`}>
                    {coverage.riskGrade}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-zinc-500">취약 면적</div>
                    <div className="font-semibold text-zinc-900">{coverage.vulnerableAreaKm2.toFixed(1)}㎢</div>
                    <div className="text-zinc-400">{(coverage.vulnerableRatio * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">반경 기준</div>
                    <div className="font-semibold text-zinc-900">{coverage.bufferKm}km</div>
                    <div className="text-zinc-400">정책 대안 {optionsCount}건</div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-zinc-500">취약 자치구 Top 5</div>
                  <ul className="space-y-1">
                    {coverage.byGu.slice(0, 5).map((g) => (
                      <li key={g.gu} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-800">
                          {g.gu}
                          <span className="ml-1 text-zinc-400">({g.hospitalCount}개소)</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-zinc-500">{(g.uncoveredRatio * 100).toFixed(0)}%</span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${GRADE_STYLE[g.riskGrade]}`}>
                            {g.riskGrade}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">분석 시작 후 Spatial Agent가 결과를 산출하면 여기에 핵심 지표가 표시됩니다.</p>
            )}
          </div>

          {/* Report */}
          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">최종 정책 제언 리포트</h2>
            {report ? (
              <article className="prose-sm whitespace-pre-wrap text-xs leading-5 text-zinc-800">
                {report}
              </article>
            ) : (
              <p className="text-xs text-zinc-400">오케스트레이션 종료 후 Editor Agent가 발행한 마크다운 리포트가 여기에 표시됩니다.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
