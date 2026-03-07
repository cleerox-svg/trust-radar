import { useState, useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  RefreshCw, ChevronLeft, Play, Lock, Activity,
  Eye, Hammer, BarChart2, Search, Database, Zap,
  ShieldAlert, Radar, CheckCircle, GitMerge, Scale, Mic, Bot,
} from "lucide-react";
import { agents } from "../lib/api";
import { Pulse } from "../components/ui/Pulse";
import { FeedsView } from "../components/FeedsView";
import type { AgentDefinition, AgentRun, User, InfluencerProfile } from "../lib/types";

interface Ctx { user: User; selectedInfluencer: InfluencerProfile | null; }

type AgentName = AgentDefinition["name"];
type PanelTab = "intelligence" | "sources" | "runs";

// ─── Agent metadata ───────────────────────────────────────────────────────────
const AGENT_TOOLS: Partial<Record<AgentName, string[]>> = {
  SENTINEL: ["Firecrawl", "Lovable AI"],
  RECON:    ["Firecrawl Search", "Lovable AI"],
  VERITAS:  ["Lovable AI"],
  NEXUS:    ["Firecrawl", "Radar Intel"],
  ARBITER:  ["Lovable AI"],
  WATCHDOG: ["Firecrawl", "Lovable AI"],
  PHANTOM:  ["Lovable AI"],
  manual:   [],
};

const TYPE_COLOR: Record<AgentName, string> = {
  SENTINEL: "text-blue-400",
  RECON:    "text-purple-400",
  VERITAS:  "text-gold",
  NEXUS:    "text-orange-400",
  ARBITER:  "text-threat-critical",
  WATCHDOG: "text-status-live",
  PHANTOM:  "text-slate-400",
  manual:   "text-slate-400",
};

const TYPE_BG: Record<AgentName, string> = {
  SENTINEL: "bg-blue-500/10 border-blue-500/25",
  RECON:    "bg-purple/10 border-purple/25",
  VERITAS:  "bg-gold/10 border-gold/25",
  NEXUS:    "bg-orange-500/10 border-orange-500/25",
  ARBITER:  "bg-threat-critical/10 border-threat-critical/25",
  WATCHDOG: "bg-status-live/10 border-status-live/25",
  PHANTOM:  "bg-slate-500/10 border-slate-500/25",
  manual:   "bg-slate-500/10 border-slate-500/25",
};

/** Unique icon per agent that reflects its function */
const AGENT_ICON: Record<AgentName, React.ReactNode> = {
  SENTINEL: <Eye size={16} />,           // watching / monitoring identities
  RECON:    <Search size={16} />,        // scanning / discovering threats
  VERITAS:  <CheckCircle size={16} />,   // verifying / scoring likeness
  NEXUS:    <GitMerge size={16} />,      // correlating / attributing actors
  ARBITER:  <Scale size={16} />,         // judging / authorising takedowns
  WATCHDOG: <ShieldAlert size={16} />,   // protecting / compliance gating
  PHANTOM:  <Mic size={16} />,           // voice clone / audio detection
  manual:   <Play size={16} />,          // manual trigger
};

// Category section display config (matching screenshot style)
const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  detect:  { label: "DETECT",  icon: <Search size={13} />,       color: "text-blue-400" },
  monitor: { label: "MONITOR", icon: <Eye size={13} />,          color: "text-status-live" },
  respond: { label: "RESPOND", icon: <Hammer size={13} />,       color: "text-threat-critical" },
  analyze: { label: "ANALYZE", icon: <BarChart2 size={13} />,    color: "text-gold" },
};

const CATEGORY_ORDER = ["detect", "monitor", "respond", "analyze"];

// ─── Schedule badge ───────────────────────────────────────────────────────────
function formatSchedule(mins: number | null): string {
  if (!mins) return "Realtime (on-demand)";
  if (mins < 60) return `Every ${mins} minutes`;
  if (mins === 60) return "Every 1 hour";
  if (mins % 60 === 0 && mins < 1440) return `Every ${mins / 60} hours`;
  if (mins === 1440) return "Every 24 hours";
  return `Every ${Math.round(mins / 1440)} days`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatusDot({ status }: { status: string | null | number }) {
  if (status === "running" || status === 1) return <Pulse color="green" size="sm" />;
  if (status === "failed")  return <Pulse color="red"   size="sm" animate={false} />;
  if (status === 0)         return <Pulse color="gray"  size="sm" animate={false} />;
  return <Pulse color="gray" size="sm" animate={false} />;
}

// ─── Agent Card (screenshot style) ───────────────────────────────────────────
function AgentCard({
  agent,
  lastRun,
  canTrigger,
  triggering,
  onSelect,
  onTrigger,
}: {
  agent: AgentDefinition;
  lastRun: AgentRun | undefined;
  canTrigger: boolean;
  triggering: string | null;
  onSelect: () => void;
  onTrigger: (e: React.MouseEvent) => void;
}) {
  const colorClass = TYPE_COLOR[agent.name] ?? "text-slate-400";
  const bgClass    = TYPE_BG[agent.name]    ?? "bg-slate-500/10 border-slate-500/25";
  const tools      = AGENT_TOOLS[agent.name] ?? [];
  const schedule   = formatSchedule(agent.schedule_mins ?? null);
  const isRunning  = triggering === agent.id;

  return (
    <div
      onClick={onSelect}
      className={`soc-card flex items-start gap-4 cursor-pointer hover:border-soc-border-bright transition-all group ${!agent.is_active ? "opacity-60" : ""}`}
    >
      {/* Status checkbox */}
      <div className="mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded border border-soc-border bg-soc-bg/50">
        {agent.is_active
          ? <div className="w-3 h-3 rounded-sm bg-status-live" />
          : <div className="w-3 h-3 rounded-sm bg-slate-600" />}
      </div>

      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${bgClass}`}>
        <span className={colorClass}>{AGENT_ICON[agent.name] ?? <Activity size={16} />}</span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Name + schedule */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-slate-100 text-sm">{agent.codename}</span>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${colorClass} bg-current/5 border-current/20 opacity-70`}>
            {agent.name}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
            agent.schedule_mins === null
              ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
              : "bg-gold/10 border-gold/30 text-gold"
          }`}>
            {schedule}
          </span>
          {agent.name === "ARBITER" && (
            <span className="text-[9px] font-bold bg-threat-critical/10 text-threat-critical border border-threat-critical/30 px-1.5 py-0.5 rounded-full">
              HITL
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 leading-relaxed mb-2">{agent.description}</p>

        {/* Tech stack + last run */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-wrap gap-1">
            {tools.map((t) => (
              <span key={t} className="text-[9px] bg-soc-bg border border-soc-border text-slate-500 px-1.5 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-600 shrink-0">
            {agent.last_run_at && (
              <span>Last run {timeAgo(agent.last_run_at)}</span>
            )}
            {(agent.threats_found_today ?? 0) > 0 && (
              <span className="text-threat-critical font-bold">· {agent.threats_found_today} flagged</span>
            )}
            {(agent.runs_today ?? 0) > 0 && (
              <span>· {agent.runs_today} processed</span>
            )}
          </div>
        </div>
      </div>

      {/* Trigger button */}
      <div className="shrink-0 flex items-center" onClick={(e) => { e.stopPropagation(); if (canTrigger && agent.is_active && !isRunning) onTrigger(e); }}>
        {isRunning ? (
          <div className="w-7 h-7 border border-gold border-t-transparent rounded-full animate-spin" />
        ) : (
          <button
            disabled={!canTrigger || !agent.is_active || triggering !== null}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-soc-border
                       hover:border-gold/50 hover:text-gold text-slate-500 transition-all
                       disabled:opacity-30 disabled:cursor-not-allowed"
            title={`Run ${agent.codename}`}
          >
            <Play size={12} className="ml-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Agent Detail ─────────────────────────────────────────────────────────────
function AgentDetail({
  agent, recentRuns, canTrigger, onBack, onTrigger,
}: {
  agent: AgentDefinition;
  recentRuns: AgentRun[];
  canTrigger: boolean;
  onBack: () => void;
  onTrigger: (agentId: string) => Promise<void>;
}) {
  const [triggering, setTriggering] = useState(false);
  const colorClass = TYPE_COLOR[agent.name] ?? "text-slate-400";
  const bgClass    = TYPE_BG[agent.name]    ?? "bg-slate-500/10 border-slate-500/25";
  const tools      = AGENT_TOOLS[agent.name] ?? [];

  async function handleTrigger() {
    setTriggering(true);
    try { await onTrigger(agent.id); } finally { setTriggering(false); }
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5">
          <ChevronLeft size={14} /> Back
        </button>
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${bgClass}`}>
          <span className={colorClass}>{AGENT_ICON[agent.name] ?? <Activity size={16} />}</span>
        </div>
        <h1 className="text-xl font-bold text-slate-100">{agent.codename}</h1>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
          agent.schedule_mins === null
            ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
            : "bg-gold/10 border-gold/30 text-gold"
        }`}>
          {formatSchedule(agent.schedule_mins ?? null)}
        </span>
        <StatusDot status={agent.is_active} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="soc-card text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Runs Today</div>
          <div className="text-3xl font-bold font-mono text-purple-light">{agent.runs_today ?? 0}</div>
        </div>
        <div className="soc-card text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Threats Found</div>
          <div className="text-3xl font-bold font-mono text-gold">{agent.threats_found_today ?? 0}</div>
        </div>
        <div className="soc-card text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Schedule</div>
          <div className="text-sm font-bold font-mono text-slate-200">{formatSchedule(agent.schedule_mins ?? null)}</div>
        </div>
        <div className="soc-card text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Last Run</div>
          <div className="text-sm font-mono text-slate-300">{timeAgo(agent.last_run_at)}</div>
        </div>
      </div>

      <div className="soc-card space-y-3">
        <div className="text-[10px] font-bold text-slate-500 tracking-widest">AGENT DESCRIPTION</div>
        <p className="text-sm text-slate-300 leading-relaxed">{agent.description}</p>
        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tools.map((t) => (
              <span key={t} className="text-[10px] bg-soc-bg border border-soc-border text-slate-400 px-2 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {agent.name === "ARBITER" && (
        <div className="soc-card border-threat-critical/30 bg-threat-critical/5 flex gap-3">
          <Lock size={20} className="text-threat-critical shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-threat-critical mb-1">HUMAN-IN-THE-LOOP — PERMANENTLY ENFORCED</div>
            <div className="text-xs text-slate-400 leading-relaxed">
              ARBITER cannot submit any takedown request without explicit authorisation from a credentialled SOC Analyst.
              All pending requests queue in the Takedown Queue module. This restriction cannot be overridden by any agent,
              process, or API call. Every action is audit-logged and attributed to the authorising analyst.
            </div>
          </div>
        </div>
      )}

      {canTrigger && (
        <button onClick={handleTrigger} disabled={triggering || !agent.is_active} className="btn-gold flex items-center gap-2">
          <Play size={13} />
          {triggering ? "Triggering…" : `Run ${agent.codename} Now`}
        </button>
      )}

      {recentRuns.length > 0 && (
        <div className="soc-card">
          <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">RECENT RUNS</div>
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-3 text-xs py-2 border-b border-soc-border last:border-0">
                <StatusDot status={run.status} />
                <span className="text-slate-400 font-mono flex-1">{timeAgo(run.started_at)}</span>
                <span className="text-slate-300">{run.items_scanned} processed</span>
                <span className={run.threats_found > 0 ? "text-threat-critical font-semibold" : "text-slate-500"}>
                  {run.threats_found} flagged
                </span>
                <span className={`capitalize px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  run.status === "completed" ? "bg-status-live/10 text-status-live" :
                  run.status === "failed"    ? "bg-threat-critical/10 text-threat-critical" :
                  "bg-slate-700 text-slate-400"
                }`}>{run.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Recent Runs tab (global) ────────────────────────────────────────────────
function RecentRunsView({ runs, loading }: { runs: AgentRun[]; loading: boolean }) {
  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (runs.length === 0) return (
    <div className="text-center py-16 text-slate-500 text-sm">No recent runs recorded.</div>
  );

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const agentName = (run.agent_name ?? "") as AgentName;
        const colorClass = TYPE_COLOR[agentName] ?? "text-slate-400";
        const bgClass    = TYPE_BG[agentName]    ?? "bg-slate-500/10 border-slate-500/25";
        const icon       = AGENT_ICON[agentName] ?? <Activity size={15} />;

        return (
          <div key={run.id} className="soc-card flex items-start gap-3">
            {/* Agent icon */}
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${bgClass}`}>
              <span className={colorClass}>{icon}</span>
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-200 text-sm">{run.codename ?? run.agent_name ?? "Agent"}</span>
                {agentName && (
                  <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${colorClass} opacity-70`}>
                    {agentName}
                  </span>
                )}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ${
                  run.status === "completed" ? "bg-status-live/10 text-status-live border border-status-live/25" :
                  run.status === "failed"    ? "bg-threat-critical/10 text-threat-critical border border-threat-critical/25" :
                  run.status === "running"   ? "bg-gold/10 text-gold border border-gold/25" :
                  "bg-slate-700 text-slate-400 border border-soc-border"
                }`}>{run.status}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {timeAgo(run.started_at)}
                {run.items_scanned > 0  && <span className="ml-2">· {run.items_scanned} processed</span>}
                {run.threats_found > 0  && <span className="ml-2 text-threat-critical font-bold">· {run.threats_found} flagged</span>}
                {run.influencer_name    && <span className="ml-2">· {run.influencer_name}</span>}
              </div>
            </div>

            {/* Status dot */}
            <div className="shrink-0 mt-1">
              <StatusDot status={run.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main AgentsPanel ─────────────────────────────────────────────────────────
export default function AgentsPanel() {
  const { user, selectedInfluencer } = useOutletContext<Ctx>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agentList, setAgentList] = useState<AgentDefinition[]>([]);
  const [allRuns, setAllRuns] = useState<AgentRun[]>([]);
  const [runMap, setRunMap] = useState<Record<string, AgentRun[]>>({});
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const canTrigger = user.role === "soc" || user.role === "admin";

  // Derive tab + selected agent from URL — creates browser history entries so
  // mobile swipe-back navigates within the page rather than leaving it.
  const tab = (searchParams.get("tab") as PanelTab) ?? "intelligence";
  const selectedAgentId = searchParams.get("agent");
  const selected = selectedAgentId
    ? (agentList.find((a) => a.id === selectedAgentId) ?? null)
    : null;

  function setTab(id: PanelTab) {
    setSearchParams({ tab: id }, { replace: false });
  }
  function selectAgent(agent: AgentDefinition) {
    setSearchParams({ tab: "intelligence", agent: agent.id }, { replace: false });
  }
  function clearSelected() {
    setSearchParams({ tab: "intelligence" }, { replace: false });
  }

  async function load() {
    setLoading(true);
    try {
      const [agentsData, runsData] = await Promise.all([
        agents.list(),
        agents.runs({ limit: 50 }),
      ]);
      setAgentList(agentsData);
      setAllRuns(runsData);
      const map: Record<string, AgentRun[]> = {};
      for (const run of runsData) {
        if (!map[run.agent_id]) map[run.agent_id] = [];
        map[run.agent_id]!.push(run);
      }
      setRunMap(map);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleTrigger(agentId: string) {
    setTriggering(agentId);
    try {
      await agents.trigger(agentId, selectedInfluencer?.id);
      await load();
    } finally {
      setTriggering(null);
    }
  }

  // Group agents by category in defined order
  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, list: agentList.filter((a) => a.category === cat) }))
    .filter((g) => g.list.length > 0);

  const arbiterPending = agentList.some((a) => a.name === "ARBITER");

  // Detail view — rendered when ?agent=<id> is in URL
  if (selected) {
    return (
      <AgentDetail
        agent={selected}
        recentRuns={runMap[selected.id] ?? []}
        canTrigger={canTrigger}
        onBack={clearSelected}
        onTrigger={handleTrigger}
      />
    );
  }

  const TABS: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
    { id: "intelligence", label: "Intelligence",  icon: <Activity size={13} /> },
    { id: "sources",      label: "Data Sources",  icon: <Database size={13} /> },
    { id: "runs",         label: "Recent Runs",   icon: <Zap size={13} /> },
  ];

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Intelligence</h1>
          <p className="text-xs text-slate-500 mt-0.5">Agents · Data Sources · Recent Runs</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-icon" title="Refresh">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ARBITER HITL notice */}
      {arbiterPending && (
        <div className="soc-card border-threat-critical/30 bg-threat-critical/5 flex items-center gap-3">
          <Lock size={18} className="text-threat-critical shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-bold text-threat-critical">ARBITER — Standby · HITL Gate Active</div>
            <div className="text-xs text-slate-400 mt-0.5">No submission until SOC Analyst sign-off</div>
          </div>
          <span className="badge-critical">HITL ENFORCED</span>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-soc-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === t.id
                ? "text-gold border-gold"
                : "text-slate-500 border-transparent hover:text-slate-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Intelligence tab ── */}
      {tab === "intelligence" && (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ cat, list }) => {
              const meta = CATEGORY_META[cat];
              return (
                <div key={cat}>
                  {/* Category section header */}
                  <div className={`flex items-center gap-2 mb-3 ${meta?.color ?? "text-slate-400"}`}>
                    {meta?.icon}
                    <span className="text-[11px] font-bold uppercase tracking-widest">{meta?.label ?? cat}</span>
                    <span className="text-[10px] text-slate-600">({list.length})</span>
                  </div>
                  <div className="space-y-2.5">
                    {list.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        lastRun={runMap[agent.id]?.[0]}
                        canTrigger={canTrigger}
                        triggering={triggering}
                        onSelect={() => selectAgent(agent)}
                        onTrigger={(e) => { e.stopPropagation(); handleTrigger(agent.id); }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {agentList.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <div className="text-4xl mb-3">🤖</div>
                <div>No agents registered</div>
              </div>
            )}

            {/* PHANTOM — coming soon */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-slate-600">
                <Search size={13} />
                <span className="text-[11px] font-bold uppercase tracking-widest">DETECT</span>
              </div>
              <div className="soc-card flex items-start gap-4 opacity-50 cursor-not-allowed border-dashed">
                <div className="mt-0.5 w-5 h-5 flex items-center justify-center rounded border border-slate-700" />
                <div className="w-10 h-10 rounded-xl border border-slate-600 flex items-center justify-center shrink-0 bg-slate-700/20">
                  <Mic size={16} className="text-slate-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-400 text-sm">Voice Clone Detector</span>
                    <span className="text-[9px] bg-slate-700/40 text-slate-500 border border-slate-600 px-2 py-0.5 rounded-full font-mono">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">AI voice clone detection across audio &amp; video content</p>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Data Sources tab ── */}
      {tab === "sources" && <FeedsView />}

      {/* ── Recent Runs tab ── */}
      {tab === "runs" && <RecentRunsView runs={allRuns} loading={loading} />}
    </div>
  );
}
