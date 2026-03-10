/**
 * ThreatMapPage — Production-grade threat intelligence dashboard.
 *
 * Composes:
 *   1. Top row: Interactive world map (ThreatMapWidget) + side panels
 *      (Threat Source Breakdown, Regional Distribution)
 *   2. Bottom: Tabbed intelligence lists (Active Threats, Geo Analysis)
 *      with search, severity filtering, and click-to-detail
 *
 * Data sources: /threats/stats, /threats (list)
 * Inspired by radar-watch-guard's ThreatHeatmap composition.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { threats, type Threat, type ThreatStats } from "../lib/api";
import {
  Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, TabsContent,
  Input, Separator,
} from "../components/ui";
import { ThreatMapWidget } from "../components/ThreatMapWidget";
import { ThreatDetailDialog } from "../components/ThreatDetailDialog";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Crosshair, Search, Shield, Globe2, BarChart3, Copy, Database,
  ShieldAlert, Target, TrendingUp, AlertCircle, MapPin, RefreshCw,
} from "lucide-react";

const severityColors: Record<string, string> = {
  critical: "#EF4444", high: "#F97316", medium: "#EAB308", low: "#22C55E",
};

const countryNames: Record<string, string> = {
  US: "United States", CN: "China", RU: "Russia", DE: "Germany", GB: "United Kingdom",
  FR: "France", IN: "India", BR: "Brazil", JP: "Japan", KR: "South Korea",
  CA: "Canada", AU: "Australia", NL: "Netherlands", UA: "Ukraine", IR: "Iran",
  NG: "Nigeria", PH: "Philippines", VN: "Vietnam", RO: "Romania", ID: "Indonesia",
  TH: "Thailand", TR: "Turkey", PL: "Poland", EG: "Egypt", SA: "Saudi Arabia",
  MX: "Mexico", KP: "North Korea", PK: "Pakistan", BD: "Bangladesh", ZA: "South Africa",
  IT: "Italy", ES: "Spain", SE: "Sweden", SG: "Singapore", HK: "Hong Kong",
};

const regionMap: Record<string, string> = {
  US: "North America", CA: "North America", MX: "Latin America", BR: "Latin America",
  GB: "Europe", DE: "Europe", FR: "Europe", NL: "Europe", PL: "Europe", RO: "Europe",
  IT: "Europe", ES: "Europe", SE: "Europe", UA: "Europe", TR: "Europe",
  CN: "Asia Pacific", JP: "Asia Pacific", KR: "Asia Pacific", IN: "Asia Pacific",
  VN: "Asia Pacific", TH: "Asia Pacific", ID: "Asia Pacific", PH: "Asia Pacific",
  SG: "Asia Pacific", HK: "Asia Pacific", AU: "Asia Pacific", BD: "Asia Pacific", PK: "Asia Pacific",
  RU: "Eastern Europe/CIS", KP: "Eastern Europe/CIS",
  NG: "Africa", ZA: "Africa", EG: "Africa",
  IR: "Middle East", SA: "Middle East",
};

function SeverityBadge({ severity }: { severity: string }) {
  const variant = (["critical", "high", "medium", "low", "info"].includes(severity)
    ? severity
    : "default") as "critical" | "high" | "medium" | "low";
  return <Badge variant={variant} className="text-2xs">{severity}</Badge>;
}

export function ThreatMapPage() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });
  const { data: threatList, isLoading: threatsLoading } = useQuery({
    queryKey: ["threats-list"],
    queryFn: () => threats.list({ limit: 100 }),
  });

  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);

  // ─── Source breakdown from stats ──────────────────────────────
  const sourceBreakdown = useMemo(() => {
    if (!stats) return [];
    const total = stats.bySource.reduce((sum, s) => sum + s.count, 0);
    return stats.bySource.map((s) => ({
      source: s.source,
      count: s.count,
      pct: total > 0 ? Math.round((s.count / total) * 100) : 0,
    }));
  }, [stats]);

  // ─── Regional breakdown ─────────────────────────────────────
  const regionBreakdown = useMemo(() => {
    if (!stats) return [];
    const regions: Record<string, { countries: number; threats: number }> = {};
    stats.byCountry.forEach((c) => {
      const region = regionMap[c.country_code] ?? "Other";
      if (!regions[region]) regions[region] = { countries: 0, threats: 0 };
      regions[region].countries++;
      regions[region].threats += c.count;
    });
    const total = Object.values(regions).reduce((s, r) => s + r.threats, 0);
    return Object.entries(regions)
      .sort((a, b) => b[1].threats - a[1].threats)
      .map(([region, data]) => ({
        region,
        ...data,
        pct: total > 0 ? Math.round((data.threats / total) * 100) : 0,
      }));
  }, [stats]);

  // ─── Filtered threats for list ────────────────────────────────
  const filteredThreats = useMemo(() => {
    if (!threatList) return [];
    let list = [...threatList.threats];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.domain || "").toLowerCase().includes(q) ||
        (t.type || "").toLowerCase().includes(q) ||
        (t.source || "").toLowerCase().includes(q) ||
        (t.ioc_value || "").toLowerCase().includes(q)
      );
    }
    if (severityFilter) {
      list = list.filter((t) => t.severity === severityFilter);
    }
    return list;
  }, [threatList, searchQuery, severityFilter]);

  // ─── Country table data ─────────────────────────────────────
  const byCountry = stats?.byCountry ?? [];
  const maxCount = byCountry.length > 0 ? Math.max(...byCountry.map((c) => c.count)) : 0;

  const barColor = (count: number) => {
    const pct = maxCount > 0 ? count / maxCount : 0;
    if (pct >= 0.7) return "bg-threat-critical";
    if (pct >= 0.4) return "bg-threat-high";
    if (pct >= 0.15) return "bg-threat-medium";
    return "bg-cyan-500";
  };

  const riskColor = (count: number) => {
    const pct = maxCount > 0 ? count / maxCount : 0;
    if (pct >= 0.7) return "text-threat-critical";
    if (pct >= 0.4) return "text-threat-high";
    if (pct >= 0.15) return "text-threat-medium";
    return "text-[--text-secondary]";
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const confidence = (t: Threat) => {
    if (typeof t.confidence !== "number") return "—";
    return t.confidence <= 1 ? `${Math.round(t.confidence * 100)}%` : `${Math.round(t.confidence)}%`;
  };

  const threatCount = threatList?.total ?? 0;
  const geoCount = byCountry.length;

  if (statsLoading) {
    return (
      <div className="animate-fade-in flex items-center justify-center py-20">
        <p className="text-sm text-[--text-tertiary]">Loading threat intelligence...</p>
      </div>
    );
  }

  if (!stats || stats.summary.total === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="animate-fade-in">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-8 h-8 text-[--text-tertiary] mb-3" />
          <p className="text-sm text-[--text-tertiary]">No threat data available</p>
          <p className="text-xs text-[--text-tertiary] mt-1">Intelligence feeds need to be ingested to populate the threat map</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      {/* ═══ KPI Summary Row ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        {[
          { label: "Total Threats", value: stats.summary.total ?? 0, icon: Database, color: "text-cyan-400" },
          { label: "Critical", value: stats.summary.critical ?? 0, icon: ShieldAlert, color: "text-threat-critical" },
          { label: "High", value: stats.summary.high ?? 0, icon: AlertCircle, color: "text-threat-high" },
          { label: "Sources", value: stats.bySource.length, icon: TrendingUp, color: "text-cyan-400" },
          { label: "Countries", value: geoCount, icon: Globe2, color: geoCount > 0 ? "text-cyan-400" : "text-[--text-disabled]" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
          >
            <Card className="relative group overflow-hidden">
              <CardContent>
                <p className="text-2xs text-[--text-tertiary] uppercase tracking-wider font-semibold">{kpi.label}</p>
                <p className={`text-2xl font-bold tabular-nums mt-1 ${kpi.color}`}>{kpi.value}</p>
                <kpi.icon className="absolute top-3 right-3 w-6 h-6 text-[--border-subtle] group-hover:text-[--text-disabled] transition-colors" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ═══ Map + Side Panels Row ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Map — takes 7/12 cols on desktop */}
        <div className="lg:col-span-7">
          <ThreatMapWidget />
        </div>

        {/* Side panels — takes 5/12 cols on desktop */}
        <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-6">
          {/* Threat Source Breakdown */}
          <Card className="flex flex-col overflow-hidden">
            <div className="px-4 lg:px-5 py-3 border-b border-[--border-subtle] flex justify-between items-center">
              <h3 className="font-bold text-[--text-primary] uppercase text-xs lg:text-sm flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-cyan-400 shrink-0" />
                <span className="hidden sm:inline">Threat Source Breakdown</span>
                <span className="sm:hidden">Sources</span>
              </h3>
              <span className="text-2xs text-cyan-400 font-mono">{sourceBreakdown.length} FEEDS</span>
            </div>
            <div className="p-3 lg:p-4 space-y-2 max-h-[180px] overflow-y-auto">
              {sourceBreakdown.length > 0 ? (
                sourceBreakdown.map((s) => (
                  <div key={s.source} className="flex items-center gap-2">
                    <span className="text-2xs font-mono text-[--text-tertiary] w-24 truncate uppercase">{s.source}</span>
                    <div className="flex-1 h-2 bg-[--surface-base] rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${Math.max(s.pct, 2)}%` }} />
                    </div>
                    <span className="text-2xs font-mono text-[--text-primary] w-10 text-right tabular-nums">{s.count}</span>
                    <span className="text-[9px] font-mono text-[--text-tertiary] w-8 text-right">{s.pct}%</span>
                  </div>
                ))
              ) : (
                <div className="py-3 text-xs text-[--text-tertiary] text-center">No source data yet</div>
              )}
            </div>
          </Card>

          {/* Regional Distribution */}
          <Card className="flex flex-col overflow-hidden">
            <div className="px-4 lg:px-5 py-3 border-b border-[--border-subtle] flex justify-between items-center">
              <h3 className="font-bold text-[--text-primary] uppercase text-xs lg:text-sm flex items-center">
                <Globe2 className="w-4 h-4 mr-2 text-cyan-400 shrink-0" />
                <span className="hidden sm:inline">Regional Distribution</span>
                <span className="sm:hidden">Regions</span>
              </h3>
              <span className="text-2xs text-cyan-400 font-mono">{regionBreakdown.length} REGIONS</span>
            </div>
            <div className="p-3 lg:p-4 space-y-2 max-h-[200px] overflow-y-auto">
              {regionBreakdown.length > 0 ? (
                regionBreakdown.map((r) => {
                  const regionColor = r.pct >= 40 ? severityColors.critical
                    : r.pct >= 25 ? severityColors.high
                    : r.pct >= 10 ? severityColors.medium
                    : "var(--cyan-400)";
                  return (
                    <div key={r.region} className="p-2 rounded-md bg-[--surface-base] border border-[--border-subtle] hover:border-[--border-default] transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-[--text-primary] truncate">{r.region}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: regionColor }}>{r.threats}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[--surface-void] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${r.pct}%`, backgroundColor: regionColor }} />
                        </div>
                        <span className="text-[9px] text-[--text-tertiary] tabular-nums w-8 text-right">{r.pct}%</span>
                      </div>
                      <div className="text-[9px] text-[--text-tertiary] mt-1">{r.countries} countries</div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 flex flex-col items-center gap-2">
                  <MapPin className="w-5 h-5 text-[--text-disabled]" />
                  <p className="text-xs text-[--text-tertiary]">No geographic data yet</p>
                  <button
                    onClick={async () => {
                      setEnriching(true);
                      setEnrichResult(null);
                      try {
                        const result = await threats.enrichGeo();
                        setEnrichResult(`Enriched ${result.enriched} of ${result.total} threats`);
                        queryClient.invalidateQueries({ queryKey: ["threat-stats"] });
                      } catch (err) {
                        setEnrichResult("Enrichment failed — admin access required");
                      } finally {
                        setEnriching(false);
                      }
                    }}
                    disabled={enriching}
                    className="text-2xs px-3 py-1.5 rounded-md border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10 transition-colors font-mono flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-3 h-3", enriching && "animate-spin")} />
                    {enriching ? "Enriching..." : "Enrich Geo Data"}
                  </button>
                  {enrichResult && (
                    <p className="text-[10px] text-cyan-400/80 font-mono">{enrichResult}</p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Severity Distribution */}
          <Card className="flex flex-col overflow-hidden">
            <div className="px-4 lg:px-5 py-3 border-b border-[--border-subtle]">
              <h3 className="font-bold text-[--text-primary] uppercase text-xs lg:text-sm flex items-center">
                <ShieldAlert className="w-4 h-4 mr-2 text-threat-critical shrink-0" />
                Severity Distribution
              </h3>
            </div>
            <div className="p-3 lg:p-4 space-y-2">
              {stats.bySeverity.map((s) => {
                const pct = stats.summary.total ? Math.round((s.count / stats.summary.total) * 100) : 0;
                return (
                  <div key={s.severity} className="flex items-center gap-3">
                    <Badge variant={s.severity as "critical" | "high" | "medium" | "low"} className="w-20 justify-center text-2xs">{s.severity}</Badge>
                    <div className="flex-1 h-2 rounded-full bg-[--surface-base] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: severityColors[s.severity] ?? "#888" }} />
                    </div>
                    <span className="text-xs text-[--text-tertiary] tabular-nums w-10 text-right">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* ═══ Tabbed Intelligence Lists ═══ */}
      <Card className="overflow-hidden p-0">
        {/* Search + severity filter bar */}
        <div className="px-4 lg:px-5 py-3 border-b border-[--border-subtle] flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[--text-tertiary]" />
            <Input
              placeholder="Search threats, domains, IOCs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {["critical", "high", "medium", "low"].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
                className={`text-2xs px-2 py-1 rounded-md border font-mono uppercase transition-colors ${
                  severityFilter === sev
                    ? sev === "critical" ? "bg-threat-critical/20 text-threat-critical border-threat-critical/40"
                    : sev === "high" ? "bg-threat-high/20 text-threat-high border-threat-high/40"
                    : sev === "medium" ? "bg-threat-medium/20 text-threat-medium border-threat-medium/40"
                    : "bg-threat-low/20 text-threat-low border-threat-low/40"
                    : "bg-[--surface-base] text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
                }`}
              >
                {sev}
              </button>
            ))}
            {(searchQuery || severityFilter) && (
              <button
                onClick={() => { setSearchQuery(""); setSeverityFilter(null); }}
                className="text-2xs text-cyan-400 hover:text-cyan-300 px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <Tabs defaultValue="threats" className="w-full">
          <div className="px-4 border-b border-[--border-subtle]">
            <TabsList className="bg-transparent h-auto p-0 gap-0">
              <TabsTrigger value="threats" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-cyan-400 rounded-none px-4 py-2.5 text-xs gap-1.5">
                <Crosshair className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Active Threats</span>
                <span className="sm:hidden">Threats</span>
                <Badge className="text-[9px] px-1.5 py-0 ml-1">{threatCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="geo" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-cyan-400 rounded-none px-4 py-2.5 text-xs gap-1.5">
                <Globe2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Geo Analysis</span>
                <span className="sm:hidden">Geo</span>
                <Badge className="text-[9px] px-1.5 py-0 ml-1">{geoCount}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Active Threats Tab ── */}
          <TabsContent value="threats" className="mt-0">
            <div className="px-4 py-2 border-b border-[--border-subtle] bg-[--surface-base]/50 flex items-center justify-between">
              <span className="text-2xs text-[--text-tertiary] font-mono">{filteredThreats.length} RESULTS</span>
            </div>

            {/* Mobile threat cards */}
            <div className="sm:hidden divide-y divide-[--border-subtle] max-h-[500px] overflow-y-auto">
              {threatsLoading ? (
                <div className="px-4 py-8 text-center text-[--text-tertiary] text-sm">Loading...</div>
              ) : filteredThreats.length === 0 ? (
                <div className="px-4 py-8 text-center text-[--text-tertiary] text-sm">No threats match your filters</div>
              ) : (
                filteredThreats.map((t) => (
                  <div key={t.id} className="p-3 hover:bg-surface-overlay/30 transition-colors cursor-pointer active:bg-surface-overlay/50" onClick={() => setSelectedThreat(t)}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-[--text-primary] text-sm truncate flex-1">{t.title}</span>
                      <span className="text-cyan-400 font-mono text-xs ml-2">{confidence(t)}</span>
                    </div>
                    {t.domain && <p className="font-mono text-[11px] text-threat-critical mb-1 truncate">{t.domain}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-overlay text-[--text-secondary] border border-[--border-subtle]">{t.type}</span>
                      <SeverityBadge severity={t.severity} />
                      <span className="text-[9px] text-[--text-tertiary] font-mono">{t.source}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop threat table */}
            <div className="hidden sm:block overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm text-[--text-secondary]">
                <thead className="bg-[--surface-base]/50 text-[--text-tertiary] uppercase text-2xs font-bold tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2">Domain / IOC</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Severity</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2 text-right">Confidence</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border-subtle]">
                  {threatsLoading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[--text-tertiary]">Loading...</td></tr>
                  ) : filteredThreats.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[--text-tertiary]">No threats match your filters</td></tr>
                  ) : (
                    filteredThreats.map((t) => (
                      <tr key={t.id} className="hover:bg-surface-overlay/30 transition-colors cursor-pointer" onClick={() => setSelectedThreat(t)}>
                        <td className="px-4 py-3 font-bold text-[--text-primary] max-w-[200px] truncate">{t.title}</td>
                        <td className="px-4 py-3 font-mono text-xs text-threat-critical max-w-[180px] truncate">{t.domain || t.ioc_value || "—"}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-surface-overlay text-[--text-secondary] border border-[--border-subtle]">{t.type}</span>
                        </td>
                        <td className="px-4 py-3"><SeverityBadge severity={t.severity} /></td>
                        <td className="px-4 py-3 text-xs font-mono text-[--text-tertiary]">{t.source}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-cyan-400 font-mono text-xs">{confidence(t)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(t.ioc_value || t.domain || t.title); }}
                            className="text-[--text-tertiary] hover:text-[--text-primary]"
                            title="Copy IOC"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Geo Analysis Tab ── */}
          <TabsContent value="geo" className="mt-0">
            <div className="px-4 py-2 border-b border-[--border-subtle] bg-[--surface-base]/50 flex items-center justify-between">
              <span className="text-2xs text-[--text-tertiary] font-mono">{byCountry.length} COUNTRIES</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {byCountry.length === 0 ? (
                <div className="px-4 py-10 flex flex-col items-center gap-3">
                  <Globe2 className="w-8 h-8 text-[--text-disabled]" />
                  <p className="text-sm text-[--text-tertiary]">No geographic data available</p>
                  <p className="text-xs text-[--text-disabled] max-w-sm text-center">
                    Threat feeds with IP addresses need GeoIP enrichment to populate country data. Click below to resolve IP addresses to countries.
                  </p>
                  <button
                    onClick={async () => {
                      setEnriching(true);
                      setEnrichResult(null);
                      try {
                        const result = await threats.enrichGeo();
                        setEnrichResult(`Enriched ${result.enriched} of ${result.total} threats with country codes`);
                        queryClient.invalidateQueries({ queryKey: ["threat-stats"] });
                      } catch (err) {
                        setEnrichResult("Enrichment failed — admin access required");
                      } finally {
                        setEnriching(false);
                      }
                    }}
                    disabled={enriching}
                    className="text-xs px-4 py-2 rounded-md border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10 transition-colors font-mono flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", enriching && "animate-spin")} />
                    {enriching ? "Enriching IP addresses..." : "Run GeoIP Enrichment"}
                  </button>
                  {enrichResult && (
                    <p className="text-xs text-cyan-400/80 font-mono mt-1">{enrichResult}</p>
                  )}
                </div>
              ) : (
                <div className="p-4 space-y-1.5">
                  {byCountry.map((c, i) => {
                    const pct = maxCount > 0 ? Math.round((c.count / maxCount) * 100) : 0;
                    const name = countryNames[c.country_code] ?? c.country_code;
                    const color = barColor(c.count);
                    const sevColor = pct >= 70 ? severityColors.critical
                      : pct >= 40 ? severityColors.high
                      : pct >= 15 ? severityColors.medium
                      : severityColors.low;
                    return (
                      <motion.div
                        key={c.country_code}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.25 }}
                        className="flex items-center gap-3 py-1 px-2 rounded hover:bg-surface-overlay/20 transition-colors"
                      >
                        <span className="text-[10px] font-mono text-[--text-tertiary] w-7 shrink-0">{i + 1}.</span>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sevColor, boxShadow: `0 0 6px ${sevColor}40` }} />
                        <span className="text-xs font-mono text-[--text-tertiary] w-7 shrink-0">{c.country_code}</span>
                        <span className="text-xs text-[--text-primary] w-28 truncate shrink-0">{name}</span>
                        <div className="flex-1 h-2.5 bg-[--surface-base] rounded overflow-hidden">
                          <div className={`h-full ${color} rounded transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-bold tabular-nums w-12 text-right ${riskColor(c.count)}`}>{c.count}</span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* ═══ Bottom Row: Type + Sources ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" /> By Threat Type
            </h3>
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
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" /> Top Intelligence Sources
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stats.bySource.map((s) => (
                <div key={s.source} className="p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                  <div className="text-xs text-[--text-tertiary] truncate uppercase font-mono">{s.source}</div>
                  <div className="text-lg font-bold text-[--text-primary] tabular-nums">{s.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <ThreatDetailDialog
        threat={selectedThreat}
        open={!!selectedThreat}
        onOpenChange={(open) => { if (!open) setSelectedThreat(null); }}
      />
    </motion.div>
  );
}
