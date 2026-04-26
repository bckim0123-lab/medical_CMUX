// KOSIS (통계청) 인구 통계 fetch tool.
// Phase 0: mock fixture; Phase 1+: real KOSIS Open API.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PopulationDong } from '@/lib/state';

type KosisFixture = {
  region: string;
  metric: string;
  fetchedAt: string | null;
  source: string;
  dongs: PopulationDong[];
};

let cache: KosisFixture | null = null;

function loadFixture(): KosisFixture {
  if (cache) return cache;
  const path = join(process.cwd(), 'data/mock/kosis_seoul.json');
  cache = JSON.parse(readFileSync(path, 'utf8')) as KosisFixture;
  return cache;
}

export type FetchKosisInput = {
  region?: string;
  guFilter?: string[];
};

export async function fetchKosisPopulationU5(input: FetchKosisInput = {}): Promise<PopulationDong[]> {
  const fixture = loadFixture();
  let list = fixture.dongs;
  if (input.guFilter && input.guFilter.length > 0) {
    const set = new Set(input.guFilter);
    list = list.filter((d) => set.has(d.gu));
  }
  return list;
}

export function totalPopulationU5(dongs: PopulationDong[]): number {
  return dongs.reduce((s, d) => s + d.populationU5, 0);
}
