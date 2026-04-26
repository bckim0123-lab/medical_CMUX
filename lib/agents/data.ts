import type { Agent, AgentEvent } from './index';
import type { OrchestrationState, Hospital, PopulationDong } from '@/lib/state';
import { fetchHiraHospitals } from '@/lib/tools/hira';
import { fetchKosisPopulationU5, totalPopulationU5 } from '@/lib/tools/kosis';
import { getOpenAI, hasOpenAIKey, OPENAI_MODEL_FAST } from '@/lib/llm/openai';

// Function-calling Data Agent — OpenAI only. 키 없거나 실패 시 직접 호출.
// LLM 이 어떤 tool 을 부를지 결정하고, 우리가 실행해 결과를 돌려준다.
// 시연: 좌측 로그에 [tool:fetch_hira_api] 같은 tool call 이 뜸.

const SYSTEM_INSTRUCTION =
  '당신은 공공의료 데이터를 수집하는 Data Collector 에이전트입니다. ' +
  '제공된 도구만을 사용해 1) HIRA에서 소아청소년과 의료기관 좌표, 2) KOSIS에서 행정동별 영유아 인구를 수집하세요. ' +
  '두 도구를 모두 호출한 뒤, 한국어 한 문장으로 수집 결과를 요약하세요.';

// ── OpenAI 도구 선언 (표준 JSON Schema) ───────────────────────────
const OPENAI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'fetch_hira_api',
      description: 'HIRA(건강보험심사평가원)에서 특정 진료과의 의료기관 정보를 가져옵니다.',
      parameters: {
        type: 'object',
        properties: {
          region: { type: 'string', description: '시·도 단위 행정구역명 (예: 서울특별시)' },
          specialty: { type: 'string', description: '진료과 (예: 소아청소년과)' },
        },
        required: ['region', 'specialty'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'fetch_kosis_api',
      description: 'KOSIS(통계청)에서 행정동별 0–4세 영유아 인구 통계를 가져옵니다.',
      parameters: {
        type: 'object',
        properties: {
          region: { type: 'string', description: '시·도 단위 행정구역명 (예: 서울특별시)' },
        },
        required: ['region'],
      },
    },
  },
];

// 공통 tool dispatcher. 결과는 LLM 에게 돌려줄 요약 (counts + sample).
async function execTool(
  name: string,
  hospitalsRef: { current: Hospital[] },
  populationRef: { current: PopulationDong[] },
): Promise<unknown> {
  if (name === 'fetch_hira_api') {
    hospitalsRef.current = await fetchHiraHospitals({ specialty: '소아청소년과' });
    return { count: hospitalsRef.current.length, sample: hospitalsRef.current.slice(0, 3) };
  }
  if (name === 'fetch_kosis_api') {
    populationRef.current = await fetchKosisPopulationU5();
    return { dongCount: populationRef.current.length, totalU5: totalPopulationU5(populationRef.current) };
  }
  return { error: `unknown tool: ${name}` };
}

export const dataAgent: Agent = {
  name: 'data',
  async *run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    yield { type: 'log', agent: 'data', message: `${state.region} 공공데이터 수집 시작 (HIRA + KOSIS)...` };

    if (hasOpenAIKey()) {
      try {
        return yield* runOpenAI(state);
      } catch (err) {
        yield { type: 'error', agent: 'data', message: `OpenAI 실패 — 직접 호출 fallback: ${msg(err)}` };
      }
    }
    yield { type: 'log', agent: 'data', message: 'OpenAI 키 미설정/실패 → 직접 호출 모드' };
    return await directLoad();
  },
};

async function* runOpenAI(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
  const oa = getOpenAI();
  const hospitalsRef = { current: [] as Hospital[] };
  const populationRef = { current: [] as PopulationDong[] };

  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    { role: 'user', content: `대상 지역: ${state.region}, 진료과: 소아청소년과. 두 데이터셋을 모두 수집하세요.` },
  ];

  let safety = 0;
  while (safety++ < 4) {
    const res = await oa.chat.completions.create({
      model: OPENAI_MODEL_FAST,
      temperature: 0.2,
      messages: messages as never,
      tools: OPENAI_TOOLS,
    });
    const m = res.choices[0].message;
    messages.push(m as unknown as Record<string, unknown>);
    const calls = m.tool_calls ?? [];
    if (calls.length === 0) {
      if (m.content) yield { type: 'log', agent: 'data', message: m.content };
      break;
    }
    for (const tc of calls) {
      if (tc.type !== 'function') continue;
      const name = tc.function.name;
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
      yield { type: 'tool', agent: 'data', tool: name, args };
      const result = await execTool(name, hospitalsRef, populationRef);
      if (name === 'fetch_hira_api') {
        yield { type: 'log', agent: 'data', message: `HIRA: 소아청소년과 ${hospitalsRef.current.length}개소 좌표 확보` };
      } else if (name === 'fetch_kosis_api') {
        yield { type: 'log', agent: 'data', message: `KOSIS: ${populationRef.current.length}개 행정동, 영유아 ${totalPopulationU5(populationRef.current).toLocaleString()}명 집계` };
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  if (hospitalsRef.current.length === 0 || populationRef.current.length === 0) {
    yield { type: 'log', agent: 'data', message: 'LLM 도구 호출 누락 — 직접 호출 보강' };
    const fb = await directLoad();
    return {
      hospitals: hospitalsRef.current.length > 0 ? hospitalsRef.current : fb.hospitals,
      population: populationRef.current.length > 0 ? populationRef.current : fb.population,
    };
  }
  return { hospitals: hospitalsRef.current, population: populationRef.current };
}

async function directLoad(): Promise<Partial<OrchestrationState>> {
  const hospitals = await fetchHiraHospitals({ specialty: '소아청소년과' });
  const population = await fetchKosisPopulationU5();
  return { hospitals, population };
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
