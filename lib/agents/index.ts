// Agent contract — every agent is a streaming async generator over state.
// This shape maps directly to a LangGraph node + stream_events later.

import type { OrchestrationState } from '@/lib/state';

export type AgentName = 'data' | 'spatial' | 'policy' | 'critic' | 'editor';

export type AgentEvent =
  | { type: 'log'; agent: AgentName; message: string }
  | { type: 'tool'; agent: AgentName; tool: string; args?: unknown }
  | { type: 'state'; agent: AgentName; patch: Partial<OrchestrationState> }
  | { type: 'error'; agent: AgentName; message: string };

export interface Agent {
  name: AgentName;
  run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void>;
}
