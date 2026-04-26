// HIRA(건강보험심사평가원) 병원 정보 fetch tool.
// - Phase 0: data/mock/hira_seoul.json (synthetic)
// - Phase 1+: real call to data.go.kr getHospBasisList with pagination,
//   coordinate filtering, and gu-name normalization.
//
// Activation rule:
//   USE_MOCK=1                       → fixture only
//   else if HIRA_HOSPITAL_INFO_KEY   → real API; fixture as fallback
//   else                             → fixture
//
// Optional knob:
//   HIRA_CL_CD="31"                  → 진료기관 종별코드 필터 (의원=31, 병원=21,
//                                      종합병원=11, 상급종합=01). 미설정 시 전체.

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

let fixtureCache: HiraFixture | null = null;
let realCache: Hospital[] | null = null;

const HIRA_ENDPOINT = 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList';
const SEOUL_SIDO_CD = '110000';
const PEDIATRIC_DGSBJT_CD = '21'; // 소아청소년과 진료과목 코드

function loadFixture(): HiraFixture {
  if (fixtureCache) return fixtureCache;
  const path = join(process.cwd(), 'data/mock/hira_seoul.json');
  fixtureCache = JSON.parse(readFileSync(path, 'utf8')) as HiraFixture;
  return fixtureCache;
}

function shouldUseRealApi(): boolean {
  if (process.env.USE_MOCK === '1') return false;
  return Boolean(process.env.HIRA_HOSPITAL_INFO_KEY);
}

async function fetchPageFromApi(
  apiKey: string,
  pageNo: number,
  numOfRows: number,
  clCd?: string,
): Promise<{ items: Record<string, unknown>[]; totalCount: number }> {
  const url = new URL(HIRA_ENDPOINT);
  url.searchParams.set('ServiceKey', apiKey);
  url.searchParams.set('_type', 'json');
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('numOfRows', String(numOfRows));
  url.searchParams.set('sidoCd', SEOUL_SIDO_CD);
  url.searchParams.set('dgsbjtCd', PEDIATRIC_DGSBJT_CD);
  if (clCd) url.searchParams.set('clCd', clCd);

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`HIRA HTTP ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as {
    response?: {
      header?: { resultCode?: string; resultMsg?: string };
      body?: {
        totalCount?: number;
        items?: { item?: Record<string, unknown> | Record<string, unknown>[] };
      };
    };
  };
  const code = json.response?.header?.resultCode;
  if (code && code !== '00') {
    throw new Error(`HIRA resultCode ${code} (${json.response?.header?.resultMsg ?? ''})`);
  }
  const raw = json.response?.body?.items?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const totalCount = json.response?.body?.totalCount ?? items.length;
  return { items, totalCount };
}

function normalizeHospital(it: Record<string, unknown>): Hospital | null {
  const lng = parseFloat(String(it.XPos ?? ''));
  const lat = parseFloat(String(it.YPos ?? ''));
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  // The API often returns "종로구" plain; trim defensively.
  const gu = String(it.sgguCdNm ?? '').trim();
  if (!gu) return null;
  const id = String(it.ykiho ?? `${it.yadmNm}-${lng}-${lat}`);
  return {
    id,
    name: String(it.yadmNm ?? '(이름미상)'),
    gu,
    lng,
    lat,
    specialty: '소아청소년과',
  };
}

async function fetchAllFromApi(apiKey: string): Promise<Hospital[]> {
  if (realCache) return realCache;
  const clCd = process.env.HIRA_CL_CD?.trim() || undefined;
  const numOfRows = 1000;
  const out: Hospital[] = [];
  let pageNo = 1;
  let total = Infinity;
  while ((pageNo - 1) * numOfRows < total && pageNo <= 5) {
    const { items, totalCount } = await fetchPageFromApi(apiKey, pageNo, numOfRows, clCd);
    if (pageNo === 1) total = totalCount;
    for (const it of items) {
      const h = normalizeHospital(it);
      if (h) out.push(h);
    }
    if (items.length < numOfRows) break;
    pageNo += 1;
  }
  realCache = out;
  return out;
}

export type FetchHiraInput = {
  region?: string;
  specialty?: string;
  guFilter?: string[];
};

export async function fetchHiraHospitals(input: FetchHiraInput = {}): Promise<Hospital[]> {
  let list: Hospital[];

  if (shouldUseRealApi()) {
    try {
      list = await fetchAllFromApi(process.env.HIRA_HOSPITAL_INFO_KEY as string);
      if (list.length === 0) throw new Error('HIRA 응답 0건 — fixture로 fallback');
    } catch (err) {
      console.error('[HIRA] real API failed, fallback to fixture:', err);
      list = loadFixture().hospitals;
    }
  } else {
    list = loadFixture().hospitals;
  }

  if (input.specialty && input.specialty !== '소아청소년과') {
    return [];
  }
  if (input.guFilter && input.guFilter.length > 0) {
    const set = new Set(input.guFilter);
    list = list.filter((h) => set.has(h.gu));
  }
  return list;
}

// For tests / scripts.
export function _resetHiraCache() {
  realCache = null;
  fixtureCache = null;
}
