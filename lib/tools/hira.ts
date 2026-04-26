// HIRA (건강보험심사평가원) 병원 정보 fetch tool.
// Phase 0: load mock fixture from /data/mock/hira_seoul.json
// Phase 1+: real call to https://www.data.go.kr (HIRA_API_KEY)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Hospital } from '@/lib/state';

type HiraFixture = {
  region: string;
  specialty: string;
  fetchedAt: string | null;
  source: string;
  hospitals: Hospital[];
};

let cache: HiraFixture | null = null;

function loadFixture(): HiraFixture {
  if (cache) return cache;
  const path = join(process.cwd(), 'data/mock/hira_seoul.json');
  cache = JSON.parse(readFileSync(path, 'utf8')) as HiraFixture;
  return cache;
}

export type FetchHiraInput = {
  region?: string;
  specialty?: string;
  guFilter?: string[];
};

export async function fetchHiraHospitals(input: FetchHiraInput = {}): Promise<Hospital[]> {
  const fixture = loadFixture();
  let list = fixture.hospitals;
  if (input.specialty && input.specialty !== fixture.specialty) {
    return [];
  }
  if (input.guFilter && input.guFilter.length > 0) {
    const set = new Set(input.guFilter);
    list = list.filter((h) => set.has(h.gu));
  }
  return list;
}
