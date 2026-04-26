'use client';

import { useState, useEffect } from 'react';
import ChatPanel from './ChatPanel';

interface ChatDockProps {
  sessionId: string;
  hasAnalysis: boolean;
}

export default function ChatDock({ sessionId, hasAnalysis }: ChatDockProps) {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  // 분석이 막 완료되면 닫혀있는 버튼에 pulse 효과로 새 기능 안내.
  useEffect(() => {
    if (hasAnalysis && !open) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 6000);
      return () => clearTimeout(t);
    }
  }, [hasAnalysis, open]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-all ${
          open
            ? 'bg-zinc-700 hover:bg-zinc-600'
            : 'bg-sky-500 hover:bg-sky-400'
        }`}
      >
        {open ? (
          <>
            <span>닫기</span>
            <span className="text-base leading-none">✕</span>
          </>
        ) : (
          <>
            <span className="text-base leading-none">💬</span>
            <span>공공데이터 Q&A</span>
            {pulse && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400"></span>
              </span>
            )}
          </>
        )}
      </button>

      {/* Slide-in panel */}
      <div
        className={`fixed bottom-20 right-5 z-30 w-[min(92vw,380px)] h-[min(70vh,560px)] rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="shrink-0 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-100">공공데이터 Q&A</p>
          <p className="text-[11px] text-zinc-500">HIRA · KOSIS · MediSim 분석 결과 기반</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel sessionId={sessionId} hasState={hasAnalysis} />
        </div>
      </div>
    </>
  );
}
