// In-memory store of the latest OrchestrationState per session.
// Hackathon-grade: single-process Node, no persistence, no eviction.
// In production this would be Redis or similar.

import type { OrchestrationState } from '@/lib/state';

const store = new Map<string, { state: OrchestrationState; updatedAt: number }>();

export function setOrchestrationState(sessionId: string, state: OrchestrationState) {
  store.set(sessionId, { state, updatedAt: Date.now() });
}

export function getOrchestrationState(sessionId: string): OrchestrationState | undefined {
  return store.get(sessionId)?.state;
}

export function hasOrchestrationState(sessionId: string): boolean {
  return store.has(sessionId);
}

export const DEFAULT_SESSION_ID = 'default';
