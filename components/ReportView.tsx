'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PolicyCards from './PolicyCards';
import type { CoverageResult, PolicyOption, GuCoverage } from '@/lib/state';

interface ReportViewProps {
  report: string;
  coverage: CoverageResult | null;
  optionsCount: number;
  isRunning: boolean;
  options?: PolicyOption[];
  activeOptionId?: string | null;
  onApplyOption?: (opt: PolicyOption) => void;
  onResetOption?: () => void;
  whatIfSummary?: string | null;
}

const GRADE_BG: Record<string, string> = {
  High: 'bg-red-900/40 text-red-300 ring-red-700',
  Mid: 'bg-amber-900/40 text-amber-300 ring-amber-700',
  Low: 'bg-emerald-900/40 text-emerald-300 ring-emerald-700',
};

function SummaryCard({ coverage, optionsCount }: { coverage: CoverageResult; optionsCount: number }) {
  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">분석 요약</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">종합 위험도</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ring-1 ${GRADE_BG[coverage.riskGrade]}`}>
          {coverage.riskGrade}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-zinc-500">취약 면적</p>
          <p className="font-semibold text-zinc-200">{coverage.vulnerableAreaKm2.toFixed(1)}㎢</p>
          <p className="text-zinc-500">{(coverage.vulnerableRatio * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-zinc-500">반경 기준</p>
          <p className="font-semibold text-zinc-200">{coverage.bufferKm}km</p>
          <p className="text-zinc-500">대안 {optionsCount}건</p>
        </div>
      </div>
      <div>
        <p className="text-[10px] text-zinc-500 mb-1.5">취약 자치구 Top 5</p>
        <ul className="space-y-1">
          {coverage.byGu.slice(0, 5).map((g: GuCoverage) => (
            <li key={g.gu} className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">{g.gu} <span className="text-zinc-600">({g.hospitalCount}곳)</span></span>
              <span className="flex items-center gap-1.5">
                <span className="text-zinc-500">{(g.uncoveredRatio * 100).toFixed(0)}%</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ${GRADE_BG[g.riskGrade]}`}>
                  {g.riskGrade}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ReportView({
  report,
  coverage,
  optionsCount,
  isRunning,
  options = [],
  activeOptionId = null,
  onApplyOption,
  onResetOption,
  whatIfSummary,
}: ReportViewProps) {
  return (
    <div className="h-full overflow-y-auto bg-zinc-900 text-zinc-100">
      {coverage && <SummaryCard coverage={coverage} optionsCount={optionsCount} />}
      {whatIfSummary && (
        <div className="border-b border-sky-800 bg-sky-950/40 px-4 py-2 text-[11px] text-sky-200">
          {whatIfSummary}
        </div>
      )}
      {options.length > 0 && onApplyOption && onResetOption && (
        <PolicyCards
          options={options}
          activeOptionId={activeOptionId}
          onApply={onApplyOption}
          onReset={onResetOption}
        />
      )}

      <div className="p-4 pb-24">
        {!coverage && !isRunning && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">분석 요약</p>
            <p className="text-xs text-zinc-500">분석 시작 후 Spatial Agent 결과가 표시됩니다.</p>
          </div>
        )}

        {!report && isRunning && (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
            <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs">보고서 생성 중...</p>
          </div>
        )}

        {report && (
          <div className="prose prose-invert prose-xs max-w-none
            prose-headings:text-zinc-100
            prose-h1:text-base prose-h1:font-bold prose-h1:mb-3
            prose-h2:text-sm prose-h2:font-semibold prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-sky-300
            prose-h3:text-xs prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1 prose-h3:text-zinc-300
            prose-p:text-zinc-300 prose-p:text-xs prose-p:leading-relaxed prose-p:my-1.5
            prose-strong:text-zinc-100
            prose-table:text-[11px] prose-th:bg-zinc-800 prose-th:text-zinc-300 prose-td:text-zinc-400 prose-td:border-zinc-700 prose-th:border-zinc-700
            prose-blockquote:border-sky-600 prose-blockquote:bg-zinc-800/50 prose-blockquote:rounded prose-blockquote:not-italic
            prose-code:text-yellow-300 prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded prose-code:text-[11px]
            prose-li:text-zinc-300 prose-li:text-xs prose-li:my-0.5
            prose-hr:border-zinc-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
