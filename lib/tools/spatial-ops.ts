// Spatial operations — Turf.js v7 wrappers.
// Provides: buffer build, union, seoul-bbox difference, area in km², gu attribution.

import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import type { Hospital, PopulationDong } from '@/lib/state';

// Approximate Seoul administrative bbox (slightly padded). Enough for demo
// difference op; replace with real 25-구 boundary GeoJSON for higher fidelity.
export const SEOUL_BBOX: [number, number, number, number] = [126.764, 37.428, 127.184, 37.701];

export function seoulPolygon(): Feature<Polygon> {
  return turf.bboxPolygon(SEOUL_BBOX) as Feature<Polygon>;
}

export function buildHospitalBuffers(hospitals: Hospital[], radiusKm: number): FeatureCollection {
  const points = turf.featureCollection(
    hospitals.map((h) => turf.point([h.lng, h.lat], { id: h.id, gu: h.gu, name: h.name })),
  );
  const buffered = turf.buffer(points, radiusKm, { units: 'kilometers' });
  if (!buffered) {
    return turf.featureCollection([]);
  }
  return buffered as FeatureCollection;
}

export function unionAll(fc: FeatureCollection): Feature<Polygon | MultiPolygon> | null {
  const polys = fc.features.filter(
    (f): f is Feature<Polygon | MultiPolygon> =>
      f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon',
  );
  if (polys.length === 0) return null;
  if (polys.length === 1) return polys[0];
  // Turf v7 expects a FeatureCollection of polygons.
  return turf.union(turf.featureCollection(polys)) as Feature<Polygon | MultiPolygon> | null;
}

export function differenceFeature(
  base: Feature<Polygon | MultiPolygon>,
  subtract: Feature<Polygon | MultiPolygon>,
): Feature<Polygon | MultiPolygon> | null {
  return turf.difference(turf.featureCollection([base, subtract])) as Feature<
    Polygon | MultiPolygon
  > | null;
}

export function areaKm2(feature: Feature | FeatureCollection | null): number {
  if (!feature) return 0;
  return turf.area(feature) / 1_000_000;
}

// Returns the dongs whose centroid is NOT inside the covered union.
export function dongsOutsideCoverage(
  dongs: PopulationDong[],
  covered: Feature<Polygon | MultiPolygon> | null,
): PopulationDong[] {
  if (!covered) return dongs;
  return dongs.filter((d) => {
    const pt = turf.point(d.centroid);
    return !turf.booleanPointInPolygon(pt, covered);
  });
}
