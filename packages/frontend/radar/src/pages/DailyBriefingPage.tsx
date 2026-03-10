import { useQuery, useQueryClient } from "@tanstack/react-query";
import { briefings, agents, type Briefing } from "../lib/api";
import { Card, CardContent, Badge, Separator } from "../components/ui";
import { cn } from "../lib/cn";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, Play, Clock, Shield, ShieldAlert, AlertCircle,
  TrendingUp, Database, ChevronDown, ChevronUp, RefreshCw,
  CheckCircle2, XCircle, BarChart3, Globe2, Zap,
} from "lucide-react";

/* ─── helpers ───────────────────────────────────────────────── */

function timeAgo(date: string | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof Shield }> = {
  ELEVATED: { color: "text-threat-critical", bg: "bg-threat-critical/10", border: "border-threat-critical/30", icon: ShieldAlert },
  GUARDED: { color: "text-threat-high", bg: "bg-threat-high/10", border: "border-threat-high/30", icon: AlertCircle },
  NORMAL: { color: "text-threat-low", bg: "bg-threat-low/10", border: "border-threat-low/30", icon: Shield },
};

/* ─── Briefing Card ─────────────────────────────────────────── */

function BriefingCard({ briefing, isExpanded, onToggle }: {
  briefing: Briefing; isExpanded: boolean; onToggle: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let content: Record<string, any> = {};
  try { if (briefing.body) content = JSON.parse(briefing.body); } catch { /* ignore */ }

  const summary = content.summary as Record<string, unknown> | undefined;
  const riskLevel = (content.riskLevel as string) ?? briefing.severity?.toUpperCase() ?? "NORMAL";
  const riskCfg = RISK_CONFIG[riskLevel] ?? RISK_CONFIG.NORMAL;
  const RiskIcon = riskCfg.icon;
  const bySeverity = summary?.bySeverity as Record<string, number> | undefined;

  return (
    <Card className="overflow-hidden">
      {/* Header — always visible */}
      <button onClick={onToggle} className="w-full text-left">
        <div className="px-4 lg:px-5 py-3 flex items-center justify-between gap-3 hover:bg-surface-overlay/20 transition-colors">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn("p-1.5 rounded-md", riskCfg.bg, "border", riskCfg.border)}>
              <RiskIcon className={cn("w-4 h-4", riskCfg.color)} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[--text-primary] truncate">{briefing.title}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant={riskLevel === "ELEVATED" ? "critical" : riskLevel === "GUARDED" ? "medium" : "low"} className="text-2xs">
                  {riskLevel}
                </Badge>
                <Badge variant={briefing.status === "published" ? "low" : "info"} className="text-2xs">{briefing.status}</Badge>
                <span className="text-[10px] text-[--text-tertiary] font-mono">{timeAgo(briefing.created_at)}</span>
                {content.period && (
                  <span className="text-[10px] text-[--text-tertiary] font-mono hidden sm:inline">
                    {"\u00b7"} {content.period}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {summary && (
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-[--text-tertiary]">Threats</div>
                  <div className="text-sm font-bold text-[--text-primary] tabular-nums">{(summary.totalThreats as number) ?? 0}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[--text-tertiary]">Critical</div>
                  <div className="text-sm font-bold text-threat-critical tabular-nums">{bySeverity?.critical ?? 0}</div>
                </div>
              </div>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4 text-[--text-tertiary]" /> : <ChevronDown className="w-4 h-4 text-[--text-tertiary]" />}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <Separator />
          <div className="px-4 lg:px-5 py-4 space-y-4">
            {/* Summary stats grid */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {[
                  { label: "Total Threats", value: (summary.totalThreats as number) ?? 0, icon: Database, color: "text-cyan-400" },
                  { label: "Critical", value: bySeverity?.critical ?? 0, icon: ShieldAlert, color: "text-threat-critical" },
                  { label: "High", value: bySeverity?.high ?? 0, icon: AlertCircle, color: "text-threat-high" },
                  { label: "Medium", value: bySeverity?.medium ?? 0, icon: TrendingUp, color: "text-threat-medium" },
                  { label: "Resolved", value: (summary.resolved as number) ?? 0, icon: CheckCircle2, color: "text-threat-low" },
                  { label: "Sources", value: (summary.activeSources as number) ?? 0, icon: Globe2, color: "text-cyan-400" },
                ].map((c) => (
                  <div key={c.label} className="p-2.5 rounded-md bg-[--surface-base] border border-[--border-subtle]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <c.icon className={cn("w-3 h-3", c.color)} />
                      <span className="text-[10px] text-[--text-tertiary] uppercase tracking-wider font-semibold">{c.label}</span>
                    </div>
                    <div className={cn("text-xl font-bold tabular-nums", c.color)}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Top Threat Types */}
            {content.topThreatTypes && (content.topThreatTypes as unknown[]).length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  Top Threat Types
                </h4>
                <div className="space-y-1.5">
                  {(content.topThreatTypes as Array<{ type: string; cnt: number }>).map((t) => {
                    const maxCnt = Math.max(...(content.topThreatTypes as Array<{ cnt: number }>).map((x) => x.cnt), 1);
                    const pct = Math.round((t.cnt / maxCnt) * 100);
                    return (
                      <div key={t.type} className="flex items-center gap-3">
                        <span className="text-xs text-[--text-secondary] w-28 truncate font-mono">{t.type}</span>
                        <div className="flex-1 h-2 rounded-full bg-[--surface-base] overflow-hidden">
                          <div className="h-full rounded-full bg-cyan-500/50" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono text-[--text-tertiary] tabular-nums w-10 text-right">{t.cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Sources */}
            {content.topSources && (content.topSources as unknown[]).length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  Intelligence Sources
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(content.topSources as Array<{ source: string; cnt: number }>).map((s) => (
                    <div key={s.source} className="px-2.5 py-1.5 rounded-md bg-[--surface-base] border border-[--border-subtle]">
                      <span className="text-[10px] text-[--text-tertiary] font-mono uppercase">{s.source}</span>
                      <div className="text-sm font-bold text-[--text-primary] tabular-nums">{s.cnt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Critical Highlights */}
            {content.criticalHighlights && (content.criticalHighlights as unknown[]).length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-threat-critical" />
                  Critical Highlights
                </h4>
                <div className="space-y-1.5 bg-[--surface-base] rounded-md border border-[--border-subtle] p-3">
                  {(content.criticalHighlights as Array<{ title: string; type: string; source: string; domain?: string; ip_address?: string }>).slice(0, 5).map((h, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-threat-critical mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[--text-primary] font-medium">{h.title}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[--text-tertiary] font-mono">
                          <span>{h.type}</span>
                          {h.domain && <><span>{"\u00b7"}</span><span className="text-threat-critical">{h.domain}</span></>}
                          {h.ip_address && <><span>{"\u00b7"}</span><span>{h.ip_address}</span></>}
                          <span>{"\u00b7"}</span>
                          <span>{h.source}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fallback: plain summary text */}
            {briefing.summary && !content.summary && (
              <p className="text-sm text-[--text-secondary]">{briefing.summary}</p>
            )}

            {/* Metadata footer */}
            <div className="flex items-center gap-4 pt-2 text-[10px] text-[--text-tertiary] font-mono border-t border-[--border-subtle]">
              <span>Generated: {formatDate(briefing.created_at)}</span>
              {briefing.published_at && <span>Published: {formatDate(briefing.published_at)}</span>}
              {briefing.generated_by && <span>By: {briefing.generated_by}</span>}
            </div>
          </div>
        </motion.div>
      )}
    </Card>
  );
}

/* ─── Time range options ────────────────────────────────────── */

const TIME_RANGES = [
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "7d", hours: 168 },
];

/* ─── Page ──────────────────────────────────────────────────── */

export function DailyBriefingPage() {
  const queryClient = useQueryClient();
  const { data: briefingList, isLoading } = useQuery({
    queryKey: ["briefings"],
    queryFn: briefings.list,
    staleTime: 30_000,
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedRange, setSelectedRange] = useState(24);
  const [genResult, setGenResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const result = await agents.trigger("executive-intel", { hoursBack: selectedRange });
      const status = (result as { status?: string }).status ?? "unknown";
      if (status === "awaiting_approval") {
        setGenResult({ ok: true, message: "Briefing generated — awaiting approval in Agent Hub" });
      } else {
        setGenResult({ ok: true, message: "Briefing generated successfully" });
      }
      queryClient.invalidateQueries({ queryKey: ["briefings"] });
    } catch (err) {
      setGenResult({ ok: false, message: String(err) });
    } finally {
      setGenerating(false);
    }
  };

  const filteredBriefings = (briefingList ?? []).filter((b) => {
    if (!statusFilter) return true;
    return b.status === statusFilter;
  });

  const statusCounts = (briefingList ?? []).reduce((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      {/* ═══ Header + Generate Controls ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1 flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            Daily Briefing
          </h1>
          <p className="text-sm text-[--text-secondary]">AI-generated threat intelligence briefings from the Executive Intel agent</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {/* Time range selector */}
          <div className="flex items-center gap-1 bg-[--surface-base] rounded-md border border-[--border-subtle] p-0.5">
            {TIME_RANGES.map((r) => (
              <button
                key={r.hours}
                onClick={() => setSelectedRange(r.hours)}
                className={cn(
                  "text-2xs px-2.5 py-1 rounded font-mono transition-colors",
                  selectedRange === r.hours
                    ? "bg-cyan-400/15 text-cyan-400 font-semibold"
                    : "text-[--text-tertiary] hover:text-[--text-secondary]"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-all",
              generating
                ? "bg-cyan-400/10 text-cyan-400/60 border-cyan-400/20 cursor-wait"
                : "bg-cyan-400/15 text-cyan-400 border-cyan-400/30 hover:bg-cyan-400/25 hover:shadow-[0_0_16px_rgba(34,211,238,0.1)]"
            )}
          >
            {generating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {generating ? "Generating..." : "Generate Briefing"}
          </button>
        </div>
      </div>

      {/* Generation result toast */}
      {genResult && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-md border text-sm",
            genResult.ok
              ? "bg-threat-low/10 text-threat-low border-threat-low/30"
              : "bg-threat-critical/10 text-threat-critical border-threat-critical/30"
          )}
        >
          {genResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {genResult.message}
          <button
            onClick={() => setGenResult(null)}
            className="ml-auto text-[--text-tertiary] hover:text-[--text-primary] text-xs"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* ═══ Status filter tabs ═══ */}
      {(briefingList ?? []).length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter(null)}
            className={cn(
              "text-2xs px-2.5 py-1 rounded-md border font-mono transition-colors",
              !statusFilter
                ? "bg-cyan-400/15 text-cyan-400 border-cyan-400/30"
                : "bg-[--surface-base] text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
            )}
          >
            All ({(briefingList ?? []).length})
          </button>
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? null : status)}
              className={cn(
                "text-2xs px-2.5 py-1 rounded-md border font-mono transition-colors capitalize",
                statusFilter === status
                  ? status === "published" ? "bg-threat-low/15 text-threat-low border-threat-low/30"
                  : status === "draft" ? "bg-blue-400/15 text-blue-400 border-blue-400/30"
                  : "bg-cyan-400/15 text-cyan-400 border-cyan-400/30"
                  : "bg-[--surface-base] text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
              )}
            >
              {status} ({count})
            </button>
          ))}
        </div>
      )}

      {/* ═══ Briefing List ═══ */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
          <p className="text-sm text-[--text-tertiary]">Loading briefings...</p>
        </div>
      ) : filteredBriefings.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-10 h-10 text-[--text-disabled] mb-3" />
              <h3 className="text-lg font-semibold text-[--text-primary] mb-2">
                {statusFilter ? `No ${statusFilter} briefings` : "No Briefings Yet"}
              </h3>
              <p className="text-sm text-[--text-tertiary] max-w-md mb-6">
                {statusFilter
                  ? "Try removing the filter or generate a new briefing."
                  : "Generate your first threat intelligence briefing by selecting a time range and clicking the Generate button above."}
              </p>
              {!statusFilter && (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-[--text-tertiary]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>The Executive Intel agent will analyze threats from the selected time window</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[--text-tertiary]">
                    <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-threat-critical" /> Severity breakdown</span>
                    <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3 text-cyan-400" /> Top threat types</span>
                    <span className="flex items-center gap-1"><Globe2 className="w-3 h-3 text-cyan-400" /> Source analysis</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBriefings.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
            >
              <BriefingCard
                briefing={b}
                isExpanded={expandedId === b.id}
                onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
