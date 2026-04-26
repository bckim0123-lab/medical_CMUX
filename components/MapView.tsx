'use client';

import { useEffect, useRef, useState } from 'react';
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

type Phase = 'idle' | 'hospitals' | 'buffers' | 'risk';

function facilityIcon(h: Hospital): string {
  const n = h.name;
  if (n.includes('병원')) return 'icon-hospital';
  if (n.includes('약국')) return 'icon-pharmacy';
  if (n.includes('보건소')) return 'icon-health';
  return 'icon-clinic';
}

// Resize an image URL onto a SIZExSIZE canvas and return ImageData
function resizeToImageData(src: string, size: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      // White background for JPEG sources
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      // Letterbox: fit image inside square preserving aspect ratio
      const ratio = Math.min(size / img.naturalWidth, size / img.naturalHeight);
      const w = img.naturalWidth * ratio;
      const h = img.naturalHeight * ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(ctx.getImageData(0, 0, size, size));
    };
    img.onerror = reject;
  });
}

// Load all marker icons: hospital.svg & clinic.svg + sprite fallbacks
async function loadAllIcons(): Promise<Record<string, ImageData>> {
  const ICON_SIZE = 64;
  const SPRITE_SIZE = 32;
  const result: Record<string, ImageData> = {};

  // hospital & clinic from SVG vector icons
  const [hospitalData, clinicData] = await Promise.all([
    resizeToImageData('/hospital.svg', ICON_SIZE),
    resizeToImageData('/clinic.svg', ICON_SIZE),
  ]);
  result['icon-hospital'] = hospitalData;
  result['icon-clinic'] = clinicData;

  // pharmacy & health-center from sprite sheet (rows 2 and 3)
  await new Promise<void>((resolve) => {
    const img = new window.Image();
    img.src = '/icons.png';
    img.onload = () => {
      const ROW_H = img.naturalHeight / 4;
      (['icon-pharmacy', 'icon-health'] as const).forEach((name, offset) => {
        const row = offset + 2; // rows 2 and 3
        const canvas = document.createElement('canvas');
        canvas.width = SPRITE_SIZE;
        canvas.height = SPRITE_SIZE;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, row * ROW_H, SPRITE_SIZE, ROW_H, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
        result[name] = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      });
      resolve();
    };
    img.onerror = () => resolve(); // graceful fallback
  });

  return result;
}

export default function MapView({ mapState }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const iconsLoadedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');

  // Init map
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

  // Hospitals → symbol layer with sprite icons + clustering
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const hospitals = mapState.hospitals;
    if (!hospitals?.length) return;

    const map = mapRef.current;

    const render = (iconMap: Record<string, ImageData>) => {
      import('maplibre-gl').then((ml) => {
        Object.entries(iconMap).forEach(([name, data]) => {
          if (!map.hasImage(name)) map.addImage(name, data);
        });

        const features = hospitals.map((h) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [h.lng, h.lat] },
          properties: { id: h.id, name: h.name, gu: h.gu, specialty: h.specialty, icon: facilityIcon(h) },
        }));

        if (map.getLayer('hospitals')) map.removeLayer('hospitals');
        if (map.getLayer('cluster-count')) map.removeLayer('cluster-count');
        if (map.getLayer('clusters')) map.removeLayer('clusters');
        if (map.getSource('hospitals')) map.removeSource('hospitals');

        map.addSource('hospitals', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 40,
        });

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'hospitals',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#38bdf8',
            'circle-opacity': 0.7,
            'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 50, 22],
          },
        });
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'hospitals',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 11,
            'text-font': ['Open Sans Regular'],
          },
          paint: { 'text-color': '#fff' },
        });
        map.addLayer({
          id: 'hospitals',
          type: 'symbol',
          source: 'hospitals',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-size': [
              'match', ['get', 'icon'],
              'icon-hospital', 0.55,
              'icon-clinic', 0.55,
              0.85, // pharmacy/health (32px sprite)
            ],
            'icon-allow-overlap': true,
            'icon-anchor': 'center',
          },
        });

        map.on('click', 'hospitals', (e) => {
          const feat = e.features?.[0];
          if (!feat) return;
          const { name, gu, specialty } = feat.properties as Record<string, string>;
          const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number];
          new ml.Popup({ closeButton: false, offset: 12 })
            .setLngLat(coords)
            .setHTML(`<div style="font-size:12px;padding:6px 10px;background:#18181b;color:#f4f4f5;border-radius:6px;min-width:120px;"><b style="display:block;margin-bottom:2px">${name}</b><span style="color:#71717a">${specialty} · ${gu}</span></div>`)
            .addTo(map);
        });
        map.on('mouseenter', 'hospitals', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'hospitals', () => { map.getCanvas().style.cursor = ''; });

        setPhase('hospitals');
      });
    };

    if (iconsLoadedRef.current) {
      render({});
    } else {
      loadAllIcons()
        .then((iconMap) => { iconsLoadedRef.current = true; render(iconMap); })
        .catch(console.error);
    }
  }, [ready, mapState.hospitals]);

  // Render coverage GeoJSON layers — whatIf overrides the base coverage when set
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const coverage = mapState.whatIf?.coverage ?? mapState.coverage;
    if (!coverage) return;

    const map = mapRef.current;
    const removeLayerIfExists = (id: string) => { if (map.getLayer(id)) map.removeLayer(id); };
    const removeSourceIfExists = (id: string) => { if (map.getSource(id)) map.removeSource(id); };

    // Buffer (covered area) — green
    removeLayerIfExists('buffer-fill');
    removeLayerIfExists('buffer-line');
    removeSourceIfExists('buffer-fill');
    if (coverage.bufferGeoJSON.features.length > 0) {
      map.addSource('buffer-fill', { type: 'geojson', data: coverage.bufferGeoJSON });
      map.addLayer({ id: 'buffer-fill', type: 'fill', source: 'buffer-fill', paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.13 } }, 'hospitals');
      map.addLayer({ id: 'buffer-line', type: 'line', source: 'buffer-fill', paint: { 'line-color': '#22c55e', 'line-width': 1, 'line-opacity': 0.4 } }, 'hospitals');
    }
    setPhase('buffers');

    // Vulnerable area — red
    removeLayerIfExists('vuln-fill');
    removeLayerIfExists('vuln-line');
    removeSourceIfExists('vuln-fill');
    if (coverage.vulnerableGeoJSON.features.length > 0) {
      map.addSource('vuln-fill', { type: 'geojson', data: coverage.vulnerableGeoJSON });
      map.addLayer({ id: 'vuln-fill', type: 'fill', source: 'vuln-fill', paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.22 } }, 'buffer-fill');
      map.addLayer({ id: 'vuln-line', type: 'line', source: 'vuln-fill', paint: { 'line-color': '#ef4444', 'line-width': 1.5, 'line-opacity': 0.65 } }, 'hospitals');
    }
    setPhase('risk');
  }, [ready, mapState.coverage, mapState.whatIf]);

  // Choropleth — fill 25 자치구 polygons by riskGrade from coverage.byGu
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const coverage = mapState.whatIf?.coverage ?? mapState.coverage;
    if (!coverage) return;

    const removeLayerIfExists = (id: string) => { if (map.getLayer(id)) map.removeLayer(id); };
    const removeSourceIfExists = (id: string) => { if (map.getSource(id)) map.removeSource(id); };

    let cancelled = false;
    fetch('/seoul_gu.geojson')
      .then((r) => r.json())
      .then((geo: GeoJSON.FeatureCollection) => {
        if (cancelled || !mapRef.current) return;
        const gradeByGu = new Map<string, 'High' | 'Mid' | 'Low'>(
          coverage.byGu.map((g) => [g.gu, g.riskGrade]),
        );
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
        // Insert choropleth below buffer layers so markers stay on top
        const beforeChoropleth = map.getLayer('buffer-fill') ? 'buffer-fill'
          : map.getLayer('clusters') ? 'clusters'
          : undefined;
        map.addLayer({
          id: 'gu-fill',
          type: 'fill',
          source: 'gu-fill',
          paint: {
            'fill-color': ['match', ['get', 'riskGrade'], 'High', '#dc2626', 'Mid', '#f59e0b', 'Low', '#22c55e', 'transparent'],
            'fill-opacity': 0.35,
          },
        }, beforeChoropleth);
        map.addLayer({
          id: 'gu-line',
          type: 'line',
          source: 'gu-fill',
          paint: { 'line-color': '#0f172a', 'line-width': 1.4, 'line-opacity': 0.55 },
        }, beforeChoropleth);
        // Ensure hospital markers are always the topmost layers
        if (map.getLayer('clusters')) map.moveLayer('clusters');
        if (map.getLayer('cluster-count')) map.moveLayer('cluster-count');
        if (map.getLayer('hospitals')) map.moveLayer('hospitals');
      })
      .catch(() => { /* choropleth 없이도 시연 가능 */ });
    return () => { cancelled = true; };
  }, [ready, mapState.coverage, mapState.whatIf]);

  // What-if virtual facility marker
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
      el.style.cssText = `width:18px;height:18px;background:#fbbf24;border:3px solid #fff;border-radius:50%;box-shadow:0 0 14px rgba(251,191,36,.9);cursor:pointer;`;
      const popup = new ml.Popup({ offset: 14, closeButton: false }).setHTML(
        `<div style="font-size:11px;padding:5px 9px;background:#18181b;color:#f4f4f5;border-radius:4px;"><b>가상 시설</b><br/><span style="color:#fbbf24">${wf.newFacility.title}</span></div>`,
      );
      whatIfMarkerRef.current = new ml.Marker({ element: el })
        .setLngLat([wf.newFacility.lng, wf.newFacility.lat])
        .setPopup(popup)
        .addTo(mapRef.current!);
    });
  }, [ready, mapState.whatIf]);

  const PHASE_INFO: Partial<Record<Phase, { label: string; color: string }>> = {
    hospitals: { label: '의료기관 마커 표시', color: 'bg-sky-500' },
    buffers: { label: '골든타임 커버리지 표시', color: 'bg-emerald-500' },
    risk: { label: '취약 구역 분석 완료', color: 'bg-red-500' },
  };
  const info = PHASE_INFO[phase];

  return (
    <div className="relative h-full bg-zinc-900">
      <div className="absolute top-3 left-3 z-10 space-y-1.5 pointer-events-none">
        <div className="bg-zinc-900/90 text-zinc-100 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 font-semibold">
          서울특별시 소아청소년과 의료 공백
        </div>
        {info && (
          <div className="flex items-center gap-2 bg-zinc-900/90 text-zinc-200 text-xs px-3 py-1.5 rounded-lg border border-zinc-700">
            <span className={`w-2 h-2 rounded-full animate-pulse ${info.color}`} />
            {info.label}
          </div>
        )}
        {mapState.whatIf && (
          <div className="flex items-center gap-2 bg-amber-900/50 text-amber-200 text-xs px-3 py-1.5 rounded-lg border border-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            What-If 시뮬레이션 중
          </div>
        )}
      </div>

      <div className="absolute bottom-3 right-3 z-10 bg-zinc-900/90 text-xs text-zinc-300 p-3 rounded-lg border border-zinc-700 space-y-1.5 pointer-events-none">
        <p className="font-semibold text-zinc-100 text-[11px] mb-1">범례</p>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hospital.svg" alt="병원" style={{ width: 20, height: 20, borderRadius: 4 }} />
          <span>병원</span>
        </div>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clinic.svg" alt="의원" style={{ width: 20, height: 20, borderRadius: 4 }} />
          <span>의원</span>
        </div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500/60 border border-emerald-500" /> 커버리지</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500/60 border border-red-500" /> 취약 구역</div>
        <div className="border-t border-zinc-700 pt-1.5 mt-1 space-y-1">
          <p className="text-[10px] text-zinc-500">자치구 위험도</p>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-600/40 border border-red-700" /> High</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-600" /> Mid</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-600" /> Low</div>
        </div>
        {mapState.whatIf && (
          <div className="flex items-center gap-2 border-t border-zinc-700 pt-1.5"><span className="w-3 h-3 rounded-full bg-amber-400" /> 가상 시설</div>
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
