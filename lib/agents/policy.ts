import type { Agent, AgentEvent } from './index';
import type { OrchestrationState } from '@/lib/state';

// TODO: simulate placement, evaluate ROI; LLM-assisted ranking.
export const policyAgent: Agent = {
  name: 'policy',
  async *run(_state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    yield { type: 'log', agent: 'policy', message: '정책 대안 시뮬레이션...' };
    return { options: [] };
  },
};
