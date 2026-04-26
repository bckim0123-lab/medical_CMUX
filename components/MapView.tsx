'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Hospital, CoverageResult } from '@/lib/state';

export interface MapState {
  hospitals?: Hospital[];
  coverage?: CoverageResult;
  whatIf?: {
    coverage: CoverageResult;
    newFacility: { lng: number; lat: number; title: string };
  } | null;
}

interface MapViewProps {
  mapState: MapState;
}

type PhaseLabel = 'idle' | 'hospitals' | 'buffers' | 'risk';

export default function MapView({ mapState }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const markersRef = useRef<import('maplibre-gl').Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<PhaseLabel>('idle');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: import('maplibre-gl').Map;

    import('maplibre-gl').then((ml) => {
      map = new ml.Map({
        container: containerRef.current!,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [126.978, 37.5665],
        zoom: 10.5,
      });
      map.on('load', () => setReady(true));
      mapRef.current = map;
    });

    return () => { map?.remove(); };
  }, []);

  // Render hospitals as markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const hospitals = mapState.hospitals;
    if (!hospitals?.length) return;

    import('maplibre-gl').then((ml) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      hospitals.forEach((h) => {
        const el = document.createElement('div');
        el.style.cssText = `
          width:10px;height:10px;
          background:#38bdf8;border:2px solid #fff;border-radius:50%;
          cursor:pointer;box-shadow:0 0 6px rgba(56,189,248,.7);
        `;
        const popup = new ml.Popup({ offset: 12, closeButton: false }).setHTML(
          `<div style="font-size:11px;padding:4px 8px;background:#18181b;color:#f4f4f5;border-radius:4px;">
            <b>${h.name}</b><br/><span style="color:#71717a">${h.specialty} · ${h.gu}</span>
          </div>`
        );
        const marker = new ml.Marker({ element: el })
          .setLngLat([h.lng, h.lat])
          .setPopup(popup)
          .addTo(mapRef.current!);
        markersRef.current.push(marker);
      });
      setPhase('hospitals');
    });
  }, [ready, mapState.hospitals]);

  // Render coverage GeoJSON layers — whatIf overrides the base coverage when set
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const coverage = mapState.whatIf?.coverage ?? mapState.coverage;
    if (!coverage) return;

    const map = mapRef.current;

    const removeLayerIfExists = (id: string) => {
      if (map.getLayer(id)) map.removeLayer(id);
    };
    const removeSourceIfExists = (id: string) => {
      if (map.getSource(id)) map.removeSource(id);
    };

    // Buffer (covered area) — buffer-fill source는 buffer-fill / buffer-line
    // 두 layer 가 함께 사용하므로, source 제거 전에 두 layer 를 모두 빼야 함.
    removeLayerIfExists('buffer-fill');
    removeLayerIfExists('buffer-line');
    removeSourceIfExists('buffer-fill');
    if (coverage.bufferGeoJSON.features.length > 0) {
      map.addSource('buffer-fill', { type: 'geojson', data: coverage.bufferGeoJSON });
      map.addLayer({
        id: 'buffer-fill',
        type: 'fill',
        source: 'buffer-fill',
        paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: 'buffer-line',
        type: 'line',
        source: 'buffer-fill',
        paint: { 'line-color': '#22c55e', 'line-width': 1, 'line-opacity': 0.5 },
      });
    }
    setPhase('buffers');

    // Vulnerable area — same source-shared-by-two-layers pattern.
    removeLayerIfExists('vuln-fill');
    removeLayerIfExists('vuln-line');
    removeSourceIfExists('vuln-fill');
    if (coverage.vulnerableGeoJSON.features.length > 0) {
      map.addSource('vuln-fill', { type: 'geojson', data: coverage.vulnerableGeoJSON });
      map.addLayer(
        {
          id: 'vuln-fill',
          type: 'fill',
          source: 'vuln-fill',
          paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.25 },
        },
        'buffer-fill',
      );
      map.addLayer({
        id: 'vuln-line',
        type: 'line',
        source: 'vuln-fill',
        paint: { 'line-color': '#ef4444', 'line-width': 1.5, 'line-opacity': 0.7 },
      });
    }
    setPhase('risk');
  }, [ready, mapState.coverage, mapState.whatIf]);

  // Choropleth — fill 25 자치구 polygons by riskGrade from coverage.byGu.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const coverage = mapState.whatIf?.coverage ?? mapState.coverage;
    if (!coverage) return;

    const removeLayerIfExists = (id: string) => {
      if (map.getLayer(id)) map.removeLayer(id);
    };
    const removeSourceIfExists = (id: string) => {
      if (map.getSource(id)) map.removeSource(id);
    };

    let cancelled = false;
    fetch('/seoul_gu.geojson')
      .then((r) => r.json())
      .then((geo: GeoJSON.FeatureCollection) => {
        if (cancelled || !mapRef.current) return;
        const gradeByGu = new Map<string, 'High' | 'Mid' | 'Low'>(
          coverage.byGu.map((g) => [g.gu, g.riskGrade]),
        );
        // Inject riskGrade into each feature so the fill expression can read it.
        const featuresWithGrade: GeoJSON.Feature[] = geo.features.map((f) => {
          const name = (f.properties as { name?: string } | null)?.name ?? '';
          const grade = gradeByGu.get(name) ?? 'none';
          return { ...f, properties: { ...f.properties, name, riskGrade: grade } };
        });
        const fcWithGrade: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: featuresWithGrade };

        removeLayerIfExists('gu-fill');
        removeLayerIfExists('gu-line');
        removeSourceIfExists('gu-fill');
        map.addSource('gu-fill', { type: 'geojson', data: fcWithGrade });
        // Choropleth on top of vuln/buffer overlays so 자치구 색상이 주된
        // 시각 신호가 됨. 마커는 별도 DOM 요소라 layer order 영향 없음.
        map.addLayer({
          id: 'gu-fill',
          type: 'fill',
          source: 'gu-fill',
          paint: {
            'fill-color': [
              'match',
              ['get', 'riskGrade'],
              'High', '#dc2626',
              'Mid', '#f59e0b',
              'Low', '#22c55e',
              'transparent',
            ],
            'fill-opacity': 0.35,
          },
        });
        map.addLayer({
          id: 'gu-line',
          type: 'line',
          source: 'gu-fill',
          paint: { 'line-color': '#0f172a', 'line-width': 1.4, 'line-opacity': 0.55 },
        });
      })
      .catch(() => {
        // GeoJSON 로드 실패는 무시 (choropleth 없이도 시연 가능)
      });
    return () => {
      cancelled = true;
    };
  }, [ready, mapState.coverage, mapState.whatIf]);

  // Render the virtual facility marker for the active what-if simulation.
  const whatIfMarkerRef = useRef<import('maplibre-gl').Marker | null>(null);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    whatIfMarkerRef.current?.remove();
    whatIfMarkerRef.current = null;
    const wf = mapState.whatIf;
    if (!wf) return;
    import('maplibre-gl').then((ml) => {
      if (!mapRef.current) return;
      const el = document.createElement('div');
      el.style.cssText = `
        width:18px;height:18px;
        background:#fbbf24;border:3px solid #fff;border-radius:50%;
        box-shadow:0 0 14px rgba(251,191,36,.9);
        cursor:pointer;
      `;
      const popup = new ml.Popup({ offset: 14, closeButton: false }).setHTML(
        `<div style="font-size:11px;padding:5px 9px;background:#18181b;color:#f4f4f5;border-radius:4px;">
          <b>가상 시설</b><br/><span style="color:#fbbf24">${wf.newFacility.title}</span>
        </div>`,
      );
      whatIfMarkerRef.current = new ml.Marker({ element: el })
        .setLngLat([wf.newFacility.lng, wf.newFacility.lat])
        .setPopup(popup)
        .addTo(mapRef.current!);
    });
  }, [ready, mapState.whatIf]);

  const PHASE_INFO: Partial<Record<PhaseLabel, { label: string; color: string }>> = {
    hospitals: { label: '의료기관 마커 표시', color: 'bg-sky-500' },
    buffers: { label: '골든타임 커버리지 표시', color: 'bg-emerald-500' },
    risk: { label: '취약 구역 분석 완료', color: 'bg-red-500' },
  };
  const info = PHASE_INFO[phase];

  return (
    <div className="relative h-full bg-zinc-900">
      <div className="absolute top-3 left-3 z-10 space-y-1.5 pointer-events-none">
        <div className="bg-zinc-900/90 text-zinc-100 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 font-semibold">
          서울특별시 소아청소년과 의료 공백 분석
        </div>
        {info && (
          <div className="flex items-center gap-2 bg-zinc-900/90 text-zinc-200 text-xs px-3 py-1.5 rounded-lg border border-zinc-700">
            <span className={`w-2 h-2 rounded-full animate-pulse ${info.color}`} />
            {info.label}
          </div>
        )}
      </div>

      <div className="absolute bottom-3 right-3 z-10 bg-zinc-900/90 text-xs text-zinc-300 p-2.5 rounded-lg border border-zinc-700 space-y-1.5 pointer-events-none">
        <p className="font-semibold text-zinc-100 text-[11px]">범례</p>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-sky-400" /> 의료기관</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500/60 border border-emerald-500" /> 커버리지</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500/60 border border-red-500" /> 취약 구역</div>
        <div className="border-t border-zinc-700 pt-1 mt-1">
          <p className="text-[10px] text-zinc-500 mb-1">자치구 위험도</p>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-600/40 border border-red-700" /> High</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-600" /> Mid</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-600" /> Low</div>
        </div>
        {mapState.whatIf && (
          <div className="flex items-center gap-2 border-t border-zinc-700 pt-1 mt-1"><span className="w-3 h-3 rounded-full bg-amber-400" /> 가상 시설</div>
        )}
      </div>

      <div ref={containerRef} className="w-full h-full" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <div className="text-center text-zinc-500">
            <div className="w-7 h-7 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">지도 로딩 중...</p>
          </div>
        </div>
      )}
    </div>
  );
}
