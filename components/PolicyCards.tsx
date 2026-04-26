'use client';

import type { PolicyOption } from '@/lib/state';

const TYPE_ICON: Record<PolicyOption['type'], string> = {
  NewCenter: '🏥',
  ShuttleLink: '🚐',
  TelemedHub: '📡',
};

const TYPE_LABEL: Record<PolicyOption['type'], string> = {
  NewCenter: '신규 센터',
  ShuttleLink: '셔틀 운영',
  TelemedHub: '원격진료',
};

interface PolicyCardsProps {
  options: PolicyOption[];
  activeOptionId: string | null;
  onApply: (opt: PolicyOption) => void;
  onReset: () => void;
}

export default function PolicyCards({ options, activeOptionId, onApply, onReset }: PolicyCardsProps) {
  if (options.length === 0) return null;

  return (
    <div className="border-b border-zinc-800 bg-zinc-900 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          정책 대안 {options.length}건 · 클릭해서 시뮬
        </p>
        {activeOptionId && (
          <button
            onClick={onReset}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
          >
            원래대로
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        {options.map((o) => {
          const active = o.id === activeOptionId;
          return (
            <li key={o.id}>
              <button
                onClick={() => onApply(o)}
                className={`w-full text-left rounded p-2 transition-colors text-[11px] leading-snug border ${
                  active
                    ? 'bg-sky-900/40 border-sky-500 text-zinc-100'
                    : 'bg-zinc-800/40 border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span>{TYPE_ICON[o.type]}</span>
                    {o.targetGu} {TYPE_LABEL[o.type]}
                  </span>
                  <span className="text-emerald-400 font-mono shrink-0">+{o.expectedCoverageGainPct}%</span>
                </div>
                <div className="text-zinc-500 text-[10px]">
                  예산 {(o.estimatedCostKrw / 100_000_000).toFixed(1)}억원
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
