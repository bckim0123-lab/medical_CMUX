import type { Agent, AgentEvent } from './index';
import type { OrchestrationState } from '@/lib/state';
import { fetchHiraHospitals } from '@/lib/tools/hira';
import { fetchKosisPopulationU5, totalPopulationU5 } from '@/lib/tools/kosis';
import { getGemini, hasGeminiKey, MODEL_FAST } from '@/lib/llm/gemini';
import { SchemaType, type FunctionCall, type FunctionDeclaration } from '@google/generative-ai';

// Real Gemini function-calling loop for Data Agent.
// The LLM decides which tool(s) to call; we execute them, return summaries
// (counts only — the full payload stays in our own state to keep prompt small),
// and capture the actual data ourselves for downstream agents.
//
// Falls back to direct fixture loads if GEMINI_API_KEY is missing or the
// Gemini call fails, so the demo never hard-stops.

const TOOL_DECLS: FunctionDeclaration[] = [
  {
    name: 'fetch_hira_api',
    description: 'HIRA(건강보험심사평가원)에서 특정 진료과의 의료기관 정보를 가져옵니다.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        region: { type: SchemaType.STRING, description: '시·도 단위 행정구역명 (예: 서울특별시)' },
        specialty: { type: SchemaType.STRING, description: '진료과 (예: 소아청소년과)' },
      },
      required: ['region', 'specialty'],
    },
  },
  {
    name: 'fetch_kosis_api',
    description: 'KOSIS(통계청)에서 행정동별 0–4세 영유아 인구 통계를 가져옵니다.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        region: { type: SchemaType.STRING, description: '시·도 단위 행정구역명 (예: 서울특별시)' },
      },
      required: ['region'],
    },
  },
];

export const dataAgent: Agent = {
  name: 'data',
  async *run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    yield { type: 'log', agent: 'data', message: `${state.region} 공공데이터 수집 시작 (HIRA + KOSIS)...` };

    if (!hasGeminiKey()) {
      yield { type: 'log', agent: 'data', message: 'Gemini API 키 미설정 → 직접 호출 모드' };
      return await directLoad(state);
    }

    let hospitals = state.hospitals ?? [];
    let population = state.population ?? [];

    try {
      const ai = getGemini();
      const model = ai.getGenerativeModel({
        model: MODEL_FAST,
        tools: [{ functionDeclarations: TOOL_DECLS }],
        systemInstruction:
          '당신은 공공의료 데이터를 수집하는 Data Collector 에이전트입니다. ' +
          '제공된 도구만을 사용해 1) HIRA에서 소아청소년과 의료기관 좌표, 2) KOSIS에서 행정동별 영유아 인구를 수집하세요. ' +
          '두 도구를 모두 호출한 뒤, 한국어 한 문장으로 수집 결과를 요약하세요.',
      });
      const chat = model.startChat();
      let res = await chat.sendMessage(
        `대상 지역: ${state.region}, 진료과: 소아청소년과. 두 데이터셋을 모두 수집하세요.`,
      );

      let safety = 0;
      while (safety++ < 4) {
        const calls = res.response.functionCalls() as FunctionCall[] | undefined;
        if (!calls || calls.length === 0) break;

        const replies = [] as Array<{ functionResponse: { name: string; response: object } }>;
        for (const call of calls) {
          yield { type: 'tool', agent: 'data', tool: call.name, args: call.args };
          if (call.name === 'fetch_hira_api') {
            hospitals = await fetchHiraHospitals({ specialty: '소아청소년과' });
            yield { type: 'log', agent: 'data', message: `HIRA: 소아청소년과 ${hospitals.length}개소 좌표 확보` };
            replies.push({
              functionResponse: {
                name: call.name,
                response: { count: hospitals.length, sample: hospitals.slice(0, 3) },
              },
            });
          } else if (call.name === 'fetch_kosis_api') {
            population = await fetchKosisPopulationU5();
            const total = totalPopulationU5(population);
            yield { type: 'log', agent: 'data', message: `KOSIS: ${population.length}개 행정동, 영유아 ${total.toLocaleString()}명 집계` };
            replies.push({
              functionResponse: {
                name: call.name,
                response: { dongCount: population.length, totalU5: total },
              },
            });
          } else {
            yield { type: 'error', agent: 'data', message: `알 수 없는 도구: ${call.name}` };
            replies.push({
              functionResponse: { name: call.name, response: { error: 'unknown tool' } },
            });
          }
        }
        res = await chat.sendMessage(replies);
      }

      const summary = res.response.text();
      if (summary?.trim()) {
        yield { type: 'log', agent: 'data', message: summary.trim() };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      yield { type: 'error', agent: 'data', message: `Gemini FC 실패 — 직접 호출로 fallback: ${msg}` };
      return await directLoad(state);
    }

    if (hospitals.length === 0 || population.length === 0) {
      yield { type: 'log', agent: 'data', message: 'LLM이 도구 호출을 누락 — 직접 호출 보강' };
      const fallback = await directLoad(state);
      hospitals = fallback.hospitals ?? hospitals;
      population = fallback.population ?? population;
    }

    return { hospitals, population };
  },
};

async function directLoad(state: OrchestrationState): Promise<Partial<OrchestrationState>> {
  const hospitals = await fetchHiraHospitals({ specialty: '소아청소년과' });
  const population = await fetchKosisPopulationU5();
  return { hospitals, population };
}
