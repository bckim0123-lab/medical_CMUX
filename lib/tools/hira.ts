// HIRA (건강보험심사평가원) 병원 정보 fetch tool.
// Phase 0: load mock fixture from /data/mock/hira_*.json
// Phase 1: real API call to https://www.data.go.kr (HIRA_API_KEY)

import type { Hospital } from '@/lib/state';

export async function fetchHiraHospitals(_region: string, _specialty: string): Promise<Hospital[]> {
  // TODO: switch on env (USE_MOCK=1) to load fixture vs hit real API
  return [];
}
