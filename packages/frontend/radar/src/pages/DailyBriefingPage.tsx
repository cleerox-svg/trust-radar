import { useQuery, useQueryClient } from "@tanstack/react-query";
import { briefings, dailyBriefing, tickets, type Briefing } from "../lib/api";
import { Card, CardContent, Badge, Separator } from "../components/ui";
import { cn } from "../lib/cn";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Play, Clock, Shield, ShieldAlert, AlertCircle,
  TrendingUp, Database, ChevronDown, ChevronUp, RefreshCw,
  CheckCircle2, XCircle, BarChart3, Globe2, Zap, Target,
  Copy, Printer, ExternalLink, ChevronRight, AlertTriangle,
  Activity, BookOpen, Crosshair, ArrowUpRight, ArrowDownRight,
  Minus, Ticket, ClipboardList, Brain, History, Eye,
  Bug, Lock, Radio,
} from "lucide-react";

/* ─── Types for structured briefing body ──────────────────────── */

interface BriefingSummary {
  totalThreats: number;
  bySeverity: Record<string, number>;
  activeSources: number;
  resolved: number;
  newLast24h: number;
  riskLevel: string;
}

interface TopBrand {
  brand: string;
  impactType: string;
  threatCount: number;
  severity: string;
  summary: string;
  sources: string[];
}

interface Campaign {
  name: string;
  brands: string[];
  domainCount: number;
  severity: string;
  dataPoints: Array<{ source: string; type: string; value: string; context: string }>;
  correlationLogic: string;
}

interface TopRisk {
  title: string;
  priority: string;
  description: string;
  evidence: string[];
  actions: string[];
}

interface TrendItem {
  direction: string;
  observation: string;
  significance: string;
}

interface PlaybookAction {
  category: string;
  action: string;
  target: string;
  priority: string;
  context: string;
}

interface FeedHealth {
  healthyCount: number;
  staleFeeds: string[];
  recommendations: string[];
}

interface BriefingBody {
  summary: BriefingSummary;
  topBrands: TopBrand[];
  campaigns: Campaign[];
  topRisks: TopRisk[];
  trends: TrendItem[];
  feedHealth: FeedHealth;
  recommendations: string[];
  actionPlaybook: PlaybookAction[];
  topThreatTypes: Array<{ type: string; cnt: number }>;
  topSources: Array<{ source: string; cnt: number }>;
  criticalHighlights: Array<{ title: string; type: string; source: string; domain?: string; ip_address?: string }>;
  period: string;
  riskLevel: string;
  generatedAt: string;
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function timeAgo(date: string | null): string {
  if (!date) return "\u2014";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(date: string | null): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof Shield; label: string }> = {
  ELEVATED: { color: "text-threat-critical", bg: "bg-threat-critical/10", border: "border-threat-critical/30", icon: ShieldAlert, label: "Elevated" },
  GUARDED:  { color: "text-threat-high", bg: "bg-threat-high/10", border: "border-threat-high/30", icon: AlertCircle, label: "Guarded" },
  NORMAL:   { color: "text-threat-low", bg: "bg-threat-low/10", border: "border-threat-low/30", icon: Shield, label: "Normal" },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-threat-critical", high: "text-threat-high", medium: "text-threat-medium", low: "text-threat-low", info: "text-blue-400",
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; icon: typeof AlertTriangle }> = {
  immediate:    { color: "text-threat-critical", bg: "bg-threat-critical/10", icon: AlertTriangle },
  "short-term": { color: "text-threat-high", bg: "bg-threat-high/10", icon: AlertCircle },
  monitor:      { color: "text-cyan-400", bg: "bg-cyan-400/10", icon: Eye },
};

const PLAYBOOK_ICONS: Record<string, typeof Crosshair> = {
  Investigate: Crosshair, Escalate: ArrowUpRight, Defend: Shield, Track: ClipboardList,
};

const TREND_ICONS: Record<string, typeof TrendingUp> = {
  increasing: ArrowUpRight, decreasing: ArrowDownRight, stable: Minus,
};

/* ─── Executive Summary Panel ─────────────────────────────────── */

function ExecutiveSummary({ summary, riskLevel }: { summary: BriefingSummary; riskLevel: string }) {
  const cfg = RISK_CONFIG[riskLevel] ?? RISK_CONFIG.NORMAL;
  const RiskIcon = cfg.icon;

  return (
    <div className={cn("p-4 rounded-lg border", cfg.bg, cfg.border)}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("p-2 rounded-lg", cfg.bg, "border", cfg.border)}>
          <RiskIcon className={cn("w-5 h-5", cfg.color)} />
        </div>
        <div>
          <div className={cn("text-lg font-bold", cfg.color)}>Threat Posture: {cfg.label}</div>
          <div className="text-xs text-[--text-secondary]">
            {summary.totalThreats} threats from {summary.activeSources} sources {"\u00b7"} {summary.resolved} resolved
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {[
          { label: "Total", value: summary.totalThreats, icon: Database, color: "text-cyan-400" },
          { label: "Critical", value: summary.bySeverity?.critical ?? 0, icon: ShieldAlert, color: "text-threat-critical" },
          { label: "High", value: summary.bySeverity?.high ?? 0, icon: AlertCircle, color: "text-threat-high" },
          { label: "Medium", value: summary.bySeverity?.medium ?? 0, icon: TrendingUp, color: "text-threat-medium" },
          { label: "Resolved", value: summary.resolved ?? 0, icon: CheckCircle2, color: "text-threat-low" },
          { label: "Sources", value: summary.activeSources ?? 0, icon: Globe2, color: "text-cyan-400" },
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
    </div>
  );
}

/* ─── Top Brands Section ──────────────────────────────────────── */

function TopBrandsSection({ brands }: { brands: TopBrand[] }) {
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  if (brands.length === 0) return <div className="text-sm text-[--text-tertiary] text-center py-8">No brand data in this briefing.</div>;

  return (
    <div>
      <h3 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5 text-cyan-400" /> Top 5 Impacted Brands
      </h3>
      <div className="space-y-2">
        {brands.map((brand) => (
          <div key={brand.brand} className="rounded-lg border border-[--border-subtle] overflow-hidden">
            <button onClick={() => setExpandedBrand(expandedBrand === brand.brand ? null : brand.brand)} className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-[--surface-overlay]/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={cn("w-2 h-2 rounded-full shrink-0", brand.severity === "critical" ? "bg-threat-critical" : brand.severity === "high" ? "bg-threat-high" : "bg-cyan-400")} />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-[--text-primary]">{brand.brand}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={brand.severity === "critical" ? "critical" : brand.severity === "high" ? "medium" : "low"} className="text-2xs">{brand.impactType}</Badge>
                    <span className="text-[10px] text-[--text-tertiary] font-mono">{brand.threatCount} threats</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex gap-1">
                  {brand.sources.slice(0, 3).map((s) => (
                    <span key={s} className="text-[9px] font-mono bg-[--surface-base] px-1.5 py-0.5 rounded text-[--text-tertiary]">{s}</span>
                  ))}
                </div>
                {expandedBrand === brand.brand ? <ChevronUp className="w-3.5 h-3.5 text-[--text-tertiary]" /> : <ChevronDown className="w-3.5 h-3.5 text-[--text-tertiary]" />}
              </div>
            </button>
            <AnimatePresence>
              {expandedBrand === brand.brand && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="px-3 py-3 bg-[--surface-base] border-t border-[--border-subtle]">
                    <p className="text-xs text-[--text-secondary] mb-2">{brand.summary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brand.sources.map((s) => (
                        <span key={s} className="text-[10px] font-mono bg-[--surface-raised] px-2 py-1 rounded border border-[--border-subtle] text-[--text-tertiary]">{s}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Campaigns Section ───────────────────────────────────────── */

function CampaignsSection({ campaigns }: { campaigns: Campaign[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (campaigns.length === 0) return <div className="text-sm text-[--text-tertiary] text-center py-8">No campaign clusters detected.</div>;

  return (
    <div>
      <h3 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Bug className="w-3.5 h-3.5 text-violet-400" /> Active Campaigns
      </h3>
      <div className="space-y-2">
        {campaigns.map((c, idx) => (
          <div key={idx} className="rounded-lg border border-[--border-subtle] overflow-hidden">
            <button onClick={() => setExpanded(expanded === c.name ? null : c.name)} className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-[--surface-overlay]/30 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[--text-primary]">{c.name}</span>
                  <Badge variant={c.severity === "critical" ? "critical" : c.severity === "high" ? "medium" : "low"} className="text-2xs">{c.severity}</Badge>
                </div>
                <div className="text-[10px] text-[--text-tertiary] mt-0.5">{c.domainCount} domains {"\u00b7"} {c.dataPoints.length} data points</div>
              </div>
              {expanded === c.name ? <ChevronUp className="w-3.5 h-3.5 text-[--text-tertiary]" /> : <ChevronDown className="w-3.5 h-3.5 text-[--text-tertiary]" />}
            </button>
            <AnimatePresence>
              {expanded === c.name && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="px-3 py-3 bg-[--surface-base] border-t border-[--border-subtle] space-y-3">
                    <div>
                      <div className="text-[10px] text-[--text-tertiary] uppercase tracking-wider mb-1 font-semibold flex items-center gap-1"><Brain className="w-3 h-3" /> Correlation Logic</div>
                      <p className="text-xs text-[--text-secondary]">{c.correlationLogic}</p>
                    </div>
                    {c.brands.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[--text-tertiary] uppercase tracking-wider mb-1 font-semibold">Targeted</div>
                        <div className="flex flex-wrap gap-1">{c.brands.map((b) => <span key={b} className="text-[10px] font-mono bg-[--surface-raised] px-2 py-0.5 rounded border border-[--border-subtle] text-[--text-secondary]">{b}</span>)}</div>
                      </div>
                    )}
                    {c.dataPoints.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[--text-tertiary] uppercase tracking-wider mb-1 font-semibold">Evidence</div>
                        <div className="space-y-1">{c.dataPoints.map((dp, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs py-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                            <div><span className="text-[--text-primary] font-mono">{dp.value || dp.context}</span><div className="text-[10px] text-[--text-tertiary]">{dp.source} {"\u00b7"} {dp.type}</div></div>
                          </div>
                        ))}</div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Top Risks ───────────────────────────────────────────────── */

function TopRisksSection({ risks }: { risks: TopRisk[] }) {
  if (risks.length === 0) return <div className="text-sm text-[--text-tertiary] text-center py-8">No elevated risks detected.</div>;
  return (
    <div>
      <h3 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-threat-high" /> Top Risks
      </h3>
      <div className="space-y-3">
        {risks.map((risk, idx) => {
          const pc = PRIORITY_CONFIG[risk.priority] ?? PRIORITY_CONFIG.monitor;
          const PIcon = pc.icon;
          return (
            <div key={idx} className={cn("p-3 rounded-lg border", pc.bg, "border-opacity-30")}>
              <div className="flex items-start gap-2 mb-2">
                <PIcon className={cn("w-4 h-4 mt-0.5 shrink-0", pc.color)} />
                <div>
                  <div className="text-sm font-medium text-[--text-primary]">{risk.title}</div>
                  <Badge variant={risk.priority === "immediate" ? "critical" : risk.priority === "short-term" ? "medium" : "info"} className="text-2xs mt-0.5">{risk.priority}</Badge>
                </div>
              </div>
              <p className="text-xs text-[--text-secondary] mb-2 ml-6">{risk.description}</p>
              {risk.evidence.length > 0 && <div className="ml-6 mb-2"><div className="text-[10px] text-[--text-tertiary] uppercase tracking-wider mb-1 font-semibold">Evidence</div>{risk.evidence.map((e, i) => <div key={i} className="text-xs text-[--text-secondary] flex items-start gap-1.5"><span className="text-[--text-disabled]">{"\u2022"}</span> {e}</div>)}</div>}
              {risk.actions.length > 0 && <div className="ml-6"><div className="text-[10px] text-[--text-tertiary] uppercase tracking-wider mb-1 font-semibold">Actions</div>{risk.actions.map((a, i) => <div key={i} className="text-xs text-cyan-400/80 flex items-start gap-1.5"><ChevronRight className="w-3 h-3 mt-0.5 shrink-0" /> {a}</div>)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Action Playbook ─────────────────────────────────────────── */

function PlaybookSection({ actions }: { actions: PlaybookAction[] }) {
  const [creating, setCreating] = useState<number | null>(null);
  if (actions.length === 0) return <div className="text-sm text-[--text-tertiary] text-center py-8">No playbook actions generated.</div>;

  const byCategory = actions.reduce((acc, a) => { if (!acc[a.category]) acc[a.category] = []; acc[a.category].push(a); return acc; }, {} as Record<string, PlaybookAction[]>);

  const handleCreateTicket = async (action: PlaybookAction, idx: number) => {
    setCreating(idx);
    try { await tickets.create({ title: `[Briefing] ${action.action}: ${action.target}`, severity: action.priority === "high" ? "high" : "medium", category: action.category.toLowerCase(), tags: `briefing,${action.category.toLowerCase()}` }); } catch { /* */ }
    finally { setCreating(null); }
  };

  return (
    <div>
      <h3 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <ClipboardList className="w-3.5 h-3.5 text-cyan-400" /> Action Playbook ({actions.length})
      </h3>
      <div className="space-y-4">
        {Object.entries(byCategory).map(([cat, items]) => {
          const CatIcon = PLAYBOOK_ICONS[cat] ?? Zap;
          return (
            <div key={cat}>
              <div className="flex items-center gap-1.5 mb-2"><CatIcon className="w-3.5 h-3.5 text-cyan-400" /><span className="text-[10px] font-bold text-[--text-secondary] uppercase tracking-wider">{cat}</span><span className="text-[10px] text-[--text-tertiary]">({items.length})</span></div>
              <div className="space-y-1.5">
                {items.map((action, i) => {
                  const gIdx = actions.indexOf(action);
                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md bg-[--surface-base] border border-[--border-subtle] group">
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", action.priority === "high" ? "bg-threat-critical" : action.priority === "medium" ? "bg-threat-medium" : "bg-cyan-400")} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[--text-primary]"><span className="font-medium">{action.action}</span>: <span className="font-mono text-cyan-400">{action.target}</span></div>
                        <div className="text-[10px] text-[--text-tertiary]">{action.context}</div>
                      </div>
                      <button onClick={() => handleCreateTicket(action, gIdx)} disabled={creating === gIdx} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-[10px] rounded border border-[--border-subtle] text-[--text-tertiary] hover:text-cyan-400 hover:border-cyan-400/40 disabled:opacity-50" title="Create ticket">
                        {creating === gIdx ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Ticket className="w-3 h-3" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Intel Bulletin ──────────────────────────────────────────── */

function IntelBulletin({ briefing, content }: { briefing: Briefing; content: BriefingBody }) {
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = () => {
    const text = [`TLP:AMBER \u2014 ${briefing.title}`, `Generated: ${formatDate(briefing.created_at)}`, `Risk: ${content.riskLevel}`, "", "EXECUTIVE SUMMARY", `${content.summary.totalThreats} threats from ${content.summary.activeSources} sources. Critical: ${content.summary.bySeverity?.critical ?? 0}, High: ${content.summary.bySeverity?.high ?? 0}`, "", ...(content.topBrands.length > 0 ? ["TOP BRANDS", ...content.topBrands.map((b) => `- ${b.brand}: ${b.threatCount} threats (${b.severity})`), ""] : []), ...(content.recommendations.length > 0 ? ["RECOMMENDATIONS", ...content.recommendations.map((r) => `- ${r}`)] : [])].join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-amber-500/10 transition-colors">
        <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-amber-400" /><span className="text-sm font-bold text-amber-400">TLP:AMBER Intelligence Bulletin</span></div>
        {expanded ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 py-3 border-t border-amber-500/20 space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={copyToClipboard} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"><Copy className="w-3 h-3" /> Copy</button>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"><Printer className="w-3 h-3" /> Print</button>
              </div>
              <div className="font-mono text-xs space-y-2 text-[--text-secondary]">
                <div className="text-amber-400 font-bold">TLP:AMBER \u2014 {briefing.title}</div>
                <div>Generated: {formatDate(briefing.created_at)} | Risk: {content.riskLevel}</div>
                <Separator />
                <div><div className="font-bold text-[--text-primary]">SUMMARY</div><div>{content.summary.totalThreats} threats from {content.summary.activeSources} sources. Critical: {content.summary.bySeverity?.critical ?? 0}, High: {content.summary.bySeverity?.high ?? 0}, Medium: {content.summary.bySeverity?.medium ?? 0}</div></div>
                {content.recommendations.length > 0 && <div><div className="font-bold text-[--text-primary]">RECOMMENDATIONS</div>{content.recommendations.map((r, i) => <div key={i}>- {r}</div>)}</div>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Full Briefing Card ──────────────────────────────────────── */

function FullBriefingCard({ briefing, isExpanded, onToggle }: { briefing: Briefing; isExpanded: boolean; onToggle: () => void }) {
  let content: BriefingBody | null = null;
  try { if (briefing.body) content = JSON.parse(briefing.body) as BriefingBody; } catch { /* */ }

  const riskLevel = content?.riskLevel ?? briefing.severity?.toUpperCase() ?? "NORMAL";
  const riskCfg = RISK_CONFIG[riskLevel] ?? RISK_CONFIG.NORMAL;
  const RiskIcon = riskCfg.icon;
  const [activeTab, setActiveTab] = useState<"overview" | "brands" | "campaigns" | "risks" | "playbook">("overview");

  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="w-full text-left">
        <div className="px-4 lg:px-5 py-3 flex items-center justify-between gap-3 hover:bg-[--surface-overlay]/20 transition-colors">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn("p-1.5 rounded-md", riskCfg.bg, "border", riskCfg.border)}><RiskIcon className={cn("w-4 h-4", riskCfg.color)} /></div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[--text-primary] truncate">{briefing.title}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant={riskLevel === "ELEVATED" ? "critical" : riskLevel === "GUARDED" ? "medium" : "low"} className="text-2xs">{riskLevel}</Badge>
                <Badge variant={briefing.status === "published" ? "low" : "info"} className="text-2xs">{briefing.status}</Badge>
                <span className="text-[10px] text-[--text-tertiary] font-mono">{timeAgo(briefing.created_at)}</span>
                {content?.period && <span className="text-[10px] text-[--text-tertiary] font-mono hidden sm:inline">{"\u00b7"} {content.period}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {content?.summary && (
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right"><div className="text-xs text-[--text-tertiary]">Threats</div><div className="text-sm font-bold text-[--text-primary] tabular-nums">{content.summary.totalThreats}</div></div>
                <div className="text-right"><div className="text-xs text-[--text-tertiary]">Critical</div><div className="text-sm font-bold text-threat-critical tabular-nums">{content.summary.bySeverity?.critical ?? 0}</div></div>
              </div>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4 text-[--text-tertiary]" /> : <ChevronDown className="w-4 h-4 text-[--text-tertiary]" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && content && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <Separator />
            <div className="px-4 lg:px-5 py-4 space-y-5">
              <ExecutiveSummary summary={content.summary} riskLevel={riskLevel} />

              {/* Tab navigation */}
              <div className="flex items-center gap-1 border-b border-[--border-subtle] pb-0">
                {([
                  { id: "overview" as const, label: "Overview", icon: BarChart3 },
                  { id: "brands" as const, label: `Brands (${content.topBrands?.length ?? 0})`, icon: Target },
                  { id: "campaigns" as const, label: `Campaigns (${content.campaigns?.length ?? 0})`, icon: Bug },
                  { id: "risks" as const, label: `Risks (${content.topRisks?.length ?? 0})`, icon: AlertTriangle },
                  { id: "playbook" as const, label: `Playbook (${content.actionPlaybook?.length ?? 0})`, icon: ClipboardList },
                ]).map((tab) => (
                  <button key={tab.id} onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id); }}
                    className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-[1px]",
                      activeTab === tab.id ? "border-cyan-400 text-cyan-400" : "border-transparent text-[--text-tertiary] hover:text-[--text-secondary]"
                    )}
                  ><tab.icon className="w-3.5 h-3.5" /><span className="hidden sm:inline">{tab.label}</span></button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === "overview" && (
                <div className="space-y-5">
                  {content.topThreatTypes && content.topThreatTypes.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-2 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Top Threat Types</h4>
                      <div className="space-y-1.5">
                        {content.topThreatTypes.map((t) => {
                          const maxCnt = Math.max(...content!.topThreatTypes.map((x) => x.cnt), 1);
                          return (
                            <div key={t.type} className="flex items-center gap-3">
                              <span className="text-xs text-[--text-secondary] w-28 truncate font-mono">{t.type}</span>
                              <div className="flex-1 h-2 rounded-full bg-[--surface-base] overflow-hidden"><div className="h-full rounded-full bg-cyan-500/50" style={{ width: `${Math.round((t.cnt / maxCnt) * 100)}%` }} /></div>
                              <span className="text-xs font-mono text-[--text-tertiary] tabular-nums w-10 text-right">{t.cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {content.topSources && content.topSources.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-2 flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-cyan-400" /> Sources</h4>
                      <div className="flex flex-wrap gap-2">{content.topSources.map((s) => <div key={s.source} className="px-2.5 py-1.5 rounded-md bg-[--surface-base] border border-[--border-subtle]"><span className="text-[10px] text-[--text-tertiary] font-mono uppercase">{s.source}</span><div className="text-sm font-bold text-[--text-primary] tabular-nums">{s.cnt}</div></div>)}</div>
                    </div>
                  )}
                  {content.criticalHighlights && content.criticalHighlights.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-2 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-threat-critical" /> Critical Highlights</h4>
                      <div className="space-y-1.5 bg-[--surface-base] rounded-md border border-[--border-subtle] p-3">{content.criticalHighlights.map((h, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs py-1"><span className="w-1.5 h-1.5 rounded-full bg-threat-critical mt-1.5 shrink-0" /><div className="min-w-0 flex-1"><span className="text-[--text-primary] font-medium">{h.title}</span><div className="flex items-center gap-2 mt-0.5 text-[10px] text-[--text-tertiary] font-mono"><span>{h.type}</span>{h.domain && <><span>{"\u00b7"}</span><span className="text-threat-critical">{h.domain}</span></>}{h.ip_address && <><span>{"\u00b7"}</span><span>{h.ip_address}</span></>}<span>{"\u00b7"}</span><span>{h.source}</span></div></div></div>
                      ))}</div>
                    </div>
                  )}
                  {content.trends && content.trends.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-3 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-cyan-400" /> Trends</h3>
                      <div className="space-y-2">{content.trends.map((t, i) => {
                        const TIcon = TREND_ICONS[t.direction] ?? Minus;
                        return <div key={i} className="flex items-start gap-2 p-2.5 rounded-md bg-[--surface-base] border border-[--border-subtle]"><TIcon className={cn("w-4 h-4 mt-0.5 shrink-0", t.direction === "increasing" ? "text-threat-high" : t.direction === "decreasing" ? "text-threat-low" : "text-cyan-400")} /><div><div className="text-xs text-[--text-primary] font-medium">{t.observation}</div><div className="text-[10px] text-[--text-tertiary]">{t.significance}</div></div></div>;
                      })}</div>
                    </div>
                  )}
                  {content.feedHealth && (
                    <div>
                      <h3 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-3 flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-green-400" /> Feed Health</h3>
                      <div className="p-3 rounded-md bg-[--surface-base] border border-[--border-subtle]">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-lg font-bold text-green-400 tabular-nums">{content.feedHealth.healthyCount}</div><span className="text-xs text-[--text-secondary]">healthy</span>
                          {content.feedHealth.staleFeeds.length > 0 && <><span className="text-[--text-disabled]">{"\u00b7"}</span><div className="text-lg font-bold text-threat-critical tabular-nums">{content.feedHealth.staleFeeds.length}</div><span className="text-xs text-threat-critical">stale</span></>}
                        </div>
                        {content.feedHealth.staleFeeds.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{content.feedHealth.staleFeeds.map((f) => <span key={f} className="text-[10px] font-mono bg-threat-critical/10 text-threat-critical px-2 py-0.5 rounded">{f}</span>)}</div>}
                        {content.feedHealth.recommendations.map((r, i) => <div key={i} className="text-xs text-[--text-tertiary] flex items-start gap-1.5"><ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-[--text-disabled]" /> {r}</div>)}
                      </div>
                    </div>
                  )}
                  {content.recommendations && content.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-[--text-secondary] uppercase tracking-wider mb-2 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Recommendations</h4>
                      <div className="space-y-1.5">{content.recommendations.map((r, i) => <div key={i} className="flex items-start gap-2 text-xs text-[--text-secondary]"><ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-cyan-400" /> {r}</div>)}</div>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "brands" && <TopBrandsSection brands={content.topBrands ?? []} />}
              {activeTab === "campaigns" && <CampaignsSection campaigns={content.campaigns ?? []} />}
              {activeTab === "risks" && <TopRisksSection risks={content.topRisks ?? []} />}
              {activeTab === "playbook" && <PlaybookSection actions={content.actionPlaybook ?? []} />}

              <IntelBulletin briefing={briefing} content={content} />

              <div className="flex items-center gap-4 pt-2 text-[10px] text-[--text-tertiary] font-mono border-t border-[--border-subtle]">
                <span>Generated: {formatDate(briefing.created_at)}</span>
                {briefing.published_at && <span>Published: {formatDate(briefing.published_at)}</span>}
                {briefing.generated_by && <span>By: {briefing.generated_by}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/* ─── Time range options ──────────────────────────────────────── */

const TIME_RANGES = [
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "7d", hours: 168 },
];

/* ═══ Page ════════════════════════════════════════════════════════ */

export function DailyBriefingPage() {
  const queryClient = useQueryClient();
  const { data: briefingList, isLoading } = useQuery({ queryKey: ["briefings"], queryFn: briefings.list, staleTime: 30_000 });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedRange, setSelectedRange] = useState(24);
  const [genResult, setGenResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const result = await dailyBriefing.generate(selectedRange);
      setGenResult({ ok: true, message: "Briefing generated successfully" });
      queryClient.invalidateQueries({ queryKey: ["briefings"] });
      if (result?.id) setExpandedId(result.id);
    } catch (err) {
      setGenResult({ ok: false, message: String(err) });
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadCached = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      await dailyBriefing.generate(selectedRange, true);
      setGenResult({ ok: true, message: "Loaded cached briefing" });
      queryClient.invalidateQueries({ queryKey: ["briefings"] });
    } catch {
      setGenResult({ ok: false, message: "No cached briefing available. Generate a new one." });
    } finally {
      setGenerating(false);
    }
  };

  const filteredBriefings = (briefingList ?? []).filter((b) => !statusFilter || b.status === statusFilter);
  const statusCounts = (briefingList ?? []).reduce((acc, b) => { acc[b.status] = (acc[b.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1 flex items-center gap-2"><FileText className="w-6 h-6 text-cyan-400" /> Daily Briefing</h1>
          <p className="text-sm text-[--text-secondary]">Threat intelligence briefings synthesized from 9 data sources across the platform</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="flex items-center gap-1 bg-[--surface-base] rounded-md border border-[--border-subtle] p-0.5">
            {TIME_RANGES.map((r) => (
              <button key={r.hours} onClick={() => setSelectedRange(r.hours)} className={cn("text-2xs px-2.5 py-1 rounded font-mono transition-colors", selectedRange === r.hours ? "bg-cyan-400/15 text-cyan-400 font-semibold" : "text-[--text-tertiary] hover:text-[--text-secondary]")}>{r.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleLoadCached} disabled={generating} className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[--border-subtle] text-xs text-[--text-secondary] hover:text-[--text-primary] transition-colors disabled:opacity-50" title="Load cached (12h TTL)"><History className="w-3.5 h-3.5" /> Cached</button>
            <button onClick={handleGenerate} disabled={generating} className={cn("flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-all", generating ? "bg-cyan-400/10 text-cyan-400/60 border-cyan-400/20 cursor-wait" : "bg-cyan-400/15 text-cyan-400 border-cyan-400/30 hover:bg-cyan-400/25 hover:shadow-[0_0_16px_rgba(34,211,238,0.1)]")}>
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {generating ? "Generating..." : "Generate Briefing"}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {genResult && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-md border text-sm", genResult.ok ? "bg-threat-low/10 text-threat-low border-threat-low/30" : "bg-threat-critical/10 text-threat-critical border-threat-critical/30")}>
            {genResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            {genResult.message}
            <button onClick={() => setGenResult(null)} className="ml-auto text-[--text-tertiary] hover:text-[--text-primary] text-xs">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      {(briefingList ?? []).length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setStatusFilter(null)} className={cn("text-2xs px-2.5 py-1 rounded-md border font-mono transition-colors", !statusFilter ? "bg-cyan-400/15 text-cyan-400 border-cyan-400/30" : "bg-[--surface-base] text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]")}>All ({(briefingList ?? []).length})</button>
          {Object.entries(statusCounts).map(([status, count]) => (
            <button key={status} onClick={() => setStatusFilter(statusFilter === status ? null : status)} className={cn("text-2xs px-2.5 py-1 rounded-md border font-mono transition-colors capitalize", statusFilter === status ? status === "published" ? "bg-threat-low/15 text-threat-low border-threat-low/30" : "bg-blue-400/15 text-blue-400 border-blue-400/30" : "bg-[--surface-base] text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]")}>{status} ({count})</button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3"><RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" /><p className="text-sm text-[--text-tertiary]">Loading briefings...</p></div>
      ) : filteredBriefings.length === 0 ? (
        <Card><CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-10 h-10 text-[--text-disabled] mb-3" />
            <h3 className="text-lg font-semibold text-[--text-primary] mb-2">{statusFilter ? `No ${statusFilter} briefings` : "No Briefings Yet"}</h3>
            <p className="text-sm text-[--text-tertiary] max-w-md mb-6">{statusFilter ? "Try removing the filter or generate a new briefing." : "Generate your first briefing. The system analyzes threats, IOCs, ATO events, breaches, Tor nodes, erasure actions, and feed health in parallel."}</p>
            {!statusFilter && (
              <div className="grid grid-cols-3 gap-4 text-xs text-[--text-tertiary]">
                <span className="flex items-center gap-1"><Target className="w-3 h-3 text-cyan-400" /> Brand analysis</span>
                <span className="flex items-center gap-1"><Bug className="w-3 h-3 text-violet-400" /> Campaign detection</span>
                <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3 text-cyan-400" /> Action playbook</span>
              </div>
            )}
          </div>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredBriefings.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.25 }}>
              <FullBriefingCard briefing={b} isExpanded={expandedId === b.id} onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)} />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
