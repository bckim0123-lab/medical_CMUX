import type { Agent, AgentEvent } from './index';
import type { OrchestrationState } from '@/lib/state';

// TODO: buffer + difference via @turf/turf in tools/spatial-ops.ts
export const spatialAgent: Agent = {
  name: 'spatial',
  async *run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    yield { type: 'log', agent: 'spatial', message: '골든타임 버퍼 계산 중...' };
    return {
      coverage: {
        bufferKm: 3,
        vulnerableAreaKm2: 0,
        riskGrade: 'Low',
        vulnerableGeoJSON: { type: 'FeatureCollection', features: [] },
      },
    };
  },
};
