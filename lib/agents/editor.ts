import type { Agent, AgentEvent } from './index';
import type { OrchestrationState } from '@/lib/state';
import { getGemini, MODEL_FAST } from '@/lib/llm/gemini';

// Editor turns the orchestration state into a B2G-style markdown brief.
// Uses Gemini if GEMINI_API_KEY is set; otherwise falls back to a deterministic
// template render so the demo never hard-fails.
export const editorAgent: Agent = {
  name: 'editor',
  async *run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    yield { type: 'log', agent: 'editor', message: '최종 정책 제언 리포트 작성 중...' };

    const compact = compactState(state);

    if (!process.env.GEMINI_API_KEY) {
      yield { type: 'log', agent: 'editor', message: 'GEMINI_API_KEY 미설정 → 템플릿 렌더링' };
      return { report: templateReport(state) };
    }

    yield { type: 'tool', agent: 'editor', tool: 'generate_markdown_report', args: { model: MODEL_FAST } };

    try {
      const ai = getGemini();
      const model = ai.getGenerativeModel({
        model: MODEL_FAST,
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        systemInstruction:
          '당신은 보건복지부에 제출할 B2G 정책 제언서를 작성하는 정책 전문가입니다. ' +
          '제공된 분석 데이터(JSON)만을 근거로 사용하고, 추측·가정·창작은 금지합니다. ' +
          '결과는 마크다운(##·표·불릿)으로 구성하고, 분량은 600~800자 한국어 본문 기준입니다. ' +
          '모든 수치 주장에는 표본수 또는 출처를 동반하세요.',
      });
      const prompt = `다음 분석 결과를 바탕으로 [최종 정책 제언 리포트]를 작성하세요.\n\n` +
        `## 입력 데이터 (JSON)\n\n\`\`\`json\n${JSON.stringify(compact, null, 2)}\n\`\`\`\n\n` +
        `## 작성 지시\n` +
        `1. 제목: "# 서울시 필수 의료(소아청소년과) 공백 분석 및 정책 제언"\n` +
        `2. 섹션: 분석 개요 / 공간 취약성 진단 / 우선순위 자치구 / 정책 대안 비교 / 권고\n` +
        `3. 정책 대안은 표로 비교 (대안명, 대상 자치구, 예상 커버리지 +%, 추정 예산).\n` +
        `4. 마무리는 "이 보고서는 합성 데모 데이터에 기반합니다." 한 줄 면책.`;

      const res = await model.generateContent(prompt);
      const text = res.response.text();
      yield { type: 'log', agent: 'editor', message: `Gemini 응답 ${text.length}자 수신` };
      return { report: text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      yield { type: 'error', agent: 'editor', message: `Gemini 실패 — 템플릿으로 fallback: ${msg}` };
      return { report: templateReport(state) };
    }
  },
};

function compactState(state: OrchestrationState) {
  return {
    region: state.region,
    summary: {
      hospitals: state.hospitals?.length ?? 0,
      populationU5: (state.population ?? []).reduce((s, d) => s + d.populationU5, 0),
      bufferKm: state.coverage?.bufferKm,
      vulnerableAreaKm2: round(state.coverage?.vulnerableAreaKm2),
      totalAreaKm2: round(state.coverage?.totalAreaKm2),
      vulnerableRatio: round(state.coverage?.vulnerableRatio, 3),
      riskGrade: state.coverage?.riskGrade,
    },
    topGu: state.coverage?.byGu.slice(0, 5).map((g) => ({
      gu: g.gu,
      hospitals: g.hospitalCount,
      populationU5: g.populationU5,
      uncoveredU5: g.uncoveredPopulationU5,
      uncoveredPct: round((g.uncoveredRatio ?? 0) * 100, 1),
      grade: g.riskGrade,
    })),
    options: state.options?.map((o) => ({
      type: o.type,
      title: o.title,
      gu: o.targetGu,
      gainPct: o.expectedCoverageGainPct,
      costKrw: o.estimatedCostKrw,
      why: o.rationale,
    })),
  };
}

function round(n: number | undefined, digits = 1): number | undefined {
  if (n === undefined || Number.isNaN(n)) return undefined;
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

function templateReport(state: OrchestrationState): string {
  const c = state.coverage;
  const top = c?.byGu.slice(0, 3) ?? [];
  const opts = state.options ?? [];
  return [
    `# 서울시 필수 의료(소아청소년과) 공백 분석 및 정책 제언`,
    ``,
    `## 분석 개요`,
    `- 분석 단위: ${state.region} 25개 자치구`,
    `- 표본: 소아청소년과 ${state.hospitals?.length ?? 0}개소, 영유아(0–4세) 약 ${(state.population ?? []).reduce((s, d) => s + d.populationU5, 0).toLocaleString()}명`,
    `- 골든타임 기준: 반경 ${c?.bufferKm ?? '?'}km`,
    ``,
    `## 공간 취약성 진단`,
    `- 취약 면적: ${c?.vulnerableAreaKm2?.toFixed(1)}㎢ / ${c?.totalAreaKm2?.toFixed(1)}㎢ (${((c?.vulnerableRatio ?? 0) * 100).toFixed(1)}%)`,
    `- 종합 위험도: **${c?.riskGrade ?? '-'}**`,
    ``,
    `## 우선순위 자치구 Top 3`,
    ...top.map((g, i) => `${i + 1}. **${g.gu}** — 영유아 ${g.populationU5.toLocaleString()}명, 반경 외 ${g.uncoveredPopulationU5.toLocaleString()}명 (${(g.uncoveredRatio * 100).toFixed(0)}%) → ${g.riskGrade}`),
    ``,
    `## 정책 대안 비교`,
    ``,
    `| 대안 | 대상 자치구 | 예상 커버리지 | 추정 예산 |`,
    `|---|---|---|---|`,
    ...opts.map((o) => `| ${o.title} | ${o.targetGu} | +${o.expectedCoverageGainPct}% | ${(o.estimatedCostKrw / 100_000_000).toFixed(1)}억원 |`),
    ``,
    `> 이 보고서는 합성 데모 데이터에 기반합니다.`,
  ].join('\n');
}
