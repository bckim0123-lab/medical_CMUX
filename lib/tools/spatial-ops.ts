// Spatial operations — Turf.js wrappers.
// buffer (반경 폴리곤), difference (취약 구역), area (㎢)

import * as turf from '@turf/turf';
import type { Hospital } from '@/lib/state';

export function buildHospitalBuffers(hospitals: Hospital[], radiusKm: number) {
  const points = turf.featureCollection(
    hospitals.map((h) => turf.point([h.lng, h.lat], { id: h.id, name: h.name })),
  );
  return turf.buffer(points, radiusKm, { units: 'kilometers' });
}

export function unionFeatureCollection(_fc: GeoJSON.FeatureCollection) {
  // turf v7 union signature changed — implement when wiring spatial agent.
  // Placeholder so spatial agent imports compile.
  return null;
}

export function areaKm2(feature: GeoJSON.Feature | GeoJSON.FeatureCollection) {
  return turf.area(feature) / 1_000_000;
}
