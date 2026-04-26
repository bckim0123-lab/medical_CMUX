// Orchestrator — sequential pipeline for now.
// Upgrade path: replace this file with a LangGraph StateGraph; agents stay unchanged.

import type { OrchestrationState } from '@/lib/state';
import type { Agent, AgentEvent } from '@/lib/agents';
import { dataAgent } from '@/lib/agents/data';
import { spatialAgent } from '@/lib/agents/spatial';
import { policyAgent } from '@/lib/agents/policy';
import { criticAgent } from '@/lib/agents/critic';
import { editorAgent } from '@/lib/agents/editor';

const PIPELINE: Agent[] = [dataAgent, spatialAgent, policyAgent, criticAgent, editorAgent];

export async function* orchestrate(
  region: string,
): AsyncGenerator<AgentEvent | { type: 'done'; state: OrchestrationState }, void, void> {
  let state: OrchestrationState = { region };

  for (const agent of PIPELINE) {
    const gen = agent.run(state);
    let result = await gen.next();
    while (!result.done) {
      yield result.value;
      result = await gen.next();
    }
    state = { ...state, ...result.value };
    yield {
      type: 'state',
      agent: agent.name,
      patch: result.value,
    };
  }

  yield { type: 'done', state };
}
