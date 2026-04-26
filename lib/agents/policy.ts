import type { Agent, AgentEvent } from './index';
import type { OrchestrationState, PolicyOption } from '@/lib/state';

// Rule-based simulator: pick the highest-uncovered 자치구 and propose three
// candidate interventions whose expected coverage gain is computed from the
// uncovered population share. A future LLM-assisted version can rank these
// against budget/feasibility and add narrative rationale.

const NEW_CENTER_COST = 3_500_000_000; // KRW, 신규 소아 진료센터 평균 (가정)
const SHUTTLE_COST = 250_000_000;       // 셔틀 운영 1년 (가정)
const TELEMED_COST = 800_000_000;       // 원격진료 허브 구축 (가정)

export const policyAgent: Agent = {
  name: 'policy',
  async *run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    const coverage = state.coverage;
    if (!coverage || coverage.byGu.length === 0) {
      yield { type: 'log', agent: 'policy', message: 'coverage 데이터 없음 — 정책 생성 스킵' };
      return { options: [] };
    }

    yield { type: 'tool', agent: 'policy', tool: 'simulate_placement' };
    const top = coverage.byGu.filter((g) => g.uncoveredPopulationU5 > 0).slice(0, 3);
    yield {
      type: 'log',
      agent: 'policy',
      message: `우선 대상 ${top.map((t) => t.gu).join(', ') || '없음'} — 3종 대안 시뮬레이션`,
    };

    const options: PolicyOption[] = [];

    top.forEach((target, idx) => {
      const baseGain = Math.min(95, Math.round(target.uncoveredRatio * 120));

      options.push({
        id: `opt-new-${idx}`,
        type: 'NewCenter',
        title: `${target.gu} 신규 소아 진료센터 신설`,
        targetGu: target.gu,
        location: estimateCenterLocation(target.gu, 'NewCenter'),
        expectedCoverageGainPct: baseGain,
        estimatedCostKrw: NEW_CENTER_COST,
        rationale: `${target.gu} 영유아 ${target.populationU5.toLocaleString()}명 중 ${target.uncoveredPopulationU5.toLocaleString()}명(${(target.uncoveredRatio * 100).toFixed(0)}%)이 골든타임 반경 외. 신규 센터 1개소 설치 시 인접 동 커버리지 약 ${baseGain}% 회복 예상.`,
      });

      options.push({
        id: `opt-shuttle-${idx}`,
        type: 'ShuttleLink',
        title: `${target.gu} 보건소-거점병원 셔틀 운영`,
        targetGu: target.gu,
        location: estimateCenterLocation(target.gu, 'ShuttleLink'),
        expectedCoverageGainPct: Math.round(baseGain * 0.55),
        estimatedCostKrw: SHUTTLE_COST,
        rationale: `신규 인프라 없이 기존 거점병원과 보건소를 연계하는 셔틀로 ${target.gu} 우선 동의 접근성 보강. 신축 대비 ROI 7배 추정.`,
      });

      options.push({
        id: `opt-telemed-${idx}`,
        type: 'TelemedHub',
        title: `${target.gu} 원격진료 허브 구축`,
        targetGu: target.gu,
        location: estimateCenterLocation(target.gu, 'TelemedHub'),
        expectedCoverageGainPct: Math.round(baseGain * 0.7),
        estimatedCostKrw: TELEMED_COST,
        rationale: `보건소 1곳에 비대면 진료 키트와 소아과 연결망 구축. 야간·주말 응급 대응 공백 해소.`,
      });
    });

    yield {
      type: 'log',
      agent: 'policy',
      message: `${options.length}개 대안 생성 완료 (신규센터/셔틀/원격진료 × 상위 ${top.length}개 구)`,
    };
    return { options };
  },
};

function estimateCenterLocation(gu: string, optionType?: 'NewCenter' | 'ShuttleLink' | 'TelemedHub'): [number, number] {
  // Lookup table of 25 자치구 centroids (matches data/mock fixture seeds).
  const t: Record<string, [number, number]> = {
    강남구: [127.0473, 37.5172], 강동구: [127.1238, 37.5301], 강북구: [127.0254, 37.6396],
    강서구: [126.8495, 37.5509], 관악구: [126.9516, 37.4784], 광진구: [127.0823, 37.5384],
    구로구: [126.8874, 37.4954], 금천구: [126.9024, 37.4572], 노원구: [127.0568, 37.6543],
    도봉구: [127.0471, 37.6688], 동대문구: [127.0397, 37.5744], 동작구: [126.9395, 37.5124],
    마포구: [126.9019, 37.5663], 서대문구: [126.9368, 37.5791], 서초구: [127.0327, 37.4836],
    성동구: [127.0366, 37.5634], 성북구: [127.0167, 37.5894], 송파구: [127.1059, 37.5145],
    양천구: [126.8666, 37.5170], 영등포구: [126.8955, 37.5263], 용산구: [126.9659, 37.5326],
    은평구: [126.9290, 37.6027], 종로구: [126.9788, 37.5729], 중구: [126.9979, 37.5640],
    중랑구: [127.0926, 37.6063],
  };
  const c = t[gu] ?? [126.978, 37.5665];
  // Push the proposed facility ~2.5km outward toward the district fringe so
  // a what-if simulation produces visible coverage gain. Direction is
  // deterministic per (gu, optionType) so different options for the same
  // 자치구 land in different spots — visually distinguishable on the map.
  const shiftKm = 2.5;
  const seed = simpleHash(gu + (optionType ?? ''));
  const angle = (seed % 360) * (Math.PI / 180);
  const dLat = (shiftKm * Math.sin(angle)) / 111;
  const dLng = (shiftKm * Math.cos(angle)) / (111 * Math.cos((c[1] * Math.PI) / 180));
  return [+(c[0] + dLng).toFixed(6), +(c[1] + dLat).toFixed(6)];
}

function simpleHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
