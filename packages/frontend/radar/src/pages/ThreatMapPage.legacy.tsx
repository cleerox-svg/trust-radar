/**
 * ThreatMapPage — Production threat intelligence dashboard.
 *
 * Layout matches the trust-radar-heatmap.html reference:
 *   1. Stats Row: Scans Today, Threats Flagged, Countries Active, Trust Score
 *   2. Map Panel (ThreatMapWidget — untouched, working great)
 *   3. Bottom Row: Live Threat Feed + Legend/Top Origins + Hosting Providers
 *   4. Tabbed intelligence lists (Active Threats, Geo Analysis)
 *
 * Data sources: /threats/stats (with dailyStats, recentThreats, topOriginsToday, byProvider)
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { threats, providers, type Threat, type ThreatStats, type ProviderStat } from "../lib/api";
import {
  Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, TabsContent,
  Input,
} from "../components/ui";
import { ThreatMapWidget } from "../components/ThreatMapWidget";
import { ThreatDetailDialog } from "../components/ThreatDetailDialog";
import { cn } from "../lib/cn";
import { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Crosshair, Search, Shield, Globe2, BarChart3, Copy, Database,
  ShieldAlert, Target, TrendingUp, TrendingDown, AlertCircle, MapPin,
  RefreshCw, Activity, Server, ArrowUp, ArrowDown, Minus,
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

const countryFlags: Record<string, string> = {
  RU: "\u{1F1F7}\u{1F1FA}", CN: "\u{1F1E8}\u{1F1F3}", UA: "\u{1F1FA}\u{1F1E6}",
  NG: "\u{1F1F3}\u{1F1EC}", IR: "\u{1F1EE}\u{1F1F7}", US: "\u{1F1FA}\u{1F1F8}",
  IN: "\u{1F1EE}\u{1F1F3}", BR: "\u{1F1E7}\u{1F1F7}", DE: "\u{1F1E9}\u{1F1EA}",
  GB: "\u{1F1EC}\u{1F1E7}", FR: "\u{1F1EB}\u{1F1F7}", JP: "\u{1F1EF}\u{1F1F5}",
  KR: "\u{1F1F0}\u{1F1F7}", PH: "\u{1F1F5}\u{1F1ED}", VN: "\u{1F1FB}\u{1F1F3}",
  RO: "\u{1F1F7}\u{1F1F4}", ID: "\u{1F1EE}\u{1F1E9}", TR: "\u{1F1F9}\u{1F1F7}",
  NL: "\u{1F1F3}\u{1F1F1}", PK: "\u{1F1F5}\u{1F1F0}",
};

const threatTypeColors: Record<string, string> = {
  phishing: "#EF4444", malware: "#F59E0B", scam: "#A78BFA",
  c2: "#FB923C", ransomware: "#EC4899", impersonation: "#818CF8",
  reputation: "#6B7280", unknown: "#64748B",
};

function SeverityBadge({ severity }: { severity: string }) {
  const variant = (["critical", "high", "medium", "low", "info"].includes(severity)
    ? severity
    : "default") as "critical" | "high" | "medium" | "low";
  return <Badge variant={variant} className="text-2xs">{severity}</Badge>;
}

function pctChange(current: number, previous: number): { pct: number; direction: "up" | "down" | "stable" } {
  if (previous === 0) return { pct: 0, direction: "stable" };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), direction: pct > 0 ? "up" : pct < 0 ? "down" : "stable" };
}

export function ThreatMapPage() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["threat-stats"],
    queryFn: threats.stats,
    refetchInterval: 60000, // Refresh every 60s for live feel
  });
  const { data: threatList, isLoading: threatsLoading } = useQuery({
    queryKey: ["threats-list"],
    queryFn: () => threats.list({ limit: 100 }),
  });
  const [providerPeriod, setProviderPeriod] = useState("today");
  const { data: providerData } = useQuery({
    queryKey: ["provider-stats", providerPeriod],
    queryFn: () => providers.stats(providerPeriod),
  });

  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);

  // ─── Live feed rotation ───────────────────────────────────
  const [feedOffset, setFeedOffset] = useState(0);
  const recentThreats = stats?.recentThreats ?? [];

  useEffect(() => {
    if (recentThreats.length === 0) return;
    const timer = setInterval(() => {
      setFeedOffset(prev => (prev + 1) % Math.max(1, recentThreats.length));
    }, 2500);
    return () => clearInterval(timer);
  }, [recentThreats.length]);

  const visibleFeed = useMemo(() => {
    if (recentThreats.length === 0) return [];
    const doubled = [...recentThreats, ...recentThreats];
    return doubled.slice(feedOffset % recentThreats.length, (feedOffset % recentThreats.length) + 6);
  }, [recentThreats, feedOffset]);

  // ─── Filtered threats for list ────────────────────────────
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

  // ─── Country data ─────────────────────────────────────────
  const byCountry = stats?.byCountry ?? [];
  const topOrigins = stats?.topOriginsToday ?? [];
  const maxOriginCount = topOrigins.length > 0 ? Math.max(...topOrigins.map(c => c.count)) : 0;
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
    if (typeof t.confidence !== "number") return "\u2014";
    return t.confidence <= 1 ? `${Math.round(t.confidence * 100)}%` : `${Math.round(t.confidence)}%`;
  };

  const threatCount = threatList?.total ?? 0;
  const geoCount = byCountry.length;

  // ─── Daily stats ──────────────────────────────────────────
  const daily = stats?.dailyStats ?? { scansToday: 0, scansYesterday: 0, threatsFlagged: 0, threatsYesterday: 0, countriesActive: 0, countriesYesterday: 0 };
  const scansDelta = pctChange(daily.scansToday, daily.scansYesterday);
  const threatsDelta = pctChange(daily.threatsFlagged, daily.threatsYesterday);
  const countriesDelta = { pct: Math.abs(daily.countriesActive - daily.countriesYesterday), direction: daily.countriesActive > daily.countriesYesterday ? "up" as const : daily.countriesActive < daily.countriesYesterday ? "down" as const : "stable" as const };

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-4">
      {/* ═══ KPI Stats Row (matching HTML reference: Scans Today, Threats Flagged, Countries Active, Trust Score) ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Scans Today */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.35 }}>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />
            <CardContent>
              <p className="text-[9px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary] mb-1.5">Scans Today</p>
              <p className="text-2xl font-bold tabular-nums text-[--text-primary] font-mono">
                {daily.scansToday.toLocaleString()}
                <span className="text-xs text-[--text-tertiary] ml-1 font-normal">items</span>
              </p>
              <p className={cn("text-[11px] mt-1 font-mono", scansDelta.direction === "up" ? "text-threat-critical" : scansDelta.direction === "down" ? "text-green-400" : "text-[--text-tertiary]")}>
                {scansDelta.direction === "up" ? "\u2191" : scansDelta.direction === "down" ? "\u2193" : "\u2192"} {scansDelta.pct}% vs yesterday
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Threats Flagged */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.35 }}>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-threat-critical" />
            <CardContent>
              <p className="text-[9px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary] mb-1.5">Threats Flagged</p>
              <p className="text-2xl font-bold tabular-nums text-[--text-primary] font-mono">{daily.threatsFlagged.toLocaleString()}</p>
              <p className={cn("text-[11px] mt-1 font-mono", threatsDelta.direction === "up" ? "text-threat-critical" : "text-green-400")}>
                {threatsDelta.direction === "up" ? "\u2191" : "\u2193"} {threatsDelta.pct}% this week
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Countries Active */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.35 }}>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
            <CardContent>
              <p className="text-[9px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary] mb-1.5">Countries Active</p>
              <p className="text-2xl font-bold tabular-nums text-[--text-primary] font-mono">{daily.countriesActive}</p>
              <p className={cn("text-[11px] mt-1 font-mono", countriesDelta.direction === "up" ? "text-threat-critical" : "text-green-400")}>
                {countriesDelta.direction === "down" ? "\u2193" : countriesDelta.direction === "up" ? "\u2191" : "\u2192"} {countriesDelta.pct} from yesterday
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Trust Score (all-time platform stats) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.35 }}>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-500" />
            <CardContent>
              <p className="text-[9px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary] mb-1.5">Total Threats</p>
              <p className="text-2xl font-bold tabular-nums text-[--text-primary] font-mono">
                {(stats.summary.total ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] mt-1 font-mono text-[--text-tertiary]">
                {stats.summary.critical ?? 0} critical \u00B7 {stats.summary.high ?? 0} high
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ═══ Map Panel ═══ */}
      <Card className="overflow-hidden p-0">
        <div className="px-4 py-2.5 border-b border-[--border-subtle] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-threat-critical animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-[1.5px] text-[--text-primary]">Global Threat Heatmap \u2014 Live</span>
          </div>
          <span className="text-[10px] font-mono text-blue-500">{daily.threatsFlagged} threats \u00B7 24h</span>
        </div>
        <ThreatMapWidget />
      </Card>

      {/* ═══ Bottom Row: Live Feed + Legend/Top Origins + Hosting Providers ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Live Threat Feed */}
        <Card className="overflow-hidden p-0">
          <div className="px-3.5 py-2.5 border-b border-[--border-subtle] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-threat-critical animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary]">Live Threat Feed</span>
          </div>
          <div className="max-h-[200px] overflow-hidden">
            {visibleFeed.length > 0 ? visibleFeed.map((item, i) => (
              <motion.div
                key={`${item.id}-${feedOffset}-${i}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2.5 px-3.5 py-2 border-b border-[--border-subtle] text-xs"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: threatTypeColors[item.type] ?? "#64748B" }} />
                <span className="font-mono text-[11px] text-[--text-primary] flex-1 truncate">{item.domain || item.ioc_value || item.title}</span>
                <span className="text-[11px] text-[--text-tertiary] shrink-0">{countryNames[item.country_code ?? ""] ?? item.country_code ?? ""}</span>
                <span className={cn(
                  "font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded",
                  item.severity === "critical" || item.severity === "high"
                    ? "bg-threat-critical/15 text-threat-critical"
                    : item.severity === "medium"
                    ? "bg-amber-500/15 text-amber-500"
                    : "bg-green-500/15 text-green-500"
                )}>{item.severity}</span>
              </motion.div>
            )) : (
              <div className="px-4 py-6 text-center text-xs text-[--text-tertiary]">No recent threats</div>
            )}
          </div>
        </Card>

        {/* Legend + Top Origins */}
        <Card className="overflow-hidden p-0">
          <div className="p-3.5">
            <p className="text-[10px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary] mb-2.5">Heat Scale</p>
            <div className="h-2.5 rounded-full mb-1.5" style={{ background: "linear-gradient(to right, #00f5ff, #f59e0b, #ef4444)" }} />
            <div className="flex justify-between text-[10px] font-mono text-[--text-tertiary] mb-3">
              <span>Low risk</span><span>Medium</span><span>High risk</span>
            </div>
            {/* Threat type legend */}
            <div className="space-y-1.5 mb-3">
              {[
                { label: "Phishing / High Threat", color: "rgba(239,68,68,0.8)" },
                { label: "Malware / Suspicious", color: "rgba(245,158,11,0.8)" },
                { label: "Low Risk / Monitored", color: "rgba(0,245,255,0.6)" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-xs text-[--text-primary]">
                  <span className="w-7 h-2 rounded shrink-0" style={{ backgroundColor: item.color }} />
                  {item.label}
                </div>
              ))}
            </div>
            {/* Top Origins */}
            <p className="text-[10px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary] mb-2">Top Origins</p>
            <div className="space-y-1.5">
              {topOrigins.slice(0, 5).map(c => (
                <div key={c.country_code} className="flex items-center gap-2 text-xs">
                  <span className="text-sm">{countryFlags[c.country_code] ?? ""}</span>
                  <span className="text-[--text-primary] flex-1">{countryNames[c.country_code] ?? c.country_code}</span>
                  <div className="w-16 h-1 bg-[--surface-base] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.round((c.count / maxOriginCount) * 100)}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-[--text-tertiary] w-8 text-right tabular-nums">{c.count}</span>
                </div>
              ))}
              {topOrigins.length === 0 && (
                <p className="text-[11px] text-[--text-tertiary]">No origin data today</p>
              )}
            </div>
          </div>
        </Card>

        {/* Hosting Provider Offenders */}
        <Card className="overflow-hidden p-0">
          <div className="px-3.5 py-2.5 border-b border-[--border-subtle] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[10px] font-mono uppercase tracking-[1.5px] text-[--text-tertiary]">Hosting Offenders</span>
            </div>
            <div className="flex gap-1">
              {["today", "7d", "30d"].map(p => (
                <button
                  key={p}
                  onClick={() => setProviderPeriod(p)}
                  className={cn(
                    "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border transition-colors",
                    providerPeriod === p
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/40"
                      : "text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto p-3">
            {providerData?.providers && providerData.providers.length > 0 ? (
              <div className="space-y-2">
                {providerData.providers.slice(0, 8).map((p: ProviderStat) => (
                  <div key={p.provider_name} className="flex items-center gap-2 text-xs">
                    <span className="text-[--text-primary] flex-1 truncate font-medium">{p.provider_name}</span>
                    <span className="font-mono text-[10px] tabular-nums text-[--text-tertiary]">{p.threat_count}</span>
                    <span className={cn(
                      "text-[10px] font-mono",
                      p.trend_direction === "up" ? "text-threat-critical" : p.trend_direction === "down" ? "text-green-400" : "text-[--text-tertiary]"
                    )}>
                      {p.trend_direction === "up" ? "\u2191" : p.trend_direction === "down" ? "\u2193" : "\u2192"}
                      {Math.abs(p.trend_pct)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">
                <Server className="w-5 h-5 text-[--text-disabled] mx-auto mb-2" />
                <p className="text-[11px] text-[--text-tertiary]">Run GeoIP enrichment to populate provider data</p>
                <button
                  onClick={async () => {
                    setEnriching(true);
                    try {
                      await threats.enrichGeo();
                      queryClient.invalidateQueries({ queryKey: ["threat-stats"] });
                      queryClient.invalidateQueries({ queryKey: ["provider-stats"] });
                    } catch {}
                    setEnriching(false);
                  }}
                  disabled={enriching}
                  className="text-[10px] mt-2 px-3 py-1 rounded border border-blue-500/30 text-blue-500 hover:bg-blue-500/10 font-mono disabled:opacity-50"
                >
                  {enriching ? "Enriching..." : "Enrich Now"}
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ═══ Threat Type + Source Breakdown Row ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Threat Type */}
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" /> By Threat Type
            </h3>
            <div className="space-y-2">
              {stats.byType.map((t) => {
                const pct = stats.summary.total ? Math.round((t.count / stats.summary.total) * 100) : 0;
                return (
                  <div key={t.type} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: threatTypeColors[t.type] ?? "#64748B" }} />
                    <span className="text-xs text-[--text-secondary] w-28 truncate capitalize">{t.type}</span>
                    <div className="flex-1 h-2 rounded-full bg-[--surface-base] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: threatTypeColors[t.type] ?? "#64748B", opacity: 0.7 }} />
                    </div>
                    <span className="text-xs text-[--text-tertiary] tabular-nums w-12 text-right font-mono">{t.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Threat Source Breakdown */}
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" /> Intelligence Sources
              <span className="text-[9px] font-mono text-blue-500 ml-auto">{stats.bySource.length} FEEDS</span>
            </h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {stats.bySource.map((s) => {
                const total = stats.bySource.reduce((sum, x) => sum + x.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <div key={s.source} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[--text-tertiary] w-28 truncate uppercase">{s.source}</span>
                    <div className="flex-1 h-2 bg-[--surface-base] rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-[--text-primary] w-10 text-right tabular-nums">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Tabbed Intelligence Lists ═══ */}
      <Card className="overflow-hidden p-0">
        <div className="px-4 lg:px-5 py-3 border-b border-[--border-subtle] flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[--text-tertiary]" />
            <Input placeholder="Search threats, domains, IOCs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-xs" />
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
              <button onClick={() => { setSearchQuery(""); setSeverityFilter(null); }} className="text-2xs text-blue-500 hover:text-cyan-300 px-2 py-1">Clear</button>
            )}
          </div>
        </div>

        <Tabs defaultValue="threats" className="w-full">
          <div className="px-4 border-b border-[--border-subtle]">
            <TabsList className="bg-transparent h-auto p-0 gap-0">
              <TabsTrigger value="threats" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2.5 text-xs gap-1.5">
                <Crosshair className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Active Threats</span>
                <span className="sm:hidden">Threats</span>
                <Badge className="text-[9px] px-1.5 py-0 ml-1">{threatCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="geo" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2.5 text-xs gap-1.5">
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
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-[--border-subtle] max-h-[500px] overflow-y-auto">
              {threatsLoading ? (
                <div className="px-4 py-8 text-center text-[--text-tertiary] text-sm">Loading...</div>
              ) : filteredThreats.length === 0 ? (
                <div className="px-4 py-8 text-center text-[--text-tertiary] text-sm">No threats match your filters</div>
              ) : filteredThreats.map((t) => (
                <div key={t.id} className="p-3 hover:bg-surface-overlay/30 transition-colors cursor-pointer" onClick={() => setSelectedThreat(t)}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-[--text-primary] text-sm truncate flex-1">{t.title}</span>
                    <span className="text-blue-500 font-mono text-xs ml-2">{confidence(t)}</span>
                  </div>
                  {t.domain && <p className="font-mono text-[11px] text-threat-critical mb-1 truncate">{t.domain}</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-overlay text-[--text-secondary] border border-[--border-subtle]">{t.type}</span>
                    <SeverityBadge severity={t.severity} />
                    <span className="text-[9px] text-[--text-tertiary] font-mono">{t.source}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
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
                  ) : filteredThreats.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-overlay/30 transition-colors cursor-pointer" onClick={() => setSelectedThreat(t)}>
                      <td className="px-4 py-3 font-bold text-[--text-primary] max-w-[200px] truncate">{t.title}</td>
                      <td className="px-4 py-3 font-mono text-xs text-threat-critical max-w-[180px] truncate">{t.domain || t.ioc_value || "\u2014"}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-surface-overlay text-[--text-secondary] border border-[--border-subtle]">{t.type}</span>
                      </td>
                      <td className="px-4 py-3"><SeverityBadge severity={t.severity} /></td>
                      <td className="px-4 py-3 text-xs font-mono text-[--text-tertiary]">{t.source}</td>
                      <td className="px-4 py-3 text-right"><span className="text-blue-500 font-mono text-xs">{confidence(t)}</span></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(t.ioc_value || t.domain || t.title); }} className="text-[--text-tertiary] hover:text-[--text-primary]" title="Copy IOC">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Geo Analysis Tab ── */}
          <TabsContent value="geo" className="mt-0">
            <div className="px-4 py-2 border-b border-[--border-subtle] bg-[--surface-base]/50">
              <span className="text-2xs text-[--text-tertiary] font-mono">{byCountry.length} COUNTRIES</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {byCountry.length === 0 ? (
                <div className="px-4 py-10 flex flex-col items-center gap-3">
                  <Globe2 className="w-8 h-8 text-[--text-disabled]" />
                  <p className="text-sm text-[--text-tertiary]">No geographic data available</p>
                  <button
                    onClick={async () => {
                      setEnriching(true); setEnrichResult(null);
                      try {
                        const result = await threats.enrichGeo();
                        setEnrichResult(`Enriched ${result.enriched} of ${result.total} threats`);
                        queryClient.invalidateQueries({ queryKey: ["threat-stats"] });
                      } catch { setEnrichResult("Enrichment failed"); }
                      setEnriching(false);
                    }}
                    disabled={enriching}
                    className="text-xs px-4 py-2 rounded-md border border-blue-500/40 text-blue-500 hover:bg-blue-500/10 font-mono flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", enriching && "animate-spin")} />
                    {enriching ? "Enriching..." : "Run GeoIP Enrichment"}
                  </button>
                  {enrichResult && <p className="text-xs text-blue-500/80 font-mono mt-1">{enrichResult}</p>}
                </div>
              ) : (
                <div className="p-4 space-y-1.5">
                  {byCountry.map((c, i) => {
                    const pct = maxCount > 0 ? Math.round((c.count / maxCount) * 100) : 0;
                    const name = countryNames[c.country_code] ?? c.country_code;
                    const color = barColor(c.count);
                    const sevColor = pct >= 70 ? severityColors.critical : pct >= 40 ? severityColors.high : pct >= 15 ? severityColors.medium : severityColors.low;
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

      {/* Detail Dialog */}
      <ThreatDetailDialog
        threat={selectedThreat}
        open={!!selectedThreat}
        onOpenChange={(open) => { if (!open) setSelectedThreat(null); }}
      />
    </motion.div>
  );
}
