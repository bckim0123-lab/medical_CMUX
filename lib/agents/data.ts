import type { Agent, AgentEvent } from './index';
import type { OrchestrationState } from '@/lib/state';
import { fetchHiraHospitals } from '@/lib/tools/hira';
import { fetchKosisPopulationU5, totalPopulationU5 } from '@/lib/tools/kosis';

// Phase 1 implementation: tool-driven data collection from local fixtures.
// LLM function-calling layer can be added later without changing this shape;
// the agent already emits {tool} events for transparency.
export const dataAgent: Agent = {
  name: 'data',
  async *run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    yield { type: 'log', agent: 'data', message: `${state.region} 공공데이터 수집 시작 (HIRA + KOSIS)...` };

    yield { type: 'tool', agent: 'data', tool: 'fetch_hira_api', args: { region: state.region, specialty: '소아청소년과' } };
    const hospitals = await fetchHiraHospitals({ specialty: '소아청소년과' });
    yield { type: 'log', agent: 'data', message: `HIRA: 소아청소년과 ${hospitals.length}개소 좌표 확보` };

    yield { type: 'tool', agent: 'data', tool: 'fetch_kosis_api', args: { region: state.region, metric: '0-4세 인구' } };
    const population = await fetchKosisPopulationU5();
    const total = totalPopulationU5(population);
    yield { type: 'log', agent: 'data', message: `KOSIS: ${population.length}개 행정동, 영유아 ${total.toLocaleString()}명 집계` };

    return { hospitals, population };
  },
};
