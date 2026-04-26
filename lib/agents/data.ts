import type { Agent, AgentEvent } from './index';
import type { OrchestrationState } from '@/lib/state';

// TODO: implement HIRA/KOSIS fetch tools, wire to Gemini function calling.
// For Phase 0, returns mock fixture loaded by tools/hira.ts + tools/kosis.ts.
export const dataAgent: Agent = {
  name: 'data',
  async *run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    yield { type: 'log', agent: 'data', message: `${state.region} 공공데이터 수집 시작 (HIRA + KOSIS)...` };
    // placeholder — replaced in Phase 1
    yield { type: 'log', agent: 'data', message: 'Mock fixture 로드됨' };
    return { hospitals: [], population: [] };
  },
};
