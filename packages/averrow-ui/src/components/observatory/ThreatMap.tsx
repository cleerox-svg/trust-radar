import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
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

const THREAT_TYPE_COLORS: Record<string, [number, number, number]> = {
  phishing: [200, 60, 60],
  typosquatting: [232, 146, 60],
  malware_distribution: [180, 60, 60],
  credential_harvesting: [200, 80, 120],
  impersonation: [120, 80, 200],
};

function getSeverityColor(severity: string): [number, number, number] {
  return SEVERITY_COLORS[severity?.toLowerCase()] || SEVERITY_COLORS.info;
}

function getThreatColor(type: string): [number, number, number] {
  return THREAT_TYPE_COLORS[type] || [120, 160, 200];
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface ThreatMapProps {
  threats: ThreatPoint[];
  arcs: ArcData[];
  showArcs: boolean;
  showNodes: boolean;
  colorBy: 'severity' | 'type';
}

export function ThreatMap({ threats, arcs, showArcs, showNodes, colorBy }: ThreatMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const deckRef = useRef<any>(null);
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import('deck.gl').then(({ MapboxOverlay, ScatterplotLayer, ArcLayer }) => {
      if (deckRef.current) {
        map.removeControl(deckRef.current);
      }

      const layers = [];

      // Threat points layer — data is CLUSTERED (grouped by lat/lng)
      if (showNodes && threats.length > 0) {
        layers.push(
          new ScatterplotLayer({
            id: 'threat-points',
            data: threats.filter(t => t.lat && t.lng),
            getPosition: (d: ThreatPoint) => [d.lng, d.lat],
            getRadius: (d: ThreatPoint) => {
              // Size based on threat count
              if (d.threat_count >= 50) return 15000;
              if (d.threat_count >= 20) return 10000;
              if (d.threat_count >= 5) return 7000;
              return 4000;
            },
            getFillColor: (d: ThreatPoint) => {
              if (colorBy === 'severity') {
                const sev = d.top_severity?.toLowerCase() || 'low';
                return [...getSeverityColor(sev), 180];
              }
              return [...getThreatColor(d.top_threat_type || 'phishing'), 180];
            },
            radiusMinPixels: 3,
            radiusMaxPixels: 20,
            pickable: true,
            onHover: ({ object, x, y }: any) => {
              setTooltip(object ? { x, y, threat: object } : null);
            },
          })
        );
      }

      if (showArcs && arcs.length > 0) {
        layers.push(
          new ArcLayer({
            id: 'threat-arcs',
            data: arcs,
            getSourcePosition: (d: ArcData) => d.sourcePosition,
            getTargetPosition: (d: ArcData) => d.targetPosition,
            getSourceColor: (d: ArcData) => [...getThreatColor(d.threat_type), 100],
            getTargetColor: (d: ArcData) => [...getThreatColor(d.threat_type), 200],
            getWidth: (d: ArcData) => Math.min(d.volume, 5),
            greatCircle: true,
            pickable: true,
            onHover: ({ object, x, y }: any) => {
              setTooltip(object ? { x, y, arc: object } : null);
            },
          })
        );
      }

      const overlay = new MapboxOverlay({
        interleaved: true,
        layers,
      });

      map.addControl(overlay as any);
      deckRef.current = overlay;
    });
  }, [threats, arcs, showArcs, showNodes, colorBy]);

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
                    {' · '}
                    <span className="uppercase" style={{ color: `rgb(${getSeverityColor(tooltip.threat.top_severity).join(',')})` }}>
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
