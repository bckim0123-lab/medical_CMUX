import type { Agent, AgentEvent } from './index';
import type { GuCoverage, OrchestrationState, RiskGrade } from '@/lib/state';
import {
  buildHospitalBuffers,
  unionAll,
  seoulPolygon,
  differenceFeature,
  areaKm2,
  dongsOutsideCoverage,
} from '@/lib/tools/spatial-ops';
import * as turf from '@turf/turf';

// 영유아·소아 응급 도보·차량 접근성 기준. PRD는 예시로 3km를 들었으나
// 실제 영유아 부모 도보 + 짧은 차량 이동 기준은 1.5km가 보다 현실적이라
// 시연 기준값으로 채택. (env로 오버라이드 가능)
const BUFFER_KM = Number(process.env.BUFFER_KM ?? 1.5);

function gradeFromUncovered(ratio: number): RiskGrade {
  if (ratio >= 0.4) return 'High';
  if (ratio >= 0.15) return 'Mid';
  return 'Low';
}

export const spatialAgent: Agent = {
  name: 'spatial',
  async *run(state: OrchestrationState): AsyncGenerator<AgentEvent, Partial<OrchestrationState>, void> {
    const hospitals = state.hospitals ?? [];
    const population = state.population ?? [];

    yield { type: 'log', agent: 'spatial', message: `골든타임 반경 ${BUFFER_KM}km 버퍼 ${hospitals.length}개 생성...` };
    yield { type: 'tool', agent: 'spatial', tool: 'calculate_buffer', args: { radiusKm: BUFFER_KM } };
    const buffers = buildHospitalBuffers(hospitals, BUFFER_KM);

    yield { type: 'log', agent: 'spatial', message: '버퍼 union 연산 중...' };
    const coverageUnion = unionAll(buffers);

    yield { type: 'log', agent: 'spatial', message: '서울 영역에서 covered 영역 차집합 산출...' };
    yield { type: 'tool', agent: 'spatial', tool: 'difference_polygon' };
    const seoul = seoulPolygon();
    const vulnerable = coverageUnion ? differenceFeature(seoul, coverageUnion) : seoul;
    const totalAreaKm2 = areaKm2(seoul);
    const vulnerableAreaKm2 = areaKm2(vulnerable);
    const vulnerableRatio = totalAreaKm2 > 0 ? vulnerableAreaKm2 / totalAreaKm2 : 0;

    // Per-구 breakdown by population uncovered (centroid in/out test)
    const outsideDongs = dongsOutsideCoverage(population, coverageUnion);
    const outsideByGu = new Map<string, number>();
    for (const d of outsideDongs) outsideByGu.set(d.gu, (outsideByGu.get(d.gu) ?? 0) + d.populationU5);
    const totalByGu = new Map<string, number>();
    for (const d of population) totalByGu.set(d.gu, (totalByGu.get(d.gu) ?? 0) + d.populationU5);
    const hospitalsByGu = new Map<string, number>();
    for (const h of hospitals) hospitalsByGu.set(h.gu, (hospitalsByGu.get(h.gu) ?? 0) + 1);

    const byGu: GuCoverage[] = [...totalByGu.entries()]
      .map(([gu, pop]) => {
        const uncovered = outsideByGu.get(gu) ?? 0;
        const ratio = pop > 0 ? uncovered / pop : 0;
        return {
          gu,
          hospitalCount: hospitalsByGu.get(gu) ?? 0,
          populationU5: pop,
          uncoveredPopulationU5: uncovered,
          uncoveredRatio: ratio,
          riskGrade: gradeFromUncovered(ratio),
        };
      })
      .sort((a, b) => b.uncoveredRatio - a.uncoveredRatio);

    const overallGrade = gradeFromUncovered(vulnerableRatio);

    yield {
      type: 'log',
      agent: 'spatial',
      message: `취약 면적 ${vulnerableAreaKm2.toFixed(1)}㎢ / ${totalAreaKm2.toFixed(1)}㎢ (${(vulnerableRatio * 100).toFixed(1)}%) → 종합 등급 ${overallGrade}`,
    };

    const top3 = byGu.slice(0, 3).map((g) => `${g.gu} ${g.riskGrade}(${(g.uncoveredRatio * 100).toFixed(0)}%)`).join(', ');
    yield { type: 'log', agent: 'spatial', message: `취약 상위 3개 자치구: ${top3}` };

    return {
      coverage: {
        bufferKm: BUFFER_KM,
        vulnerableAreaKm2,
        totalAreaKm2,
        vulnerableRatio,
        riskGrade: overallGrade,
        vulnerableGeoJSON: vulnerable
          ? turf.featureCollection([vulnerable])
          : turf.featureCollection([]),
        bufferGeoJSON: coverageUnion
          ? turf.featureCollection([coverageUnion])
          : turf.featureCollection([]),
        byGu,
      },
    };
  },
};
