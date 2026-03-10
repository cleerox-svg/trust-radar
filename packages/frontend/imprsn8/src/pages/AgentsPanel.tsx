/**
 * Intelligence Tab — spec §Screen 2: Intelligence Tab
 *
 * Layout:
 *   Header: "Intelligence Command" + agent count + last coordination time
 *   4-col agent grid (desktop) with bespoke SVG icons + slide-in detail (480px)
 *   Network View: SVG force layout sub-panel
 */

import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { RefreshCw, X, Play, GitBranch, Clock, Zap, BarChart3, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import { agents as agentsApi, compliance as complianceApi } from "../lib/api";
import type { ComplianceAuditEntry } from "../lib/api";
import { AgentIcon, AGENT_COLORS, AGENT_DESCRIPTIONS } from "../components/ui/AgentIcon";
import type { AgentName } from "../components/ui/AgentIcon";
import { FeedsView } from "../components/FeedsView";
import type { AgentDefinition, AgentRun, User, InfluencerProfile } from "../lib/types";

interface Ctx { user: User; selectedInfluencer: InfluencerProfile | null; }
type PanelTab = "intelligence" | "sources" | "network" | "compliance";

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function agentDotClass(status: string | null) {
  if (status === "running") return "scanning";
  if (status === "completed") return "active";
  if (status === "failed") return "alert";
  return "idle";
}

const CATEGORY_ORDER = ["detect", "monitor", "respond", "analyze"];
const CATEGORY_LABELS: Record<string, string> = {
  detect: "DETECT", monitor: "MONITOR", respond: "RESPOND", analyze: "ANALYZE",
};

// ─── Agent Card ───────────────────────────────────────────────────────────────
function AgentCard({
  agent, runs, onClick, isSelected, style,
}: {
  agent: AgentDefinition;
  runs: AgentRun[];
  onClick: () => void;
  isSelected: boolean;
  style?: React.CSSProperties;
}) {
  const name = agent.name as AgentName;
  const color = AGENT_COLORS[name] ?? "#6B5F82";
  const desc = AGENT_DESCRIPTIONS[name] ?? agent.codename;
  const dotClass = agentDotClass(agent.last_run_status);
  const active = agent.is_active === 1;

  return (
    <button
      onClick={onClick}
      className="agent-card card p-5 text-left w-full"
      style={{
        ...style,
        borderColor: isSelected ? color : undefined,
        opacity: active ? 1 : 0.6,
        background: isSelected ? `${color}0A` : undefined,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top row: icon + status */}
      <div className="flex items-start justify-between mb-4">
        <AgentIcon name={name} size={44} />
        <div className="flex items-center gap-2">
          <span className={`status-dot ${dotClass}`} aria-label={active ? (agent.last_run_status ?? "idle") : "offline"} />
          <span className="text-11 uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
            {active ? (agent.last_run_status ?? "idle") : "offline"}
          </span>
        </div>
      </div>

      {/* Name + specialty */}
      <div className="mb-4">
        <h3 className="font-display font-bold text-base mb-0.5" style={{ color, letterSpacing: "-0.01em" }}>
          {agent.name}
        </h3>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{desc}</p>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", marginBottom: 12 }} />

      {/* Stats */}
      <div className="space-y-1 flex-1">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: "var(--text-tertiary)" }}>Threats today</span>
          <span className="font-mono font-semibold tabular" style={{ color: "var(--text-primary)" }}>
            {agent.threats_found_today}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: "var(--text-tertiary)" }}>Last action</span>
          <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
            {timeAgo(agent.last_run_at)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: "var(--text-tertiary)" }}>Runs today</span>
          <span className="font-mono tabular" style={{ color: "var(--text-secondary)" }}>{agent.runs_today}</span>
        </div>
      </div>

      <div className="mt-4 text-xs font-medium flex items-center gap-1" style={{ color }}>
        View Log <span aria-hidden>→</span>
      </div>
    </button>
  );
}

// ─── Agent Detail Panel ───────────────────────────────────────────────────────
function AgentDetailPanel({
  agent, runs, onClose, onTrigger,
}: {
  agent: AgentDefinition;
  runs: AgentRun[];
  onClose: () => void;
  onTrigger: (agentId: string) => Promise<void>;
}) {
  const name = agent.name as AgentName;
  const color = AGENT_COLORS[name] ?? "#6B5F82";
  const desc = AGENT_DESCRIPTIONS[name] ?? agent.codename;
  const [triggering, setTriggering] = useState(false);
  const agentRuns = runs.filter((r) => r.agent_id === agent.id).slice(0, 10);

  async function handleTrigger() {
    setTriggering(true);
    try { await onTrigger(agent.id); } finally { setTriggering(false); }
  }

  return (
    <div
      className="flex flex-col h-full slide-in-right"
      style={{ width: "min(480px, 100vw)", background: "var(--surface-raised)", borderLeft: "1px solid var(--border-subtle)", flexShrink: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-6 pb-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-4">
          <AgentIcon name={name} size={44} />
          <div>
            <h2 className="font-display font-bold text-lg" style={{ color }}>{agent.name}</h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{desc}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {[
          { label: "Threats Today", value: agent.threats_found_today, icon: <Zap size={12} /> },
          { label: "Runs Today", value: agent.runs_today, icon: <BarChart3 size={12} /> },
          { label: "Schedule", value: agent.schedule_mins ? `${agent.schedule_mins}m` : "On-demand", icon: <Clock size={12} /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1" style={{ color: "var(--text-tertiary)" }}>
              {icon}
              <span className="text-11 uppercase tracking-widest">{label}</span>
            </div>
            <div className="font-display font-bold text-lg tabular" style={{ color: "var(--text-primary)" }}>
              {String(value)}
            </div>
          </div>
        ))}
      </div>

      {/* Run now */}
      <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <button
          onClick={() => void handleTrigger()}
          disabled={triggering || agent.is_active !== 1}
          className="btn-violet flex items-center gap-2 w-full justify-center"
        >
          <Play size={13} className={triggering ? "animate-pulse" : ""} />
          {triggering ? "Running…" : "Run Now"}
        </button>
      </div>

      {/* Activity log */}
      <div className="flex-1 overflow-y-auto p-6">
        <h3 className="text-11 uppercase tracking-widest mb-4" style={{ color: "var(--text-tertiary)" }}>
          Activity Log
        </h3>
        {agentRuns.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No recent runs.</p>
        ) : (
          <div className="space-y-2">
            {agentRuns.map((run) => (
              <div
                key={run.id}
                className="px-3 py-2.5 rounded-lg font-mono text-xs"
                style={{ background: "var(--surface-overlay)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="font-semibold"
                    style={{
                      color:
                        run.status === "completed" ? "var(--green-400)" :
                        run.status === "running"   ? "var(--violet-400)" :
                        run.status === "failed"    ? "var(--red-400)" :
                        "var(--text-tertiary)",
                    }}
                  >
                    {run.status.toUpperCase()}
                  </span>
                  <span style={{ color: "var(--text-tertiary)" }}>{timeAgo(run.started_at)}</span>
                </div>
                <div className="flex gap-4 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  <span>Scanned: <span style={{ color: "var(--text-secondary)" }}>{run.items_scanned}</span></span>
                  <span style={{ color: run.threats_found > 0 ? "var(--red-400)" : "var(--text-secondary)" }}>
                    Threats: {run.threats_found}
                  </span>
                </div>
                {run.error_msg && (
                  <div className="mt-1 text-[10px]" style={{ color: "#FDA4AE" }}>{run.error_msg}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agent Network SVG ────────────────────────────────────────────────────────
function AgentNetworkView({ agents }: { agents: AgentDefinition[] }) {
  const cx = 300, cy = 240, r = 160;
  const activeAgents = agents.filter((a) => a.is_active);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Agent Network
        </h3>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <GitBranch size={12} />
          {activeAgents.length} active nodes
        </div>
      </div>
      <svg viewBox="0 0 600 480" className="w-full" style={{ maxHeight: 360 }} role="img" aria-label="Agent network diagram">
        {/* Connection lines */}
        {activeAgents.map((a, i) => {
          const angle = (2 * Math.PI * i) / activeAgents.length - Math.PI / 2;
          const ax = cx + r * Math.cos(angle);
          const ay = cy + r * Math.sin(angle);
          return activeAgents.map((b, j) => {
            if (j <= i) return null;
            const angleB = (2 * Math.PI * j) / activeAgents.length - Math.PI / 2;
            const bx = cx + r * Math.cos(angleB);
            const by = cy + r * Math.sin(angleB);
            return (
              <line key={`${a.id}-${b.id}`} x1={ax} y1={ay} x2={bx} y2={by}
                stroke="var(--border-subtle)" strokeWidth={0.5} />
            );
          });
        })}

        {/* Nodes */}
        {activeAgents.map((agent, i) => {
          const angle = (2 * Math.PI * i) / activeAgents.length - Math.PI / 2;
          const nx = cx + r * Math.cos(angle);
          const ny = cy + r * Math.sin(angle);
          const name = agent.name as AgentName;
          const color = AGENT_COLORS[name] ?? "#6B5F82";
          const isRunning = agent.last_run_status === "running";
          return (
            <g key={agent.id} transform={`translate(${nx},${ny})`}>
              {isRunning && (
                <circle r={28} fill="none" stroke={color} strokeWidth={1} opacity={0.3}>
                  <animate attributeName="r" values="22;36;22" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={22} fill={`${color}18`} stroke={color} strokeWidth={2} />
              <text textAnchor="middle" dy={34} style={{ fontSize: 9, fill: color, fontFamily: "Inter", fontWeight: 600 }}>
                {agent.name}
              </text>
            </g>
          );
        })}

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={24} fill="var(--surface-overlay)" stroke="var(--border-gold)" strokeWidth={1.5} />
        <text textAnchor="middle" x={cx} y={cy + 4}
          style={{ fontSize: 9, fill: "var(--gold-400)", fontFamily: "Syne", fontWeight: 700 }}>
          imprsn8
        </text>
      </svg>
    </div>
  );
}

// ─── Compliance Audit View ─────────────────────────────────────────────────────
function ComplianceView() {
  const [items, setItems] = useState<ComplianceAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await complianceApi.list(showResolved);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [showResolved]);

  async function handleResolve(id: string) {
    await complianceApi.resolve(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const AUDIT_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    stale_threat: { label: "Stale Threat", icon: <AlertTriangle size={14} />, color: "var(--red-400)" },
    stale_takedown: { label: "Stale Takedown", icon: <ShieldAlert size={14} />, color: "var(--gold-400)" },
    agent_overdue: { label: "Agent Overdue", icon: <Clock size={14} />, color: "var(--violet-400)" },
    hitl_gap: { label: "HITL Gap", icon: <ShieldAlert size={14} />, color: "var(--red-400)" },
  };

  return (
    <div className="space-y-4 flex-1 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            HITL Compliance Audit
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{
            background: items.length > 0 ? "var(--red-400)" + "18" : "var(--green-400)" + "18",
            color: items.length > 0 ? "var(--red-400)" : "var(--green-400)",
            border: `1px solid ${items.length > 0 ? "var(--red-400)" : "var(--green-400)"}30`,
          }}>
            {items.length} {showResolved ? "total" : "open"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="filter-pill"
            style={{
              background: showResolved ? "var(--surface-overlay)" : "",
              borderColor: showResolved ? "var(--border-strong)" : "",
              color: showResolved ? "var(--text-primary)" : "",
            }}
          >
            {showResolved ? "Show Open Only" : "Show Resolved"}
          </button>
          <button onClick={() => void load()} disabled={loading} className="btn-icon">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: "var(--green-400)" }} />
          <div className="font-display font-semibold" style={{ color: "var(--green-400)" }}>All Clear</div>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            WATCHDOG found no compliance gaps. All threats reviewed, takedowns processed, agents on schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const meta = AUDIT_TYPE_LABELS[item.audit_type] ?? { label: item.audit_type, icon: <AlertTriangle size={14} />, color: "var(--text-secondary)" };
            return (
              <div key={item.id} className="card p-4 flex items-start gap-3">
                <div className="shrink-0 mt-0.5" style={{ color: meta.color }}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{
                      background: item.severity === "critical" ? "var(--red-400)" + "18" : "var(--gold-400)" + "18",
                      color: item.severity === "critical" ? "var(--red-400)" : "var(--gold-400)",
                    }}>
                      {item.severity.toUpperCase()}
                    </span>
                    {item.resolved_at && (
                      <span className="text-[10px] font-mono" style={{ color: "var(--green-400)" }}>RESOLVED</span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {item.description}
                  </p>
                  <div className="text-[10px] font-mono mt-1" style={{ color: "var(--text-tertiary)" }}>
                    {timeAgo(item.created_at)}
                  </div>
                </div>
                {!item.resolved_at && (
                  <button
                    onClick={() => void handleResolve(item.id)}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-lg transition-colors"
                    style={{
                      color: "var(--green-400)",
                      border: "1px solid var(--green-400)" + "30",
                      background: "var(--green-400)" + "08",
                    }}
                  >
                    Resolve
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function AgentsPanel() {
  const { user, selectedInfluencer } = useOutletContext<Ctx>();
  const [agentList, setAgentList] = useState<AgentDefinition[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>("intelligence");
  const [lastCoord, setLastCoord] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [al, rl] = await Promise.all([
        agentsApi.list(),
        agentsApi.runs({ influencer_id: selectedInfluencer?.id, limit: 50 }),
      ]);
      setAgentList(al);
      setRuns(rl);
      setLastCoord(rl[0]?.started_at ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedInfluencer]);

  async function handleTrigger(agentId: string) {
    await agentsApi.trigger(agentId, selectedInfluencer?.id);
    await load();
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, AgentDefinition[]>>((acc, cat) => {
    acc[cat] = agentList.filter((a) => a.category === cat);
    return acc;
  }, {});

  const activeCount = agentList.filter((a) => a.is_active).length;

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--surface-base)" }}>
      {/* ── Main panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="font-display font-bold" style={{ fontSize: 28, color: "var(--text-primary)" }}>
              Intelligence Command
            </h1>
            <p className="text-14 mt-1" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold" style={{ color: "var(--green-400)" }}>{activeCount} agents active</span>
              {lastCoord && <> · Last coordination: {timeAgo(lastCoord)}</>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: "intelligence" as PanelTab, label: "Agents" },
              { id: "network" as PanelTab, label: "Network" },
              { id: "sources" as PanelTab, label: "Data Sources" },
              { id: "compliance" as PanelTab, label: "Compliance" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="filter-pill"
                style={{
                  background: activeTab === tab.id ? "var(--surface-overlay)" : "",
                  borderColor: activeTab === tab.id ? "var(--border-strong)" : "",
                  color: activeTab === tab.id ? "var(--text-primary)" : "",
                }}
              >
                {tab.label}
              </button>
            ))}
            <button onClick={() => void load()} disabled={loading} className="btn-icon">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Intelligence tab ─────────────────────────────────── */}
        {activeTab === "intelligence" && (
          <div className="flex-1 overflow-y-auto space-y-8">
            {CATEGORY_ORDER.map((cat) => {
              const catAgents = grouped[cat];
              if (!catAgents?.length) return null;
              return (
                <div key={cat}>
                  <div className="nav-section mb-3">{CATEGORY_LABELS[cat]}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {catAgents.map((agent, idx) => (
                      <div key={agent.id} className="card-enter" style={{ "--card-index": idx } as React.CSSProperties}>
                        <AgentCard
                          agent={agent}
                          runs={runs}
                          onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
                          isSelected={selectedAgent?.id === agent.id}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "network" && <AgentNetworkView agents={agentList} />}
        {activeTab === "sources" && <FeedsView />}
        {activeTab === "compliance" && <ComplianceView />}
      </div>

      {/* ── Detail slide-in ─────────────────────────────────────── */}
      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          runs={runs}
          onClose={() => setSelectedAgent(null)}
          onTrigger={handleTrigger}
        />
      )}
    </div>
  );
}
