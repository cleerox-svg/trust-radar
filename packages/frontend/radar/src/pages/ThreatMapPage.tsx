import { useQuery } from "@tanstack/react-query";
import { threats, type ThreatStats } from "../lib/api";
import { Card, CardContent, Badge } from "../components/ui";
import { useMemo, useState } from "react";

const severityColors: Record<string, string> = {
  critical: "#EF4444", high: "#F97316", medium: "#EAB308", low: "#22C55E",
};

// ─── Simplified world map paths (ISO 3166 → SVG polygon centers) ───
// Mercator-projected country centroids mapped to 1000x500 viewBox
const COUNTRY_COORDS: Record<string, [number, number]> = {
  US: [200, 200], CA: [210, 140], MX: [180, 260], BR: [340, 340], AR: [310, 400],
  GB: [470, 150], DE: [510, 155], FR: [485, 170], ES: [470, 190], IT: [510, 180],
  NL: [495, 148], SE: [520, 115], NO: [510, 105], FI: [545, 100], PL: [530, 155],
  UA: [560, 155], RO: [545, 170], CZ: [520, 155], CH: [500, 168], AT: [520, 165],
  BE: [490, 155], PT: [460, 190], DK: [510, 135], IE: [460, 148],
  RU: [650, 130], CN: [750, 210], JP: [850, 200], KR: [830, 210], IN: [700, 260],
  PK: [680, 240], BD: [720, 250], TH: [740, 270], VN: [760, 265], MY: [745, 295],
  SG: [745, 305], ID: [770, 310], PH: [790, 270], TW: [810, 240], HK: [790, 240],
  AU: [820, 380], NZ: [880, 410], IL: [580, 215], TR: [570, 190], SA: [600, 240],
  AE: [620, 245], EG: [560, 225], ZA: [550, 390], NG: [500, 290], KE: [580, 310],
  MA: [465, 215], DZ: [490, 215], GH: [485, 290], ET: [580, 290], TZ: [575, 330],
  CO: [280, 300], CL: [300, 380], PE: [280, 330], VE: [300, 280], EC: [270, 310],
};

function heatColor(count: number, max: number): string {
  if (max === 0) return "rgba(34, 211, 238, 0.15)";
  const t = Math.min(count / max, 1);
  if (t > 0.7) return "rgba(239, 68, 68, 0.85)";   // critical red
  if (t > 0.4) return "rgba(249, 115, 22, 0.75)";   // orange
  if (t > 0.2) return "rgba(234, 179, 8, 0.65)";    // amber
  if (t > 0) return "rgba(34, 211, 238, 0.55)";     // cyan
  return "rgba(34, 211, 238, 0.15)";
}

// SVG world outline paths (simplified continental outlines)
const CONTINENT_PATHS = [
  // North America
  "M120,100 L140,90 L190,80 L250,70 L280,90 L290,110 L280,130 L260,150 L240,180 L230,200 L220,230 L200,250 L180,270 L160,260 L140,230 L120,200 L100,170 L90,140 L100,120 Z",
  // South America
  "M250,280 L280,270 L310,280 L340,290 L360,320 L370,350 L360,380 L340,410 L320,430 L300,440 L280,430 L270,400 L260,360 L250,320 Z",
  // Europe
  "M440,100 L460,90 L490,85 L520,80 L560,90 L580,100 L590,120 L580,150 L560,170 L540,190 L520,200 L500,195 L480,185 L460,170 L450,150 L440,130 Z",
  // Africa
  "M440,210 L470,200 L510,210 L540,220 L580,220 L600,240 L610,270 L600,310 L580,350 L560,380 L540,400 L510,390 L480,360 L460,320 L450,290 L440,260 Z",
  // Asia
  "M580,80 L620,60 L680,70 L740,80 L800,90 L860,100 L880,120 L870,150 L850,180 L830,200 L810,230 L790,260 L770,280 L740,300 L710,280 L680,250 L650,220 L620,190 L600,160 L590,130 Z",
  // Australia
  "M770,330 L810,320 L850,330 L870,350 L880,370 L870,400 L840,410 L810,400 L780,390 L760,370 L760,350 Z",
];

export function ThreatMapPage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const countryMap = useMemo(() => {
    if (!stats) return new Map<string, number>();
    return new Map(stats.byCountry.map((c) => [c.country_code, c.count]));
  }, [stats]);

  const maxCount = useMemo(() => {
    if (!stats) return 0;
    return Math.max(...stats.byCountry.map((c) => c.count), 1);
  }, [stats]);

  const hoveredData = hoveredCountry ? { code: hoveredCountry, count: countryMap.get(hoveredCountry) ?? 0 } : null;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Threat Map</h1>
        <p className="text-sm text-[--text-secondary]">Global threat distribution with severity-coded intelligence</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading threat intelligence...</div>
      ) : stats && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Threats", value: stats.summary.total ?? 0 },
              { label: "Critical", value: stats.summary.critical ?? 0, color: "text-threat-critical" },
              { label: "High", value: stats.summary.high ?? 0, color: "text-threat-high" },
              { label: "Unprocessed", value: stats.summary.unprocessed ?? 0, color: "text-threat-medium" },
              { label: "Last 24h", value: stats.last24h.total ?? 0, color: "text-cyan-400" },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent>
                  <div className="text-xs text-[--text-tertiary]">{c.label}</div>
                  <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* World Map */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[--text-primary]">Global Threat Distribution</h3>
                {hoveredData && (
                  <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: "var(--surface-base)", color: "var(--text-secondary)" }}>
                    {hoveredData.code}: {hoveredData.count} threats
                  </span>
                )}
              </div>
              <div className="relative rounded-lg overflow-hidden" style={{ background: "var(--surface-void)" }}>
                <svg viewBox="0 0 1000 500" className="w-full h-auto" style={{ minHeight: 280 }}>
                  {/* Grid lines */}
                  {[100, 200, 300, 400].map((y) => (
                    <line key={`h${y}`} x1="0" y1={y} x2="1000" y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
                  ))}
                  {[200, 400, 600, 800].map((x) => (
                    <line key={`v${x}`} x1={x} y1="0" x2={x} y2="500" stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
                  ))}

                  {/* Continental outlines */}
                  {CONTINENT_PATHS.map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill="rgba(34, 211, 238, 0.06)"
                      stroke="rgba(34, 211, 238, 0.2)"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Threat hotspots */}
                  {stats.byCountry.map((c) => {
                    const coords = COUNTRY_COORDS[c.country_code];
                    if (!coords) return null;
                    const [cx, cy] = coords;
                    const size = 4 + (c.count / maxCount) * 20;
                    const color = heatColor(c.count, maxCount);
                    const isHovered = hoveredCountry === c.country_code;

                    return (
                      <g key={c.country_code} onMouseEnter={() => setHoveredCountry(c.country_code)} onMouseLeave={() => setHoveredCountry(null)}>
                        {/* Pulse ring for high-threat countries */}
                        {c.count / maxCount > 0.5 && (
                          <circle cx={cx} cy={cy} r={size * 1.5} fill="none" stroke={color} strokeWidth="0.5" opacity="0.4">
                            <animate attributeName="r" from={size} to={size * 2} dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                          </circle>
                        )}
                        {/* Main dot */}
                        <circle
                          cx={cx} cy={cy} r={isHovered ? size * 1.3 : size}
                          fill={color}
                          stroke={isHovered ? "#fff" : "none"}
                          strokeWidth={isHovered ? 1.5 : 0}
                          style={{ cursor: "pointer", transition: "r 0.2s ease" }}
                        />
                        {/* Country label for large dots */}
                        {(size > 10 || isHovered) && (
                          <text x={cx} y={cy - size - 4} textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontFamily="var(--font-mono)">
                            {c.country_code}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Connection lines between high-threat countries */}
                  {stats.byCountry
                    .filter((c) => c.count / maxCount > 0.3 && COUNTRY_COORDS[c.country_code])
                    .slice(0, 8)
                    .map((c, i, arr) => {
                      if (i === 0) return null;
                      const from = COUNTRY_COORDS[arr[i - 1].country_code];
                      const to = COUNTRY_COORDS[c.country_code];
                      if (!from || !to) return null;
                      return (
                        <line key={`conn-${i}`} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
                          stroke="rgba(34, 211, 238, 0.15)" strokeWidth="0.5" strokeDasharray="3 3" />
                      );
                    })}
                </svg>

                {/* Legend */}
                <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "rgba(34, 211, 238, 0.55)" }} /> Low</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "rgba(234, 179, 8, 0.65)" }} /> Medium</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "rgba(249, 115, 22, 0.75)" }} /> High</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "rgba(239, 68, 68, 0.85)" }} /> Critical</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* By Type and Severity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-[--text-primary] mb-3">By Threat Type</h3>
                <div className="space-y-2">
                  {stats.byType.map((t) => {
                    const pct = stats.summary.total ? Math.round((t.count / stats.summary.total) * 100) : 0;
                    return (
                      <div key={t.type} className="flex items-center gap-3">
                        <span className="text-xs text-[--text-secondary] w-28 truncate">{t.type}</span>
                        <div className="flex-1 h-2 rounded-full bg-[--surface-base] overflow-hidden">
                          <div className="h-full rounded-full bg-cyan-500/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[--text-tertiary] tabular-nums w-12 text-right">{t.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-[--text-primary] mb-3">By Severity</h3>
                <div className="space-y-2">
                  {stats.bySeverity.map((s) => (
                    <div key={s.severity} className="flex items-center gap-3">
                      <Badge variant={s.severity as "critical" | "high" | "medium" | "low"} className="w-20 justify-center">{s.severity}</Badge>
                      <div className="flex-1 h-2 rounded-full bg-[--surface-base] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${stats.summary.total ? Math.round((s.count / stats.summary.total) * 100) : 0}%`, backgroundColor: severityColors[s.severity] ?? "#888" }}
                        />
                      </div>
                      <span className="text-xs text-[--text-tertiary] tabular-nums w-12 text-right">{s.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Sources */}
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Top Intelligence Sources</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {stats.bySource.map((s) => (
                  <div key={s.source} className="p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                    <div className="text-xs text-[--text-tertiary] truncate">{s.source}</div>
                    <div className="text-lg font-bold text-[--text-primary] tabular-nums">{s.count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
