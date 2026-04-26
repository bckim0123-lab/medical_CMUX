// Client-side What-if simulator. Apply a single policy option as one virtual
// facility and recompute the covered union + vulnerable diff against Seoul.
// Reuses existing CoverageResult shape so MapView renders unchanged.

import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import type { CoverageResult, PolicyOption } from '@/lib/state';

// Same constants the server-side spatial agent uses. Kept inline so this
// module is browser-safe (no node-only deps).
const SEOUL_BBOX: [number, number, number, number] = [126.764, 37.428, 127.184, 37.701];
const DEFAULT_BUFFER_KM = 1.5;

export type WhatIfResult = {
  optionId: string;
  coverage: CoverageResult;
  newFacility: { lng: number; lat: number; title: string };
  delta: {
    beforeAreaKm2: number;
    afterAreaKm2: number;
    reducedAreaKm2: number;
    reducedPct: number;
  };
};

export function simulatePolicyOption(
  baseCoverage: CoverageResult,
  opt: PolicyOption,
  bufferKm = DEFAULT_BUFFER_KM,
): WhatIfResult | null {
  const newBuffer = turf.buffer(turf.point(opt.location), bufferKm, { units: 'kilometers' });
  if (!newBuffer) return null;

  const existingFeatures = baseCoverage.bufferGeoJSON.features as Feature<Polygon | MultiPolygon>[];
  const allCoveredFc = turf.featureCollection([
    ...existingFeatures,
    newBuffer as Feature<Polygon>,
  ]);

  const combinedUnion = unionAll(allCoveredFc);
  const seoul = turf.bboxPolygon(SEOUL_BBOX) as Feature<Polygon>;
  const newVulnerable = combinedUnion
    ? (turf.difference(turf.featureCollection([seoul, combinedUnion])) as Feature<
        Polygon | MultiPolygon
      > | null)
    : seoul;

  const totalArea = baseCoverage.totalAreaKm2;
  const newAreaKm2 = newVulnerable ? turf.area(newVulnerable) / 1_000_000 : 0;
  const newRatio = totalArea > 0 ? newAreaKm2 / totalArea : 0;
  const beforeArea = baseCoverage.vulnerableAreaKm2;
  const reducedAreaKm2 = Math.max(0, beforeArea - newAreaKm2);
  const reducedPct = beforeArea > 0 ? (reducedAreaKm2 / beforeArea) * 100 : 0;

  return {
    optionId: opt.id,
    coverage: {
      ...baseCoverage,
      vulnerableAreaKm2: newAreaKm2,
      vulnerableRatio: newRatio,
      vulnerableGeoJSON: newVulnerable
        ? (turf.featureCollection([newVulnerable]) as FeatureCollection)
        : (turf.featureCollection([]) as FeatureCollection),
      bufferGeoJSON: combinedUnion
        ? (turf.featureCollection([combinedUnion]) as FeatureCollection)
        : (turf.featureCollection([]) as FeatureCollection),
    },
    newFacility: {
      lng: opt.location[0],
      lat: opt.location[1],
      title: opt.title,
    },
    delta: {
      beforeAreaKm2: beforeArea,
      afterAreaKm2: newAreaKm2,
      reducedAreaKm2,
      reducedPct,
    },
  };
}

function unionAll(fc: FeatureCollection): Feature<Polygon | MultiPolygon> | null {
  const polys = fc.features.filter(
    (f): f is Feature<Polygon | MultiPolygon> =>
      f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon',
  );
  if (polys.length === 0) return null;
  if (polys.length === 1) return polys[0];
  return turf.union(turf.featureCollection(polys)) as Feature<Polygon | MultiPolygon> | null;
}
