import type { Agent, AgentEvent } from './index';
import type { CriticReview, OrchestrationState, PolicyOption } from '@/lib/state';
import { generateText, hasAnyLlmKey } from '@/lib/llm/provider';

// Critic Agent — 5번째 노드. Policy 가 만든 9개 옵션 각각에 대해 한 문장 우려와
// severity (low/mid/high) 를 단다. 시연 메시지: "AI 가 자기 안에 반론도 단다."
//
// Gemini structured output (JSON schema) 으로 안정적 파싱. 키가 없으면 룰 베이스
// fallback — 예산/타입 휴리스틱으로 severity 와 일반 우려 한 문장.

export const criticAgent: Agent = {
  name: 'critic',
  async *run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    const options = state.options ?? [];
    if (options.length === 0) {
      yield { type: 'log', agent: 'critic', message: '정책 옵션 없음 — 비판적 검토 스킵' };
      return { criticalReviews: [] };
    }

    yield {
      type: 'log',
      agent: 'critic',
      message: `${options.length}개 정책 안에 대한 비판적 검토 시작...`,
    };

    if (!hasAnyLlmKey()) {
      yield { type: 'log', agent: 'critic', message: 'LLM 키 미설정 → 룰 베이스 검토' };
      const reviews = options.map(ruleBased);
      yield {
        type: 'log',
        agent: 'critic',
        message: `${reviews.length}건 검토 완료 (룰 베이스)`,
      };
      return { criticalReviews: reviews };
    }

    yield { type: 'tool', agent: 'critic', tool: 'critique_options', args: { count: options.length } };

    try {
      const compactOptions = options.map((o) => ({
        id: o.id,
        type: o.type,
        title: o.title,
        gu: o.targetGu,
        gainPct: o.expectedCoverageGainPct,
        costKrw: o.estimatedCostKrw,
      }));

      const { text, provider } = await generateText({
        system:
          '당신은 보건 정책 비판 전문가입니다. 각 정책 옵션에 대해 1) 한국어 50자 이내의 리스크/우려 한 문장, 2) 심각도(low/mid/high)를 평가합니다. 추측 대신 옵션의 예산·대상·타입에 근거해 구체적으로 지적하세요. 응답은 반드시 {"reviews":[{"optionId":..., "concern":..., "severity":...}]} JSON 객체 한 개로만.',
        prompt:
          `다음 정책 옵션들을 검토하세요:\n${JSON.stringify(compactOptions, null, 2)}\n\n` +
          '각 옵션마다 optionId, concern (50자 이내 한국어 한 문장), severity (low/mid/high) 가 포함된 항목을 reviews 배열로 답변하세요.',
        temperature: 0.3,
        maxTokens: 1024,
        responseFormat: 'json',
      });

      const parsed = parseReviewArray(text);
      const reviews: CriticReview[] = parsed
        .filter((r) => options.some((o) => o.id === r.optionId))
        .map((r) => ({
          optionId: r.optionId,
          concern: r.concern,
          severity: normalizeSeverity(r.severity),
        }));

      const coveredIds = new Set(reviews.map((r) => r.optionId));
      for (const o of options) {
        if (!coveredIds.has(o.id)) reviews.push(ruleBased(o));
      }

      const high = reviews.filter((r) => r.severity === 'high').length;
      const mid = reviews.filter((r) => r.severity === 'mid').length;
      const low = reviews.filter((r) => r.severity === 'low').length;
      yield {
        type: 'log',
        agent: 'critic',
        message: `${provider} 검토 ${reviews.length}건 완료 (high=${high} / mid=${mid} / low=${low})`,
      };
      return { criticalReviews: reviews };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      yield { type: 'error', agent: 'critic', message: `LLM 실패 — 룰 베이스 fallback: ${msg}` };
      const reviews = options.map(ruleBased);
      return { criticalReviews: reviews };
    }
  },
};

// 응답이 {reviews:[...]} 객체이거나 [...] 배열이거나 코드펜스 안에 있을 수 있음.
function parseReviewArray(raw: string): Array<{ optionId: string; concern: string; severity: string }> {
  if (!raw) return [];
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return v;
    if (Array.isArray(v?.reviews)) return v.reviews;
    if (Array.isArray(v?.items)) return v.items;
    return [];
  } catch {
    // 배열 부분만 추출 시도
    const m = s.match(/\[[\s\S]*\]/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fall through */ }
    }
    return [];
  }
}

function normalizeSeverity(s: string): CriticReview['severity'] {
  const v = s?.toLowerCase().trim();
  if (v === 'high' || v === 'mid' || v === 'low') return v;
  return 'mid';
}

// 룰 베이스 — Gemini 키 없거나 실패 시 fallback. 옵션 type + 예산으로 일반화된 우려 생성.
function ruleBased(o: PolicyOption): CriticReview {
  const costEok = Math.round(o.estimatedCostKrw / 100_000_000);
  if (o.type === 'NewCenter') {
    return {
      optionId: o.id,
      concern: `${o.targetGu} 부지 확보·인허가 일정 / ${costEok}억 단가 부족 우려`,
      severity: costEok >= 30 ? 'high' : 'mid',
    };
  }
  if (o.type === 'ShuttleLink') {
    return {
      optionId: o.id,
      concern: `운영 인력·차량 유지비 누적 / 야간 응급 대응 한계`,
      severity: 'mid',
    };
  }
  // TelemedHub
  return {
    optionId: o.id,
    concern: `대면 진찰 필요 케이스 한계 / 영유아 비대면 수용성 검증 필요`,
    severity: 'mid',
  };
}
