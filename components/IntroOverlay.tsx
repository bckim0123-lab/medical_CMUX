'use client';

import { useState } from 'react';

interface IntroOverlayProps {
  onDismiss: () => void;
}

export default function IntroOverlay({ onDismiss }: IntroOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  const dismiss = () => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 600);
  };

  if (!visible) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="relative z-10 text-center px-8 max-w-2xl">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 bg-sky-500/20 border border-sky-500/40 rounded-full px-4 py-1.5 text-sky-300 text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Multi-Agent AI Platform
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            MediSim Orchestrator
          </h1>
          <p className="text-zinc-300 text-lg leading-relaxed">
            다중 에이전트가 분석하는<br />
            <span className="text-sky-300 font-semibold">서울시 필수 의료 공백 지대</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8 text-left">
          {[
            { icon: '📡', label: 'Data Agent', desc: 'HIRA · KOSIS 공공데이터 수집' },
            { icon: '🗺️', label: 'Spatial Agent', desc: '골든타임 커버리지 공간 분석' },
            { icon: '🏛️', label: 'Policy Agent', desc: '정책 시나리오 ROI 시뮬레이션' },
            { icon: '📝', label: 'Editor Agent', desc: 'B2G 정책 제언 보고서 생성' },
          ].map((a) => (
            <div key={a.label} className="flex items-start gap-2.5 bg-white/5 border border-white/10 rounded-lg p-3">
              <span className="text-xl">{a.icon}</span>
              <div>
                <p className="text-white text-xs font-semibold">{a.label}</p>
                <p className="text-zinc-400 text-xs">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={dismiss}
          className="bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-semibold px-10 py-3 rounded-full text-sm transition-all shadow-lg shadow-sky-500/30 hover:shadow-sky-400/40"
        >
          분석 시작하기 →
        </button>
        <p className="text-zinc-600 text-xs mt-3">
          GEMINI_API_KEY 없이도 Mock 데이터로 전체 파이프라인 시연 가능
        </p>
      </div>
    </div>
  );
}
