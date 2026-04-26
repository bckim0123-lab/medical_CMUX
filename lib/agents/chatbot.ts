// Public-data chatbot. OpenAI tool-calling chat. 6 read-only tools 가
// cached OrchestrationState 를 조회. 모든 수치 답변에 (HIRA / KOSIS /
// MediSim 분석) 출처 인용. 의학적 조언 거부.

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import { getOpenAI, hasOpenAIKey, OPENAI_MODEL_FAST } from '@/lib/llm/openai';
import type { OrchestrationState, GuCoverage, PolicyOption } from '@/lib/state';

const SYSTEM_INSTRUCTION = `당신은 MediSim 공공의료 데이터 어시스턴트입니다.

규칙:
1. 제공된 도구가 반환하는 HIRA·KOSIS·MediSim 분석 결과 데이터로만 답변하세요.
2. 일반 의료 지식, 진단, 약품 추천, 의학적 조언 요청은 정중히 거부하고, 가능한 질문 예시 3개를 제시하세요.
3. 모든 수치 답변에는 (HIRA, n=…) 또는 (KOSIS) 또는 (MediSim 분석) 형태로 출처를 동반하세요.
4. 도구를 먼저 호출해 데이터를 받은 뒤 답변하세요. 추측하지 마세요.
5. 모르는 건 모른다고 답하세요.
6. 한국어 간결한 답변 (2~4문장).

도구 사용 예시:
- "마포구 의원 몇 개?" → query_hospitals_by_gu({gu: "마포구"})
- "취약 자치구 Top 3?" → top_uncovered_gus({n: 3})
- "강남 vs 마포 비교" → compare_gus({a: "강남구", b: "마포구"})
- "은평구 정책 대안?" → list_policy_options({gu: "은평구"})
`;

// Convert SchemaType-based Gemini declarations into OpenAI JSON-Schema tools.
function geminiToOpenAI(t: FunctionDeclaration) {
  function convert(p: unknown): unknown {
    if (!p || typeof p !== 'object') return p;
    const o = p as Record<string, unknown>;
    const out: Record<string, unknown> = { ...o };
    if (typeof o.type === 'string') {
      out.type = (o.type as string).toLowerCase();
    }
    if (o.properties && typeof o.properties === 'object') {
      const props = o.properties as Record<string, unknown>;
      const outProps: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) outProps[k] = convert(v);
      out.properties = outProps;
    }
    if (o.items) out.items = convert(o.items);
    return out;
  }
  return {
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: convert(t.parameters) as Record<string, unknown>,
    },
  };
}

const TOOL_DECLS: FunctionDeclaration[] = [
  {
    name: 'query_hospitals_by_gu',
    description: '특정 자치구의 소아청소년과 의원 수와 샘플 좌표를 반환합니다.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        gu: { type: SchemaType.STRING, description: '자치구명 (예: "마포구")' },
      },
      required: ['gu'],
    },
  },
  {
    name: 'get_coverage_summary',
    description: '서울시 전체 의료 공백 분석 요약을 반환합니다 (취약 면적, 비율, 종합 등급, 골든타임 반경).',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'top_uncovered_gus',
    description: '취약도(영유아 미커버 비율) 상위 N개 자치구를 반환합니다.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        n: { type: SchemaType.NUMBER, description: '몇 개 자치구를 반환할지 (1~25)' },
      },
      required: ['n'],
    },
  },
  {
    name: 'compare_gus',
    description: '두 자치구의 의원 수, 영유아 인구, 미커버 비율을 비교합니다.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        a: { type: SchemaType.STRING },
        b: { type: SchemaType.STRING },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'list_policy_options',
    description: '생성된 정책 대안 목록을 반환합니다. gu 필터 가능.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        gu: { type: SchemaType.STRING, description: '특정 자치구만 (생략 시 전체)' },
      },
    },
  },
  {
    name: 'get_policy_option_detail',
    description: '특정 정책 옵션의 상세 (제목, 대상 자치구, 예상 효과, 예산, 근거)를 반환합니다.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
      },
      required: ['id'],
    },
  },
];

function execTool(name: string, args: Record<string, unknown>, state: OrchestrationState): unknown {
  switch (name) {
    case 'query_hospitals_by_gu': {
      const gu = String(args.gu);
      const hospitals = (state.hospitals ?? []).filter((h) => h.gu === gu);
      const dongs = (state.population ?? []).filter((d) => d.gu === gu);
      const populationU5 = dongs.reduce((s, d) => s + d.populationU5, 0);
      return {
        gu,
        hospitalCount: hospitals.length,
        populationU5,
        sample: hospitals.slice(0, 3).map((h) => ({ name: h.name, lng: h.lng, lat: h.lat })),
        source: 'HIRA + KOSIS',
      };
    }
    case 'get_coverage_summary': {
      const c = state.coverage;
      if (!c) return { error: 'no analysis yet' };
      return {
        bufferKm: c.bufferKm,
        vulnerableAreaKm2: round(c.vulnerableAreaKm2),
        totalAreaKm2: round(c.totalAreaKm2),
        vulnerableRatio: round(c.vulnerableRatio, 3),
        riskGrade: c.riskGrade,
        source: 'MediSim 분석',
      };
    }
    case 'top_uncovered_gus': {
      const n = Math.max(1, Math.min(25, Number(args.n) || 3));
      const list = (state.coverage?.byGu ?? []).slice(0, n).map((g: GuCoverage) => ({
        gu: g.gu,
        hospitals: g.hospitalCount,
        populationU5: g.populationU5,
        uncoveredU5: g.uncoveredPopulationU5,
        uncoveredPct: round((g.uncoveredRatio ?? 0) * 100, 1),
        grade: g.riskGrade,
      }));
      return { items: list, source: 'MediSim 분석' };
    }
    case 'compare_gus': {
      const a = findGu(state, String(args.a));
      const b = findGu(state, String(args.b));
      return { a, b, source: 'HIRA + KOSIS + MediSim 분석' };
    }
    case 'list_policy_options': {
      const guFilter = args.gu ? String(args.gu) : undefined;
      const opts = (state.options ?? []).filter((o: PolicyOption) =>
        guFilter ? o.targetGu === guFilter : true,
      );
      return {
        items: opts.map((o) => ({
          id: o.id,
          title: o.title,
          gu: o.targetGu,
          gainPct: o.expectedCoverageGainPct,
          costKrw: o.estimatedCostKrw,
        })),
        source: 'MediSim 분석',
      };
    }
    case 'get_policy_option_detail': {
      const id = String(args.id);
      const o = (state.options ?? []).find((x: PolicyOption) => x.id === id);
      if (!o) return { error: `option not found: ${id}` };
      return { ...o, source: 'MediSim 분석' };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}

function findGu(state: OrchestrationState, gu: string) {
  const g = (state.coverage?.byGu ?? []).find((x) => x.gu === gu);
  if (!g) return { gu, error: '데이터 없음' };
  return {
    gu,
    hospitals: g.hospitalCount,
    populationU5: g.populationU5,
    uncoveredU5: g.uncoveredPopulationU5,
    uncoveredPct: round((g.uncoveredRatio ?? 0) * 100, 1),
    grade: g.riskGrade,
    perHospital: g.hospitalCount > 0 ? Math.round(g.populationU5 / g.hospitalCount) : null,
  };
}

function round(n: number | undefined, digits = 1): number | undefined {
  if (n === undefined || Number.isNaN(n)) return undefined;
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatStreamEvent =
  | { type: 'tool'; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; name: string; resultPreview: string }
  | { type: 'text'; delta: string }
  | { type: 'done'; text: string }
  | { type: 'error'; message: string };

export async function* chat(
  history: ChatMessage[],
  state: OrchestrationState | undefined,
): AsyncGenerator<ChatStreamEvent, void, void> {
  if (!hasOpenAIKey()) {
    yield {
      type: 'error',
      message: 'OpenAI API 키가 설정되어 있지 않아 챗봇을 사용할 수 없어요. 분석 결과를 우측 패널에서 직접 확인해주세요.',
    };
    return;
  }
  if (!state) {
    yield {
      type: 'error',
      message: '아직 분석이 실행되지 않았어요. 먼저 좌측 "분석 시작"을 눌러주세요.',
    };
    return;
  }
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    yield { type: 'error', message: '질문을 입력해주세요.' };
    return;
  }

  try {
    yield* chatOpenAI(history, lastUser.content, state);
  } catch (err) {
    yield { type: 'error', message: `OpenAI 오류: ${msg(err)}` };
  }
}

async function* chatOpenAI(
  history: ChatMessage[],
  userMsg: string,
  state: OrchestrationState,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const oa = getOpenAI();
  const tools = TOOL_DECLS.map(geminiToOpenAI);
  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...history.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMsg },
  ];

  let safety = 0;
  while (safety++ < 5) {
    const res = await oa.chat.completions.create({
      model: OPENAI_MODEL_FAST,
      temperature: 0.2,
      max_tokens: 1024,
      messages: messages as never,
      tools,
    });
    const m = res.choices[0].message;
    messages.push(m as unknown as Record<string, unknown>);
    const calls = m.tool_calls ?? [];
    if (calls.length === 0) {
      yield { type: 'done', text: m.content ?? '' };
      return;
    }
    for (const tc of calls) {
      if (tc.type !== 'function') continue;
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
      yield { type: 'tool', name: tc.function.name, args };
      const result = execTool(tc.function.name, args, state);
      yield { type: 'tool-result', name: tc.function.name, resultPreview: JSON.stringify(result).slice(0, 200) };
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }
  yield { type: 'done', text: '응답 횟수 한도 도달' };
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
