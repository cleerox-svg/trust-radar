import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import type { ThreatPoint, ArcData } from '@/hooks/useObservatory';

interface TooltipInfo {
  x: number;
  y: number;
  threat?: ThreatPoint;
  arc?: ArcData;
}

const SEVERITY_COLORS: Record<string, [number, number, number]> = {
  critical: [200, 60, 60],
  high: [232, 146, 60],
  medium: [220, 170, 50],
  low: [120, 160, 200],
  info: [90, 128, 168],
};

function getSeverityColor(severity: string, alpha = 180): [number, number, number, number] {
  const rgb = SEVERITY_COLORS[severity?.toLowerCase()] || SEVERITY_COLORS.info;
  return [...rgb, alpha] as [number, number, number, number];
}

function getTypeColor(type: string, alpha = 200): [number, number, number, number] {
  const map: Record<string, [number, number, number]> = {
    phishing:               [200,  60,  60],  // Signal Red
    credential_harvesting:  [251, 146,  60],  // Amber
    malware_distribution:   [168,  85, 247],  // Purple
    c2:                     [239,  68,  68],  // Bright red
    malicious_ip:           [120, 160, 200],  // Contrail blue
    web_attack:             [251, 113, 133],  // Rose
    brute_force:            [250, 204,  21],  // Yellow
    spam_botnet_c2:         [ 34, 211, 238],  // Teal
    typosquatting:          [220, 170,  50],  // Gold
    scanning:               [120, 160, 200],  // Contrail blue
    impersonation:          [232, 146,  60],  // Amber
  };
  const rgb = map[type] || [120, 160, 200];
  return [...rgb, alpha] as [number, number, number, number];
}

function computeBezierPath(srcLng: number, srcLat: number, tgtLng: number, tgtLat: number, segments = 30): [number, number][] {
  const midLng = (srcLng + tgtLng) / 2;
  const midLat = (srcLat + tgtLat) / 2;
  const dist = Math.sqrt(Math.pow(tgtLng - srcLng, 2) + Math.pow(tgtLat - srcLat, 2));
  const controlLng = midLng;
  const controlLat = midLat + dist * 0.3;
  const path: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    path.push([
      mt * mt * srcLng + 2 * mt * t * controlLng + t * t * tgtLng,
      mt * mt * srcLat + 2 * mt * t * controlLat + t * t * tgtLat,
    ]);
  }
  return path;
}

function bezierInterp(srcLng: number, srcLat: number, tgtLng: number, tgtLat: number, t: number): [number, number] {
  const midLng = (srcLng + tgtLng) / 2;
  const midLat = (srcLat + tgtLat) / 2;
  const dist = Math.sqrt(Math.pow(tgtLng - srcLng, 2) + Math.pow(tgtLat - srcLat, 2));
  const controlLng = midLng;
  const controlLat = midLat + dist * 0.3;
  const mt = 1 - t;
  return [
    mt * mt * srcLng + 2 * mt * t * controlLng + t * t * tgtLng,
    mt * mt * srcLat + 2 * mt * t * controlLat + t * t * tgtLat,
  ];
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface ThreatMapProps {
  threats: ThreatPoint[];
  arcs: ArcData[];
  showBeams: boolean;
  showParticles: boolean;
  showNodes: boolean;
  colorBy: 'severity' | 'type';
}

export function ThreatMap({ threats, arcs, showBeams, showParticles, showNodes, colorBy }: ThreatMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const deckRef = useRef<any>(null);
  const baseLayersRef = useRef<any[]>([]);
  const particlesRef = useRef<Array<{ arc: number; t: number; speed: number }>>([]);
  const animFrameRef = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [10, 25],
      zoom: 2,
      pitch: 20,
      bearing: 0,
      antialias: true,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const buildBaseLayers = useCallback(() => {
    const layers: any[] = [];
    const filteredThreats = threats.filter(t => t.lat && t.lng);

    // --- Source nodes: triple pass ---
    if (showNodes && filteredThreats.length > 0) {
      // Bloom
      layers.push(
        new ScatterplotLayer({
          id: 'nodes-bloom',
          data: filteredThreats,
          getPosition: (d: any) => [d.lng, d.lat],
          getRadius: (d: any) => Math.sqrt(Math.max(1, d.threat_count)) * 5400,
          getFillColor: (d: any) => getSeverityColor(d.top_severity || 'low', 6),
          radiusMinPixels: 3,
          radiusMaxPixels: 24,
        })
      );
      // Glow
      layers.push(
        new ScatterplotLayer({
          id: 'nodes-glow',
          data: filteredThreats,
          getPosition: (d: any) => [d.lng, d.lat],
          getRadius: (d: any) => Math.sqrt(Math.max(1, d.threat_count)) * 2900,
          getFillColor: (d: any) => getSeverityColor(d.top_severity || 'low', 12),
          radiusMinPixels: 2,
          radiusMaxPixels: 14,
        })
      );
      // Core
      layers.push(
        new ScatterplotLayer({
          id: 'nodes-core',
          data: filteredThreats,
          getPosition: (d: any) => [d.lng, d.lat],
          getRadius: (d: any) => Math.sqrt(Math.max(1, d.threat_count)) * 1440,
          getFillColor: (d: any) => {
            const sev = d.top_severity?.toLowerCase() || 'low';
            return getSeverityColor(sev);
          },
          stroked: true,
          filled: true,
          radiusMinPixels: 1.5,
          radiusMaxPixels: 9,
          pickable: true,
          onHover: ({ object, x, y }: any) => {
            setTooltip(object ? { x, y, threat: object } : null);
          },
        })
      );
    }

    // --- Bezier beams: dual pass ---
    if (showBeams && arcs.length > 0) {
      const arcDataWithPaths = arcs.map(a => ({
        ...a,
        bezierPath: computeBezierPath(
          a.sourcePosition[0], a.sourcePosition[1],
          a.targetPosition[0], a.targetPosition[1]
        ),
      }));

      // Glow pass
      layers.push(
        new PathLayer({
          id: 'beam-glow',
          data: arcDataWithPaths,
          getPath: (d: any) => d.bezierPath,
          getColor: (d: any) => getTypeColor(d.threat_type, 51),
          getWidth: (d: any) => Math.max(1, Math.min(3, (d.volume || 1) * 0.3)),
          widthUnits: 'pixels',
          widthMinPixels: 1,
          widthMaxPixels: 2,
        })
      );
      // Core pass
      layers.push(
        new PathLayer({
          id: 'beam-core',
          data: arcDataWithPaths,
          getPath: (d: any) => d.bezierPath,
          getColor: (d: any) => getTypeColor(d.threat_type, 76),
          getWidth: 1,
          widthUnits: 'pixels',
          widthMinPixels: 1,
          widthMaxPixels: 1,
          pickable: true,
          onHover: ({ object, x, y }: any) => {
            setTooltip(object ? { x, y, arc: object } : null);
          },
        })
      );
    }

    // --- Target destination rings ---
    if (arcs.length > 0 && (showBeams || showNodes)) {
      const targetMap = new Map<string, ArcData>();
      arcs.forEach(a => {
        const k = a.targetPosition.join(',');
        if (!targetMap.has(k)) targetMap.set(k, a);
      });
      const targetNodes = Array.from(targetMap.values());

      layers.push(
        new ScatterplotLayer({
          id: 'targets-ring',
          data: targetNodes,
          getPosition: (d: any) => d.targetPosition,
          getRadius: 12000,
          getFillColor: [255, 255, 255, 6] as [number, number, number, number],
          getLineColor: [255, 255, 255, 40] as [number, number, number, number],
          lineWidthMinPixels: 1,
          stroked: true,
          radiusMinPixels: 3,
          radiusMaxPixels: 14,
        })
      );
      layers.push(
        new ScatterplotLayer({
          id: 'targets-core',
          data: targetNodes,
          getPosition: (d: any) => d.targetPosition,
          getRadius: 3600,
          getFillColor: [255, 255, 255, 45] as [number, number, number, number],
          radiusMinPixels: 1.5,
          radiusMaxPixels: 5,
        })
      );
    }

    return layers;
  }, [threats, arcs, showBeams, showNodes, colorBy]);

  // Update overlay when data/settings change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) {
      const onLoad = () => applyLayers();
      map?.on('load', onLoad);
      return () => { map?.off('load', onLoad); };
    }
    applyLayers();

    function applyLayers() {
      if (!mapRef.current) return;
      if (deckRef.current) {
        mapRef.current.removeControl(deckRef.current);
        deckRef.current = null;
      }

      const layers = buildBaseLayers();
      baseLayersRef.current = layers;

      if (layers.length > 0) {
        const overlay = new MapboxOverlay({ interleaved: true, layers });
        mapRef.current.addControl(overlay as any);
        deckRef.current = overlay;
      }
    }
  }, [threats, arcs, showBeams, showNodes, showParticles, colorBy, buildBaseLayers]);

  // Particle animation
  useEffect(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (!showParticles || arcs.length === 0) return;

    const particles: Array<{ arc: number; t: number; speed: number }> = [];
    arcs.forEach((_, i) => {
      const n = Math.max(3, Math.ceil(((arcs[i] as any).volume || 1) * 0.5));
      for (let j = 0; j < n; j++) {
        particles.push({
          arc: i,
          t: Math.random(),
          speed: 0.004 + Math.random() * 0.002,
        });
      }
    });
    particlesRef.current = particles;

    function animate() {
      const ps = particlesRef.current;
      ps.forEach(p => {
        p.t += p.speed;
        if (p.t > 1.05) p.t = -0.05;
      });

      if (deckRef.current && mapRef.current) {
        const glowData: Array<{ pos: [number, number]; col: [number, number, number, number] }> = [];
        const coreData: Array<{ pos: [number, number]; col: [number, number, number, number] }> = [];

        ps.forEach(p => {
          const arc = arcs[p.arc];
          if (!arc) return;
          const tc = Math.max(0, Math.min(1, p.t));
          const [lon, lat] = bezierInterp(
            arc.sourcePosition[0], arc.sourcePosition[1],
            arc.targetPosition[0], arc.targetPosition[1], tc
          );
          const typeCol = getTypeColor(arc.threat_type, 14);
          glowData.push({ pos: [lon, lat], col: typeCol });
          coreData.push({ pos: [lon, lat], col: [255, 255, 255, 160] });
        });

        const particleLayers = [
          new ScatterplotLayer({
            id: 'particle-glow',
            data: glowData,
            getPosition: (d: any) => d.pos,
            radiusUnits: 'pixels' as any,
            getRadius: 2,
            getFillColor: (d: any) => d.col,
          }),
          new ScatterplotLayer({
            id: 'particle-core',
            data: coreData,
            getPosition: (d: any) => d.pos,
            radiusUnits: 'pixels' as any,
            getRadius: 1.2,
            getFillColor: (d: any) => d.col,
          }),
        ];

        deckRef.current.setProps({
          layers: [...baseLayersRef.current, ...particleLayers],
        });
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [arcs, showParticles]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none bg-cockpit/95 border border-white/10 rounded-lg px-3 py-2 text-xs max-w-xs"
          style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
        >
          {tooltip.threat && (
            <>
              <div className="font-mono font-bold text-parchment">
                {tooltip.threat.threat_count} threats
              </div>
              <div className="text-contrail/60 mt-1">
                <span className="capitalize">{tooltip.threat.top_threat_type?.replace(/_/g, ' ') || 'Mixed'}</span>
                {tooltip.threat.top_severity && (
                  <>
                    {' \u00b7 '}
                    <span className="uppercase" style={{ color: `rgb(${getSeverityColor(tooltip.threat.top_severity).slice(0, 3).join(',')})` }}>
                      {tooltip.threat.top_severity}
                    </span>
                  </>
                )}
              </div>
              {tooltip.threat.country_code && (
                <div className="text-contrail/40 mt-0.5">{tooltip.threat.country_code}</div>
              )}
              <div className="text-contrail/30 mt-1 text-[9px]">
                C:{tooltip.threat.critical} H:{tooltip.threat.high} M:{tooltip.threat.medium} L:{tooltip.threat.low}
              </div>
            </>
          )}
          {tooltip.arc && (
            <>
              <div className="font-mono font-bold text-parchment capitalize">
                {tooltip.arc.threat_type?.replace(/_/g, ' ')}
              </div>
              <div className="text-contrail/60 mt-1">{tooltip.arc.volume} threat{tooltip.arc.volume > 1 ? 's' : ''}</div>
              {tooltip.arc.brand_name && (
                <div className="text-accent mt-1">Target: {tooltip.arc.brand_name}</div>
              )}
              {tooltip.arc.source_region && (
                <div className="text-contrail/40 mt-0.5">From: {tooltip.arc.source_region}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
