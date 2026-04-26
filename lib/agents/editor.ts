import type { Agent, AgentEvent } from './index';
import type { OrchestrationState } from '@/lib/state';

// TODO: Gemini text generation → markdown report (B2G template)
export const editorAgent: Agent = {
  name: 'editor',
  async *run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    yield { type: 'log', agent: 'editor', message: '최종 리포트 작성 중...' };
    const report = `# ${state.region} 필수 의료 공백 분석 (placeholder)\n\nPhase 0 stub.`;
    return { report };
  },
};
