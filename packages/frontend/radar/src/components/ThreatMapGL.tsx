import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer, ScatterplotLayer } from "@deck.gl/layers";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PickingInfo } from "@deck.gl/core";

// CARTO Dark Matter — free, no API key required
const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const INITIAL_VIEW_STATE = {
  longitude: 0,
  latitude: 20,
  zoom: 1.6,
  pitch: 30,
  bearing: 0,
};

export interface ThreatPoint {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  country_code?: string;
  lat: number;
  lng: number;
  source?: string;
}

export interface AttackArc {
  sourcePosition: [number, number];
  targetPosition: [number, number];
  severity: string;
  title: string;
}

interface HeatmapCountry {
  country_code: string;
  count: number;
}

interface Props {
  threats: ThreatPoint[];
  heatmapData?: HeatmapCountry[];
  onCountryClick?: (countryCode: string) => void;
  className?: string;
}

function severityColor(severity: string): [number, number, number, number] {
  switch (severity) {
    case "critical": return [239, 68, 68, 220];
    case "high":     return [249, 115, 22, 200];
    case "medium":   return [234, 179, 8, 180];
    case "low":      return [59, 130, 246, 160];
    default:         return [100, 116, 139, 120];
  }
}

function severityArcColor(severity: string): [number, number, number, number] {
  switch (severity) {
    case "critical": return [239, 68, 68, 180];
    case "high":     return [249, 115, 22, 160];
    case "medium":   return [234, 179, 8, 140];
    default:         return [59, 130, 246, 120];
  }
}

interface TooltipInfo {
  x: number;
  y: number;
  object: {
    title?: string;
    severity?: string;
    type?: string;
    count?: number;
    country_code?: string;
    properties?: { name?: string; ISO_A2?: string };
  };
  layer?: { id?: string };
}

export function ThreatMapGL({ threats, heatmapData, onCountryClick, className }: Props) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  // Build arcs: each threat with lat/lng arcs from a random "attacker" position
  // In production, arcs would come from actual source→target pairs
  const arcs = useMemo<AttackArc[]>(() => {
    return threats
      .filter((t) => t.severity === "critical" || t.severity === "high")
      .slice(0, 60)
      .map((t) => ({
        // Slightly offset source to create arc visual
        sourcePosition: [t.lng + (Math.random() - 0.5) * 40, t.lat + (Math.random() - 0.5) * 20] as [number, number],
        targetPosition: [t.lng, t.lat] as [number, number],
        severity: t.severity,
        title: t.title,
      }));
  }, [threats]);

  // Threat scatter points
  const scatterData = useMemo(
    () =>
      threats.map((t) => ({
        ...t,
        coordinates: [t.lng, t.lat] as [number, number],
      })),
    [threats]
  );

  const layers = [
    // Arc layer — animated attack arcs for critical/high threats
    new ArcLayer<AttackArc>({
      id: "attack-arcs",
      data: arcs,
      getSourcePosition: (d) => d.sourcePosition,
      getTargetPosition: (d) => d.targetPosition,
      getSourceColor: (d) => severityArcColor(d.severity),
      getTargetColor: (d) => severityArcColor(d.severity),
      getWidth: 1.5,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      onHover: (info: PickingInfo) => {
        if (info.object) {
          setTooltip({
            x: info.x,
            y: info.y,
            object: info.object as AttackArc & { title?: string; severity?: string },
            layer: { id: "attack-arcs" },
          });
        } else {
          setTooltip(null);
        }
      },
    }),

    // Scatter layer — pulsing threat hotspots
    new ScatterplotLayer<typeof scatterData[0]>({
      id: "threat-hotspots",
      data: scatterData,
      getPosition: (d) => d.coordinates,
      getRadius: (d) => {
        switch (d.severity) {
          case "critical": return 60000;
          case "high":     return 45000;
          case "medium":   return 30000;
          default:         return 20000;
        }
      },
      getFillColor: (d) => severityColor(d.severity),
      getLineColor: (d) => severityColor(d.severity).map((c, i) => i < 3 ? Math.min(c + 40, 255) : 180) as [number, number, number, number],
      lineWidthMinPixels: 1,
      stroked: true,
      radiusMinPixels: 3,
      radiusMaxPixels: 18,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      onHover: (info: PickingInfo) => {
        if (info.object) {
          setTooltip({
            x: info.x,
            y: info.y,
            object: info.object as ThreatPoint,
            layer: { id: "threat-hotspots" },
          });
        } else {
          setTooltip(null);
        }
      },
      onClick: (info: PickingInfo) => {
        const obj = info.object as ThreatPoint;
        if (obj?.country_code && onCountryClick) {
          onCountryClick(obj.country_code);
        }
      },
    }),
  ];

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={{ dragRotate: true, touchRotate: true }}
        layers={layers}
        style={{ position: "absolute", inset: 0 }}
        onViewStateChange={() => setTooltip(null)}
      >
        <Map
          mapStyle={MAP_STYLE}
          attributionControl={false}
          reuseMaps
        />
      </DeckGL>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none rounded-lg px-3 py-2 text-xs font-mono"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: "rgba(10, 14, 26, 0.92)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
            backdropFilter: "blur(8px)",
            maxWidth: 220,
          }}
        >
          {tooltip.object.title && (
            <div className="font-semibold text-xs truncate mb-0.5">{tooltip.object.title}</div>
          )}
          {tooltip.object.severity && (
            <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
              Severity: <span style={{ color: `var(--threat-${tooltip.object.severity})` }}>{tooltip.object.severity}</span>
            </div>
          )}
          {tooltip.object.type && (
            <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              Type: {tooltip.object.type}
            </div>
          )}
          {tooltip.object.country_code && (
            <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              Country: {tooltip.object.country_code}
            </div>
          )}
        </div>
      )}

      {/* Attribution */}
      <div
        className="absolute bottom-2 right-2 text-[9px] font-mono opacity-40 z-10"
        style={{ color: "var(--text-tertiary)" }}
      >
        © CARTO © OpenStreetMap
      </div>
    </div>
  );
}
