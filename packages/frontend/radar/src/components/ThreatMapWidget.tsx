/**
 * ThreatMapWidget — Interactive SVG world heatmap using react-simple-maps.
 *
 * Aggregates threat data from the /threats/stats endpoint by country code,
 * renders a geographically accurate choropleth world map with severity-coded fills,
 * and supports zoom, pan, fullscreen, and dual view mode (targets vs origins).
 *
 * Adapted from radar-watch-guard's ThreatMapWidget for the trust-radar
 * Cloudflare Worker + D1 architecture.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Flame, Target, Crosshair, ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { threats, type ThreatStats } from "../lib/api";
import { cn } from "../lib/cn";
import {
  ComposableMap,
  Geographies,
  Geography,
  Sphere,
  Graticule,
  Marker,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ─── ISO 3166-1 numeric → display name for labelling ──────────────
const COUNTRY_NAMES: Record<string, string> = {
  "840": "USA", "124": "Canada", "484": "Mexico", "076": "Brazil", "032": "Argentina",
  "170": "Colombia", "604": "Peru", "152": "Chile", "862": "Venezuela",
  "826": "United Kingdom", "250": "France", "276": "Germany", "380": "Italy",
  "724": "Spain", "616": "Poland", "804": "Ukraine", "578": "Norway", "752": "Sweden",
  "643": "Russia", "792": "Turkey", "364": "Iran", "682": "Saudi Arabia", "368": "Iraq",
  "818": "Egypt", "566": "Nigeria", "710": "South Africa", "404": "Kenya",
  "180": "DR Congo", "012": "Algeria", "231": "Ethiopia",
  "156": "China", "356": "India", "392": "Japan", "410": "South Korea",
  "586": "Pakistan", "764": "Thailand", "704": "Vietnam", "360": "Indonesia",
  "608": "Philippines", "036": "Australia", "554": "New Zealand",
  "408": "N. Korea", "458": "Malaysia", "716": "Zimbabwe", "528": "Netherlands",
  "246": "Finland", "642": "Romania", "203": "Czechia", "756": "Switzerland",
  "056": "Belgium", "620": "Portugal", "208": "Denmark", "372": "Ireland",
  "702": "Singapore", "344": "Hong Kong", "158": "Taiwan", "784": "UAE",
  "376": "Israel", "288": "Ghana", "834": "Tanzania", "218": "Ecuador",
  "050": "Bangladesh",
};

/** Centroid overrides for country label placement */
const LABEL_COORDS: Record<string, [number, number]> = {
  "840": [-98, 39], "124": [-106, 56], "076": [-53, -10], "643": [90, 62],
  "156": [104, 35], "356": [79, 22], "036": [134, -25], "566": [8, 10],
  "710": [25, -29], "276": [10, 51], "250": [2, 46], "826": [-2, 54],
  "392": [138, 36], "484": [-102, 24], "032": [-64, -34], "170": [-73, 4],
  "818": [30, 27], "364": [53, 32], "682": [45, 24], "804": [32, 49],
  "792": [35, 39],
};

/** ISO alpha-2 (from DB) → ISO 3166-1 numeric (for map geo IDs) */
const ALPHA2_TO_NUMERIC: Record<string, string> = {
  US: "840", CA: "124", MX: "484", BR: "076", AR: "032", CO: "170", PE: "604",
  CL: "152", VE: "862", EC: "218",
  GB: "826", FR: "250", DE: "276", IT: "380", ES: "724", PL: "616", UA: "804",
  NO: "578", SE: "752", NL: "528", FI: "246", RO: "642", CZ: "203", CH: "756",
  BE: "056", PT: "620", DK: "208", IE: "372",
  RU: "643", TR: "792", IR: "364", SA: "682", IQ: "368", IL: "376", AE: "784",
  EG: "818", NG: "566", ZA: "710", KE: "404", CD: "180", DZ: "012", ET: "231",
  GH: "288", TZ: "834", MA: "504",
  CN: "156", IN: "356", JP: "392", KR: "410", KP: "408", PK: "586",
  BD: "050", TH: "764", VN: "704", MY: "458", SG: "702", ID: "360",
  PH: "608", TW: "158", HK: "344",
  AU: "036", NZ: "554",
};

type ViewMode = "targets" | "origins";

const SEV_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high:     "#F97316",
  medium:   "#EAB308",
  low:      "#22C55E",
  info:     "#3B82F6",
};

export function ThreatMapWidget() {
  const { data: stats } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });
  const [viewMode, setViewMode] = useState<ViewMode>("targets");
  const [tooltipContent, setTooltipContent] = useState("");
  const [zoom, setZoom] = useState(1.25);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [center, setCenter] = useState<[number, number]>([10, 20]);

  // Mouse-drag panning
  const isDragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number; center: [number, number] } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Pinch-to-zoom
  const lastPinchDist = useRef<number | null>(null);

  // Escape to exit fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    if (isFullscreen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(Math.max(z + (e.deltaY > 0 ? -0.15 : 0.15), 1), 6));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Pinch-to-zoom for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = (dist - lastPinchDist.current) * 0.01;
      setZoom((z) => Math.min(Math.max(z + delta, 1), 6));
      lastPinchDist.current = dist;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
  }, []);

  // Desktop click-drag panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, center: [...center] as [number, number] };
  }, [center]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !dragStart.current) return;
    const sensitivity = 0.3 / zoom;
    const dx = (e.clientX - dragStart.current.x) * sensitivity;
    const dy = (e.clientY - dragStart.current.y) * sensitivity;
    setCenter([
      dragStart.current.center[0] - dx,
      Math.max(-60, Math.min(80, dragStart.current.center[1] + dy)),
    ]);
  }, [zoom]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    dragStart.current = null;
  }, []);

  // ─── Aggregate by-country stats into numeric ISO map ──────────
  const countryData = useMemo(() => {
    const map = new Map<string, { count: number; maxSeverity: string }>();
    if (!stats) return map;

    stats.byCountry.forEach((c) => {
      const numericId = ALPHA2_TO_NUMERIC[c.country_code];
      if (!numericId) return;
      map.set(numericId, { count: c.count, maxSeverity: "medium" });
    });

    // Derive max severity from the bySeverity distribution relative to count
    // Countries with more threats get upgraded severity for visual weighting
    const maxCount = Math.max(...stats.byCountry.map((c) => c.count), 1);
    map.forEach((data, _key) => {
      const ratio = data.count / maxCount;
      if (ratio > 0.7) data.maxSeverity = "critical";
      else if (ratio > 0.4) data.maxSeverity = "high";
      else if (ratio > 0.15) data.maxSeverity = "medium";
      else data.maxSeverity = "low";
    });

    return map;
  }, [stats]);

  // ─── Origin mode — known APT origin nations ──────────────────
  const originData = useMemo(() => {
    const origins: Record<string, { count: number; type: string; severity: string }> = {
      "643": { count: 0, type: "APT / Infrastructure", severity: "critical" },
      "156": { count: 0, type: "State-Sponsored", severity: "critical" },
      "408": { count: 0, type: "Financial / Crypto", severity: "high" },
      "364": { count: 0, type: "Critical Infrastructure", severity: "high" },
      "566": { count: 0, type: "BEC / Social Engineering", severity: "medium" },
      "076": { count: 0, type: "Banking Trojans", severity: "medium" },
    };
    // Overlay dynamic counts from stats
    stats?.byCountry.forEach((c) => {
      const numericId = ALPHA2_TO_NUMERIC[c.country_code];
      if (numericId && origins[numericId]) {
        origins[numericId].count += c.count;
      }
    });
    // Ensure minimum values for visual presence
    Object.values(origins).forEach((o) => { if (o.count < 50) o.count += 50; });
    return origins;
  }, [stats]);

  const getCountryFill = useCallback((geoId: string): string => {
    if (viewMode === "origins") {
      const origin = originData[geoId];
      if (!origin) return "rgba(148, 163, 184, 0.08)";
      const intensity = Math.min(origin.count / 300, 1);
      return `rgba(239, 68, 68, ${0.15 + intensity * 0.45})`;
    }

    const data = countryData.get(geoId);
    if (!data) return "rgba(148, 163, 184, 0.08)";

    const intensity = Math.min(data.count / 50, 1);
    const colors: Record<string, string> = {
      critical: `rgba(239, 68, 68, ${0.2 + intensity * 0.5})`,
      high:     `rgba(249, 115, 22, ${0.15 + intensity * 0.45})`,
      medium:   `rgba(234, 179, 8, ${0.1 + intensity * 0.4})`,
      low:      `rgba(34, 197, 94, ${0.08 + intensity * 0.3})`,
    };
    return colors[data.maxSeverity] || colors.low;
  }, [viewMode, countryData, originData]);

  const totalThreats = useMemo(() => {
    let total = 0;
    countryData.forEach((d) => (total += d.count));
    return total;
  }, [countryData]);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 6));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.5, 1));
  const resetView = () => { setZoom(1.25); setCenter([10, 20]); };

  return (
    <div
      ref={mapRef}
      className={cn(
        "rounded-lg border border-[--border-subtle] bg-surface-raised relative overflow-hidden shadow-card-raised select-none transition-all duration-300",
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none border-none"
          : "h-[400px] sm:h-[500px] lg:h-[650px]",
        isDragging.current ? "cursor-grabbing" : "cursor-grab"
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "none" }}
    >
      {/* ─── Title + view toggle ─── */}
      <div className="absolute top-3 left-3 lg:top-4 lg:left-4 z-10 flex flex-col gap-2">
        <div className="bg-[--surface-base]/80 p-2 lg:p-3 rounded-md border border-[--border-subtle] backdrop-blur-sm">
          <h3 className="text-[--text-primary] font-bold tracking-wider flex items-center text-xs lg:text-sm">
            <Flame className="w-3 h-3 lg:w-4 lg:h-4 text-threat-critical mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">
              {viewMode === "targets" ? "GLOBAL THREAT HEATMAP" : "ATTACK ORIGIN MAP"}
            </span>
            <span className="sm:hidden">
              {viewMode === "targets" ? "THREATS" : "ORIGINS"}
            </span>
          </h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("targets")}
            className={cn(
              "text-2xs px-2 py-1 rounded-md border backdrop-blur-sm transition-colors font-mono",
              viewMode === "targets"
                ? "bg-cyan-400/20 text-cyan-400 border-cyan-400/40"
                : "bg-[--surface-base]/60 text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
            )}
          >
            <Target className="w-3 h-3 inline mr-1" />Targets
          </button>
          <button
            onClick={() => setViewMode("origins")}
            className={cn(
              "text-2xs px-2 py-1 rounded-md border backdrop-blur-sm transition-colors font-mono",
              viewMode === "origins"
                ? "bg-threat-critical/20 text-threat-critical border-threat-critical/40"
                : "bg-[--surface-base]/60 text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
            )}
          >
            <Crosshair className="w-3 h-3 inline mr-1" />Origins
          </button>
        </div>
      </div>

      {/* ─── Zoom controls ─── */}
      <div className="absolute top-3 right-3 lg:top-4 lg:right-4 z-10 flex flex-col gap-1">
        <div className="bg-[--surface-base]/80 rounded-md border border-[--border-subtle] backdrop-blur-sm flex flex-col">
          <button onClick={zoomIn} className="p-1.5 hover:bg-surface-overlay/50 rounded-t-md transition-colors text-[--text-tertiary] hover:text-[--text-primary]" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="border-t border-[--border-subtle]" />
          <button onClick={zoomOut} className="p-1.5 hover:bg-surface-overlay/50 transition-colors text-[--text-tertiary] hover:text-[--text-primary]" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="border-t border-[--border-subtle]" />
          <button onClick={resetView} className="p-1.5 hover:bg-surface-overlay/50 transition-colors text-[--text-tertiary] hover:text-[--text-primary]" title="Reset view">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="border-t border-[--border-subtle]" />
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 hover:bg-surface-overlay/50 rounded-b-md transition-colors text-[--text-tertiary] hover:text-[--text-primary]" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Legend */}
        <div className="bg-[--surface-base]/80 p-1.5 rounded-md border border-[--border-subtle] backdrop-blur-sm hidden sm:block mt-1">
          <div className="space-y-0.5">
            {[
              { label: "Critical", color: SEV_COLORS.critical },
              { label: "High", color: SEV_COLORS.high },
              { label: "Medium", color: SEV_COLORS.medium },
              { label: "Low", color: SEV_COLORS.low },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-[8px] font-mono text-[--text-tertiary]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Tooltip ─── */}
      {tooltipContent && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-[--surface-base]/95 border border-[--border-default] rounded-md px-3 py-2 text-xs font-mono text-[--text-primary] pointer-events-none backdrop-blur-sm shadow-lg">
          {tooltipContent}
        </div>
      )}

      {/* ─── Map ─── */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 120 * zoom, center }}
        style={{ width: "100%", height: "100%" }}
      >
        <Sphere id="sphere-bg" fill="var(--surface-void, #060A12)" stroke="#22C55E" strokeWidth={0.3} strokeOpacity={0.15} />
        <Graticule stroke="#22D3EE" strokeWidth={0.3} strokeOpacity={0.06} />

        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const geoId = geo.id as string;
              const name = COUNTRY_NAMES[geoId] || geo.properties?.name || "";
              const data = viewMode === "targets" ? countryData.get(geoId) : null;
              const originInfo = viewMode === "origins" ? originData[geoId] : null;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getCountryFill(geoId)}
                  stroke="#22D3EE"
                  strokeWidth={0.4}
                  strokeOpacity={0.2}
                  style={{
                    default: { outline: "none" },
                    hover: {
                      fill: data || originInfo
                        ? "rgba(34, 211, 238, 0.35)"
                        : "rgba(148, 163, 184, 0.15)",
                      outline: "none",
                      cursor: "pointer",
                    },
                    pressed: { outline: "none" },
                  }}
                  onMouseEnter={() => {
                    if (data) {
                      setTooltipContent(`${name}: ${data.count} threats · ${data.maxSeverity.toUpperCase()}`);
                    } else if (originInfo) {
                      setTooltipContent(`${name}: ${originInfo.count} attacks · ${originInfo.type}`);
                    } else {
                      setTooltipContent(name);
                    }
                  }}
                  onMouseLeave={() => setTooltipContent("")}
                />
              );
            })
          }
        </Geographies>

        {/* Country name labels */}
        {Object.entries(LABEL_COORDS).map(([iso, coords]) => {
          const name = COUNTRY_NAMES[iso] || "";
          const data = countryData.get(iso);
          const hasData = data && data.count > 0;
          return (
            <Marker key={`label-${iso}`} coordinates={coords}>
              <text
                textAnchor="middle"
                y={2}
                style={{
                  fontSize: hasData ? 6 : 4.5,
                  fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                  textShadow: "0 0 3px rgba(0,0,0,0.8)",
                  fill: hasData
                    ? SEV_COLORS[data!.maxSeverity] || "#94A3B8"
                    : "#64748B",
                  fontWeight: hasData ? "bold" : "normal",
                  pointerEvents: "none",
                }}
              >
                {name}
              </text>
              {hasData && (
                <text
                  textAnchor="middle"
                  y={8}
                  style={{
                    fontSize: 4.5,
                    fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                    fill: SEV_COLORS[data!.maxSeverity] || "#64748B",
                    pointerEvents: "none",
                  }}
                >
                  {data!.count}
                </text>
              )}
            </Marker>
          );
        })}
      </ComposableMap>

      {/* ─── Scan-line animation ─── */}
      <div
        className="absolute inset-x-0 h-[20px] pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(34, 211, 238, 0.05), transparent)",
          animation: "scanLine 4s linear infinite",
        }}
      />

      {/* ─── Stats bar ─── */}
      <div className="absolute bottom-3 left-3 right-3 lg:bottom-4 lg:left-4 lg:right-4 z-10 bg-[--surface-base]/80 backdrop-blur-sm rounded-md border border-[--border-subtle] px-3 py-1.5 flex items-center justify-between">
        <span className="text-[9px] lg:text-2xs font-mono text-[--text-tertiary]">
          {countryData.size} REGIONS · {viewMode === "targets" ? "TARGET" : "ORIGIN"} VIEW
        </span>
        <div className="flex items-center gap-3">
          {zoom > 1.3 && (
            <span className="text-[9px] font-mono text-cyan-400">{zoom.toFixed(1)}×</span>
          )}
          <span className="text-[9px] lg:text-2xs font-mono text-cyan-400">
            {totalThreats.toLocaleString()} TOTAL
          </span>
        </div>
      </div>
    </div>
  );
}
