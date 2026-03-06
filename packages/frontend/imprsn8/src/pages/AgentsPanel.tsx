import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { RefreshCw, ChevronLeft, Play, Lock, Cpu, Database, Activity, AlertTriangle } from "lucide-react";
import { agents } from "../lib/api";
import { Pulse } from "../components/ui/Pulse";
import type { AgentDefinition, AgentRun, User, InfluencerProfile } from "../lib/types";

interface Ctx {
  user: User;
  selectedInfluencer: InfluencerProfile | null;
}

type AgentName = AgentDefinition["name"];

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

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  detect:  <Activity size={16} />,
  respond: <AlertTriangle size={16} />,
  monitor: <Cpu size={16} />,
  analyze: <Database size={16} />,
};

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
  if (status === "failed") return <Pulse color="red" size="sm" animate={false} />;
  if (status === 0) return <Pulse color="gray" size="sm" animate={false} />;
  return <Pulse color="gray" size="sm" animate={false} />;
}

function AgentDetail({
  agent,
  recentRuns,
  canTrigger,
  onBack,
  onTrigger,
  selectedInfluencer,
}: {
  agent: AgentDefinition;
  recentRuns: AgentRun[];
  canTrigger: boolean;
  onBack: () => void;
  onTrigger: (agentId: string) => Promise<void>;
  selectedInfluencer: InfluencerProfile | null;
}) {
  const [triggering, setTriggering] = useState(false);
  const colorClass = TYPE_COLOR[agent.name] ?? "text-slate-400";
  const bgClass = TYPE_BG[agent.name] ?? "bg-slate-500/10 border-slate-500/25";

  async function handleTrigger() {
    setTriggering(true);
    try {
      await onTrigger(agent.id);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5">
          <ChevronLeft size={14} /> Back
        </button>
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${bgClass}`}>
          <span className={colorClass}>{CATEGORY_ICON[agent.category]}</span>
        </div>
        <h1 className="text-xl font-bold text-slate-100">{agent.codename}</h1>
        <span className={`badge-submitted capitalize`}>{agent.name}</span>
        <StatusDot status={agent.is_active} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="soc-card text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Runs Today</div>
          <div className="text-3xl font-bold font-mono text-purple-light">{agent.runs_today}</div>
        </div>
        <div className="soc-card text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Threats Found</div>
          <div className="text-3xl font-bold font-mono text-gold">{agent.threats_found_today}</div>
        </div>
        <div className="soc-card text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Schedule</div>
          <div className="text-xl font-bold font-mono text-slate-200">{agent.schedule_mins ? `${agent.schedule_mins}m` : "—"}</div>
        </div>
        <div className="soc-card text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Last Run</div>
          <div className="text-sm font-mono text-slate-300">{timeAgo(agent.last_run_at)}</div>
        </div>
      </div>

      {/* Description */}
      <div className="soc-card">
        <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">AGENT DESCRIPTION</div>
        <p className="text-sm text-slate-300 leading-relaxed">{agent.description}</p>
      </div>

      {/* ARBITER HITL notice */}
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

      {/* Trigger */}
      {canTrigger && (
        <button
          onClick={handleTrigger}
          disabled={triggering || !agent.is_active}
          className="btn-gold flex items-center gap-2"
        >
          <Play size={13} />
          {triggering ? "Triggering…" : `Run ${agent.codename} Now`}
        </button>
      )}

      {/* Recent runs */}
      {recentRuns.length > 0 && (
        <div className="soc-card">
          <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">RECENT RUNS</div>
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-3 text-xs py-2 border-b border-soc-border last:border-0">
                <StatusDot status={run.status} />
                <span className="text-slate-400 font-mono flex-1">{timeAgo(run.started_at)}</span>
                <span className="text-slate-300">{run.items_scanned} scanned</span>
                <span className={run.threats_found > 0 ? "text-threat-critical font-semibold" : "text-slate-500"}>
                  {run.threats_found} found
                </span>
                <span className={`capitalize ${run.status === "completed" ? "text-status-live" : run.status === "failed" ? "text-threat-critical" : "text-slate-400"}`}>
                  {run.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentsPanel() {
  const { user, selectedInfluencer } = useOutletContext<Ctx>();
  const [agentList, setAgentList] = useState<AgentDefinition[]>([]);
  const [runMap, setRunMap] = useState<Record<string, AgentRun[]>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AgentDefinition | null>(null);
  const canTrigger = user.role === "soc" || user.role === "admin";

  async function load() {
    setLoading(true);
    try {
      const [agentsData, runsData] = await Promise.all([
        agents.list(),
        agents.runs({ limit: 30 }),
      ]);
      setAgentList(agentsData);
      const map: Record<string, AgentRun[]> = {};
      for (const run of runsData) {
        if (!map[run.agent_id]) map[run.agent_id] = [];
        map[run.agent_id].push(run);
      }
      setRunMap(map);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const [triggering, setTriggering] = useState<string | null>(null);

  async function handleTrigger(agentId: string) {
    setTriggering(agentId);
    try {
      await agents.trigger(agentId, selectedInfluencer?.id);
      // Refresh list after trigger to update last_run_at and stats
      await load();
    } finally {
      setTriggering(null);
    }
  }

  const arbiters = agentList.filter((a) => a.name === "ARBITER");
  const arbiterPending = arbiters.length;

  if (selected) {
    return (
      <AgentDetail
        agent={selected}
        recentRuns={runMap[selected.id] ?? []}
        canTrigger={canTrigger}
        onBack={() => setSelected(null)}
        onTrigger={handleTrigger}
        selectedInfluencer={selectedInfluencer}
      />
    );
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Agent Operations</h1>
          <p className="text-xs text-slate-500 mt-0.5">SENTINEL · RECON · VERITAS · NEXUS · ARBITER · WATCHDOG</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-icon">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ARBITER HITL notice */}
      {arbiterPending > 0 && (
        <div className="soc-card border-threat-critical/30 bg-threat-critical/5 flex items-center gap-3">
          <Lock size={18} className="text-threat-critical shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-bold text-threat-critical">ARBITER — Standby · HITL Gate Active</div>
            <div className="text-xs text-slate-400 mt-0.5">No submission until SOC Analyst sign-off</div>
          </div>
          <span className="badge-critical">HITL ENFORCED</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {agentList.map((agent) => {
            const colorClass = TYPE_COLOR[agent.name] ?? "text-slate-400";
            const bgClass = TYPE_BG[agent.name] ?? "bg-slate-500/10 border-slate-500/25";
            const lastRun = runMap[agent.id]?.[0];

            return (
              <div
                key={agent.id}
                onClick={() => setSelected(agent)}
                className="soc-card flex items-center gap-4 flex-wrap cursor-pointer hover:border-soc-border-bright transition-all"
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${bgClass}`}>
                  <span className={colorClass}>{CATEGORY_ICON[agent.category]}</span>
                </div>

                {/* Name + description */}
                <div className="min-w-[160px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-100">{agent.codename}</span>
                    <span className={`text-[10px] font-bold uppercase ${colorClass}`}>{agent.name}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {agent.id} · Last: {timeAgo(agent.last_run_at)}
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex-1 grid grid-cols-3 gap-4 text-center min-w-[180px]">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Runs</div>
                    <div className="text-base font-bold font-mono text-slate-200">{agent.runs_today}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Threats</div>
                    <div className={`text-base font-bold font-mono ${agent.threats_found_today > 0 ? "text-gold" : "text-slate-500"}`}>
                      {agent.threats_found_today}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Status</div>
                    <StatusDot status={lastRun?.status ?? null} />
                  </div>
                </div>

                {/* Status + trigger */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {triggering === agent.id ? (
                    <div className="flex items-center gap-1.5 text-xs text-gold font-mono">
                      <div className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" />
                      Running…
                    </div>
                  ) : (
                    <>
                      <StatusDot status={agent.is_active} />
                      <span className={`text-xs font-semibold ${agent.is_active ? "text-status-live" : "text-slate-500"}`}>
                        {agent.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                      {agent.name === "ARBITER" && <Lock size={12} className="text-threat-critical" />}
                      {canTrigger && agent.is_active && (
                        <button
                          onClick={() => handleTrigger(agent.id)}
                          disabled={triggering !== null}
                          className="btn-icon !p-1.5 ml-1"
                          title={`Run ${agent.codename}`}
                        >
                          <Play size={11} />
                        </button>
                      )}
                    </>
                  )}
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

          {/* PHANTOM — coming soon card (always shown) */}
          <div className="soc-card flex items-center gap-4 flex-wrap opacity-50 cursor-not-allowed border-dashed">
            <div className="w-11 h-11 rounded-xl border border-slate-600 flex items-center justify-center shrink-0 bg-slate-700/20">
              <Activity size={16} className="text-slate-500" />
            </div>
            <div className="min-w-[160px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-slate-400">Voice Clone Detector</span>
                <span className="text-[10px] font-bold uppercase text-slate-500">PHANTOM</span>
              </div>
              <div className="text-xs text-slate-600">
                AI voice clone detection across audio &amp; video content
              </div>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-slate-700/40 text-slate-400 border border-slate-600 px-2.5 py-1 rounded-full tracking-widest uppercase">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
