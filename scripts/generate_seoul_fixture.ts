// Generate synthetic but plausible HIRA + KOSIS fixtures for Seoul 25 자치구.
// Run: npx tsx scripts/generate_seoul_fixture.ts
//
// Why synthetic: hackathon time budget makes scraping HIRA/KOSIS infeasible
// in 25 minutes; numbers are calibrated against public references so the
// demo behaves realistically (more hospitals in 강남, fewer in 강북, etc.).
// Replace with real data later by editing the JSON files directly.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

type DistrictSeed = {
  gu: string;
  centroid: [number, number]; // [lng, lat]
  pediatrics: number;          // approximate count of pediatric clinics
  populationU5: number;        // approximate 0-4 yo population
  dongs: string[];             // sample of 행정동 names
};

// Numbers calibrated from open Seoul OpenData snapshots (2023-2024).
// Pediatric counts are approximate orders of magnitude; do not use for
// any quantitative claim outside the demo.
const SEEDS: DistrictSeed[] = [
  { gu: '강남구', centroid: [127.0473, 37.5172], pediatrics: 42, populationU5: 12100, dongs: ['역삼1동','역삼2동','삼성1동','삼성2동','대치1동','대치2동','대치4동','개포1동','개포2동','개포4동','논현1동','논현2동','압구정동','신사동','청담동','일원1동','일원본동','수서동','세곡동','도곡1동','도곡2동'] },
  { gu: '강동구', centroid: [127.1238, 37.5301], pediatrics: 22, populationU5: 9800, dongs: ['강일동','상일1동','상일2동','명일1동','명일2동','고덕1동','고덕2동','암사1동','암사2동','암사3동','천호1동','천호2동','천호3동','성내1동','성내2동','성내3동','길동','둔촌1동','둔촌2동'] },
  { gu: '강북구', centroid: [127.0254, 37.6396], pediatrics: 12, populationU5: 4900, dongs: ['삼양동','미아동','송중동','송천동','삼각산동','번1동','번2동','번3동','수유1동','수유2동','수유3동','우이동','인수동'] },
  { gu: '강서구', centroid: [126.8495, 37.5509], pediatrics: 28, populationU5: 11600, dongs: ['염창동','등촌1동','등촌2동','등촌3동','화곡본동','화곡1동','화곡2동','화곡3동','화곡4동','화곡6동','화곡8동','우장산동','가양1동','가양2동','가양3동','발산1동','공항동','방화1동','방화2동','방화3동'] },
  { gu: '관악구', centroid: [126.9516, 37.4784], pediatrics: 18, populationU5: 7400, dongs: ['보라매동','청림동','성현동','행운동','낙성대동','청룡동','은천동','중앙동','인헌동','남현동','서원동','신원동','서림동','신사동','조원동','미성동','난곡동','난향동','신림동','신사동','삼성동','대학동'] },
  { gu: '광진구', centroid: [127.0823, 37.5384], pediatrics: 16, populationU5: 6800, dongs: ['중곡1동','중곡2동','중곡3동','중곡4동','능동','구의1동','구의2동','구의3동','광장동','자양1동','자양2동','자양3동','자양4동','화양동','군자동'] },
  { gu: '구로구', centroid: [126.8874, 37.4954], pediatrics: 19, populationU5: 7300, dongs: ['신도림동','구로1동','구로2동','구로3동','구로4동','구로5동','가리봉동','수궁동','고척1동','고척2동','개봉1동','개봉2동','개봉3동','오류1동','오류2동','항동'] },
  { gu: '금천구', centroid: [126.9024, 37.4572], pediatrics: 11, populationU5: 4200, dongs: ['가산동','독산1동','독산2동','독산3동','독산4동','시흥1동','시흥2동','시흥3동','시흥4동','시흥5동'] },
  { gu: '노원구', centroid: [127.0568, 37.6543], pediatrics: 24, populationU5: 9400, dongs: ['월계1동','월계2동','월계3동','공릉1동','공릉2동','하계1동','하계2동','중계본동','중계1동','중계4동','중계2.3동','상계1동','상계2동','상계3.4동','상계5동','상계6.7동','상계8동','상계9동','상계10동'] },
  { gu: '도봉구', centroid: [127.0471, 37.6688], pediatrics: 12, populationU5: 4800, dongs: ['쌍문1동','쌍문2동','쌍문3동','쌍문4동','방학1동','방학2동','방학3동','창1동','창2동','창3동','창4동','창5동','도봉1동','도봉2동'] },
  { gu: '동대문구', centroid: [127.0397, 37.5744], pediatrics: 17, populationU5: 6500, dongs: ['용신동','제기동','전농1동','전농2동','답십리1동','답십리2동','장안1동','장안2동','청량리동','회기동','휘경1동','휘경2동','이문1동','이문2동'] },
  { gu: '동작구', centroid: [126.9395, 37.5124], pediatrics: 18, populationU5: 7100, dongs: ['노량진1동','노량진2동','상도1동','상도2동','상도3동','상도4동','흑석동','사당1동','사당2동','사당3동','사당4동','사당5동','대방동','신대방1동','신대방2동'] },
  { gu: '마포구', centroid: [126.9019, 37.5663], pediatrics: 21, populationU5: 8200, dongs: ['공덕동','아현동','도화동','용강동','대흥동','염리동','신수동','서강동','서교동','합정동','망원1동','망원2동','연남동','성산1동','성산2동','상암동'] },
  { gu: '서대문구', centroid: [126.9368, 37.5791], pediatrics: 14, populationU5: 5300, dongs: ['천연동','북아현동','충현동','신촌동','연희동','홍제1동','홍제2동','홍제3동','홍은1동','홍은2동','남가좌1동','남가좌2동','북가좌1동','북가좌2동'] },
  { gu: '서초구', centroid: [127.0327, 37.4836], pediatrics: 35, populationU5: 11200, dongs: ['서초1동','서초2동','서초3동','서초4동','잠원동','반포본동','반포1동','반포2동','반포3동','반포4동','방배본동','방배1동','방배2동','방배3동','방배4동','양재1동','양재2동','내곡동'] },
  { gu: '성동구', centroid: [127.0366, 37.5634], pediatrics: 17, populationU5: 7000, dongs: ['왕십리도선동','왕십리2동','마장동','사근동','행당1동','행당2동','응봉동','금호1가동','금호2.3가동','금호4가동','옥수동','성수1가1동','성수1가2동','성수2가1동','성수2가3동','송정동','용답동'] },
  { gu: '성북구', centroid: [127.0167, 37.5894], pediatrics: 18, populationU5: 7100, dongs: ['성북동','삼선동','동선동','돈암1동','돈암2동','안암동','보문동','정릉1동','정릉2동','정릉3동','정릉4동','길음1동','길음2동','종암동','월곡1동','월곡2동','장위1동','장위2동','장위3동','석관동'] },
  { gu: '송파구', centroid: [127.1059, 37.5145], pediatrics: 36, populationU5: 12500, dongs: ['풍납1동','풍납2동','거여1동','거여2동','마천1동','마천2동','방이1동','방이2동','오륜동','오금동','송파1동','송파2동','석촌동','삼전동','가락본동','가락1동','가락2동','문정1동','문정2동','장지동','위례동','잠실본동','잠실2동','잠실3동','잠실4동','잠실6동','잠실7동'] },
  { gu: '양천구', centroid: [126.8666, 37.5170], pediatrics: 22, populationU5: 8700, dongs: ['목1동','목2동','목3동','목4동','목5동','신월1동','신월2동','신월3동','신월4동','신월5동','신월6동','신월7동','신정1동','신정2동','신정3동','신정4동','신정6동','신정7동'] },
  { gu: '영등포구', centroid: [126.8955, 37.5263], pediatrics: 17, populationU5: 6600, dongs: ['영등포본동','영등포동','여의동','당산1동','당산2동','도림동','문래동','양평1동','양평2동','신길1동','신길3동','신길4동','신길5동','신길6동','신길7동','대림1동','대림2동','대림3동'] },
  { gu: '용산구', centroid: [126.9659, 37.5326], pediatrics: 13, populationU5: 4900, dongs: ['후암동','용산2가동','남영동','청파동','원효로1동','원효로2동','효창동','용문동','한강로동','이촌1동','이촌2동','이태원1동','이태원2동','한남동','서빙고동','보광동'] },
  { gu: '은평구', centroid: [126.9290, 37.6027], pediatrics: 19, populationU5: 7600, dongs: ['녹번동','불광1동','불광2동','갈현1동','갈현2동','구산동','대조동','응암1동','응암2동','응암3동','역촌동','신사1동','신사2동','증산동','수색동','진관동'] },
  { gu: '종로구', centroid: [126.9788, 37.5729], pediatrics: 9, populationU5: 2400, dongs: ['청운효자동','사직동','삼청동','부암동','평창동','무악동','교남동','가회동','종로1.2.3.4가동','종로5.6가동','이화동','혜화동','창신1동','창신2동','창신3동','숭인1동','숭인2동'] },
  { gu: '중구', centroid: [126.9979, 37.5640], pediatrics: 8, populationU5: 2100, dongs: ['소공동','회현동','명동','필동','장충동','광희동','을지로동','신당동','다산동','약수동','청구동','신당5동','동화동','황학동','중림동'] },
  { gu: '중랑구', centroid: [127.0926, 37.6063], pediatrics: 16, populationU5: 6300, dongs: ['면목본동','면목2동','면목3.8동','면목4동','면목5동','면목7동','상봉1동','상봉2동','중화1동','중화2동','묵1동','묵2동','망우본동','망우3동','신내1동','신내2동'] },
];

// Deterministic pseudo-random for reproducible fixtures.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOSPITAL_NAME_PATTERNS = [
  '소아청소년과의원','소아과의원','어린이병원','키즈365의원','연세소아청소년과','맑은소아청소년과',
  '하늘소아과','우리아이소아청소년과','튼튼소아청소년과','새봄소아청소년과','함소아한의원','아이사랑소아과',
];

const hospitals: Array<{
  id: string;
  name: string;
  gu: string;
  lng: number;
  lat: number;
  specialty: string;
}> = [];

const dongs: Array<{
  gu: string;
  dong: string;
  populationU5: number;
  centroid: [number, number];
}> = [];

const rand = mulberry32(20260426);

for (const seed of SEEDS) {
  // Hospitals: cluster near district centroid (~0–1.2km) — pediatric clinics
  // concentrate around commercial cores in reality; this leaves outskirts thin.
  for (let i = 0; i < seed.pediatrics; i++) {
    const angle = rand() * Math.PI * 2;
    const distKm = Math.sqrt(rand()) * 1.2; // tighter cluster than before
    // ~111km per degree latitude; lng scaled by cos(lat)
    const dLat = (distKm * Math.sin(angle)) / 111;
    const dLng = (distKm * Math.cos(angle)) / (111 * Math.cos((seed.centroid[1] * Math.PI) / 180));
    const namePattern = HOSPITAL_NAME_PATTERNS[Math.floor(rand() * HOSPITAL_NAME_PATTERNS.length)];
    hospitals.push({
      id: `${seed.gu}-${(i + 1).toString().padStart(3, '0')}`,
      name: `${seed.gu.replace('구', '')} ${namePattern}`,
      gu: seed.gu,
      lng: +(seed.centroid[0] + dLng).toFixed(6),
      lat: +(seed.centroid[1] + dLat).toFixed(6),
      specialty: '소아청소년과',
    });
  }

  // Dongs: split district U5 population proportionally with noise; spread
  // centroids out to 0.3–3.0 km so outskirts produce coverage gaps.
  const weights = seed.dongs.map(() => 0.5 + rand());
  const sumW = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seed.dongs.length; i++) {
    const angle = (i / seed.dongs.length) * Math.PI * 2;
    const distKm = 0.3 + rand() * 2.7;
    const dLat = (distKm * Math.sin(angle)) / 111;
    const dLng = (distKm * Math.cos(angle)) / (111 * Math.cos((seed.centroid[1] * Math.PI) / 180));
    dongs.push({
      gu: seed.gu,
      dong: seed.dongs[i],
      populationU5: Math.round((seed.populationU5 * weights[i]) / sumW),
      centroid: [+(seed.centroid[0] + dLng).toFixed(6), +(seed.centroid[1] + dLat).toFixed(6)],
    });
  }
}

const now = new Date().toISOString();

const hiraOut = {
  region: '서울특별시',
  specialty: '소아청소년과',
  fetchedAt: now,
  source: 'synthetic-seed-20260426',
  hospitals,
};

const kosisOut = {
  region: '서울특별시',
  metric: '0-4세 인구',
  fetchedAt: now,
  source: 'synthetic-seed-20260426',
  dongs,
};

const root = process.cwd();
writeFileSync(join(root, 'data/mock/hira_seoul.json'), JSON.stringify(hiraOut, null, 2));
writeFileSync(join(root, 'data/mock/kosis_seoul.json'), JSON.stringify(kosisOut, null, 2));

console.log(`hira_seoul.json: ${hospitals.length} hospitals across 25 자치구`);
console.log(`kosis_seoul.json: ${dongs.length} 동, total U5 = ${dongs.reduce((s, d) => s + d.populationU5, 0).toLocaleString()}`);
