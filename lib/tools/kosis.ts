// KOSIS (통계청) 인구 통계 fetch tool.
// Phase 0: mock fixture; Phase 1: real KOSIS Open API.

import type { PopulationDong } from '@/lib/state';

export async function fetchKosisPopulationU5(_region: string): Promise<PopulationDong[]> {
  return [];
}
