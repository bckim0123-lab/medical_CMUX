// One-off probe — verify HIRA service key actually returns hospital data.
// Run: npx tsx scripts/probe_hira_api.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadDotEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

async function probe() {
  const env = loadDotEnv(join(process.cwd(), '.env.local'));
  const key = env.HIRA_HOSPITAL_INFO_KEY;
  if (!key) {
    console.error('HIRA_HOSPITAL_INFO_KEY 가 .env.local 에 없습니다.');
    process.exit(1);
  }
  console.log(`key length: ${key.length}, head: ${key.slice(0, 8)}…${key.slice(-6)}`);

  const url = new URL('https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList');
  url.searchParams.set('ServiceKey', key);
  url.searchParams.set('_type', 'json');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '5');
  url.searchParams.set('sidoCd', '110000'); // 서울특별시
  url.searchParams.set('dgsbjtCd', '21');   // 소아청소년과 진료과목 코드

  console.log('GET', url.toString().replace(key, '***'));
  const res = await fetch(url);
  console.log('HTTP', res.status, res.statusText);
  console.log('Content-Type:', res.headers.get('content-type'));
  const text = await res.text();
  console.log('--- body (first 800 chars) ---');
  console.log(text.slice(0, 800));
  console.log('--- end ---');

  try {
    const json = JSON.parse(text);
    const items = json?.response?.body?.items?.item;
    const totalCount = json?.response?.body?.totalCount;
    const resultCode = json?.response?.header?.resultCode;
    const resultMsg = json?.response?.header?.resultMsg;
    console.log(`\nresultCode=${resultCode}  resultMsg=${resultMsg}`);
    console.log(`totalCount=${totalCount}`);
    if (Array.isArray(items)) {
      console.log(`\n샘플 ${items.length}건:`);
      for (const it of items) {
        console.log(`  - ${it.yadmNm} (${it.sidoCdNm} ${it.sgguCdNm}) [${it.XPos},${it.YPos}]`);
      }
    } else if (items) {
      console.log('단건:', items);
    }
  } catch (err) {
    console.log('JSON 파싱 실패 — XML 응답일 수 있음. 위 body 확인.');
  }
}

probe().catch((e) => {
  console.error('probe error:', e);
  process.exit(2);
});
