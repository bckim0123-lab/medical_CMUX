'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import AgentLog, { LogEntry } from '@/components/AgentLog';
import ReportView from '@/components/ReportView';
import ChatPanel from '@/components/ChatPanel';
import type { MapState } from '@/components/MapView';
import type { Hospital, CoverageResult, PolicyOption } from '@/lib/state';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

type LeftTab = 'log' | 'chat';

type AgentEvent = {
  type: 'log' | 'tool' | 'state' | 'error' | 'done';
  agent?: string;
  message?: string;
  tool?: string;
  args?: Record<string, unknown>;
  patch?: {
    hospitals?: Hospital[];
    coverage?: CoverageResult;
    options?: PolicyOption[];
    report?: string;
  };
  state?: {
    region: string;
    hospitals?: Hospital[];
    coverage?: CoverageResult;
    options?: PolicyOption[];
    report?: string;
  };
};

export default function Home() {
  const [region, setRegion] = useState('서울특별시');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mapState, setMapState] = useState<MapState>({});
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);
  const [optionsCount, setOptionsCount] = useState(0);
  const [report, setReport] = useState('');
  const [leftTab, setLeftTab] = useState<LeftTab>('log');
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const sessionId = useMemo(() => `s-${Math.random().toString(36).slice(2, 10)}`, []);

  const appendLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const handleStart = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([]);
    setMapState({});
    setCoverage(null);
    setOptionsCount(0);
    setReport('');

    const es = new EventSource(
      `/api/orchestrate?region=${encodeURIComponent(region)}&sessionId=${encodeURIComponent(sessionId)}`,
    );
    esRef.current = es;

    es.onmessage = (e) => {
      const evt: AgentEvent = JSON.parse(e.data);
      const agent = evt.agent ?? evt.type;

      if (evt.type === 'log') {
        appendLog({ tag: agent, text: evt.message ?? '', kind: 'log' });
      } else if (evt.type === 'tool') {
        const args = evt.args
          ? Object.entries(evt.args).map(([k, v]) => `${k}="${v}"`).join(', ')
          : '';
        appendLog({ tag: `tool:${evt.tool}`, text: args || (evt.tool ?? ''), kind: 'tool' });
      } else if (evt.type === 'state') {
        if (evt.patch?.hospitals?.length) {
          setMapState((prev) => ({ ...prev, hospitals: evt.patch!.hospitals }));
        }
        if (evt.patch?.coverage) {
          setMapState((prev) => ({ ...prev, coverage: evt.patch!.coverage }));
          setCoverage(evt.patch.coverage!);
        }
        if (evt.patch?.options?.length) {
          setOptionsCount(evt.patch.options.length);
        }
        if (evt.patch?.report) {
          setReport(evt.patch.report);
        }
      } else if (evt.type === 'error') {
        appendLog({ tag: evt.agent ?? 'error', text: evt.message ?? '', kind: 'error' });
      } else if (evt.type === 'done') {
        const s = evt.state;
        if (s?.hospitals?.length) setMapState((prev) => ({ ...prev, hospitals: s.hospitals }));
        if (s?.coverage) { setMapState((prev) => ({ ...prev, coverage: s.coverage })); setCoverage(s.coverage!); }
        if (s?.options?.length) setOptionsCount(s.options.length);
        if (s?.report) setReport(s.report);
        appendLog({ tag: 'done', text: '오케스트레이션 완료 — Q&A 탭에서 추가 질문 가능', kind: 'done' });
        setHasAnalysis(true);
        setIsRunning(false);
        es.close();
      }
    };

    es.onerror = () => {
      setIsRunning(false);
      es.close();
    };
  }, [isRunning, region, appendLog]);

  const handleStop = useCallback(() => {
    esRef.current?.close();
    setIsRunning(false);
    appendLog({ tag: 'orchestrator', text: '분석이 중지되었습니다.', kind: 'error' });
  }, [appendLog]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <header className="flex items-center justify-between px-5 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-sky-600 rounded flex items-center justify-center text-white text-xs font-bold">M</div>
          <div>
            <h1 className="text-zinc-100 font-semibold text-sm">MediSim Orchestrator</h1>
            <p className="text-zinc-500 text-xs">다중 에이전트가 분석하는 서울시 필수 의료 공백 지대</p>
          </div>
        </div>
        <nav className="flex items-center gap-4 text-xs text-zinc-500">
          {isRunning && (
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              분석 실행 중
            </span>
          )}
          <a href="https://github.com/bckim0123-lab/medical_CMUX" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">GitHub</a>
          <a href="https://github.com/bckim0123-lab/medical_CMUX/blob/main/docs/PRD.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">PRD</a>
          <a href="https://github.com/bckim0123-lab/medical_CMUX/blob/main/docs/api-contract.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">API</a>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[30%] border-r border-zinc-800 overflow-hidden flex flex-col">
          <div className="flex border-b border-zinc-800 bg-zinc-900 text-xs">
            <button
              onClick={() => setLeftTab('log')}
              className={`flex-1 py-2.5 text-center transition-colors ${
                leftTab === 'log'
                  ? 'text-zinc-100 border-b-2 border-sky-500 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              에이전트 활동 로그
            </button>
            <button
              onClick={() => setLeftTab('chat')}
              className={`flex-1 py-2.5 text-center transition-colors flex items-center justify-center gap-1 ${
                leftTab === 'chat'
                  ? 'text-zinc-100 border-b-2 border-sky-500 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              공공데이터 Q&A
              {hasAnalysis && leftTab !== 'chat' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          </div>
          {leftTab === 'log' ? (
            <AgentLog
              logs={logs}
              isRunning={isRunning}
              region={region}
              onRegionChange={setRegion}
              onStart={handleStart}
              onStop={handleStop}
            />
          ) : (
            <ChatPanel sessionId={sessionId} hasState={hasAnalysis} />
          )}
        </div>

        <div className="w-[40%] border-r border-zinc-800 overflow-hidden">
          <MapView mapState={mapState} />
        </div>

        <div className="w-[30%] overflow-hidden flex flex-col">
          <ReportView
            report={report}
            coverage={coverage}
            optionsCount={optionsCount}
            isRunning={isRunning}
          />
        </div>
      </div>
    </div>
  );
}
