/**
 * Overview / Dashboard — spec §Screen 1: Dashboard
 *
 * Layout (1440px ref):
 *   [Score Hero Panel 320px] [Threat Timeline — remaining width]
 *   [Platform/stat grid — 4 columns]
 *   [Activity Feed 60%] [Agent Quick Status 40%]
 */

import React, { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { RefreshCw, ExternalLink, Bot, AlertTriangle, Flag, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { overview } from "../lib/api";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { ScoreRing } from "../components/ui/ScoreRing";
import { AgentIcon } from "../components/ui/AgentIcon";
import type { AgentName } from "../components/ui/AgentIcon";
import type { OverviewStats, InfluencerProfile, User, ActivityEvent, AgentDefinition } from "../lib/types";

interface Ctx {
  user: User;
  selectedInfluencer: InfluencerProfile | null;
  setThreatCount: (n: number) => void;
}

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Derive brand health score from threat/agent data */
function computeBrandHealth(stats: OverviewStats): number {
  let score = 100;
  score -= (stats.critical_threats ?? 0) * 12;
  score -= Math.min((stats.active_threats - (stats.critical_threats ?? 0)), 0) * 4;
  score -= (stats.pending_takedowns ?? 0) * 3;
  const agentRatio = stats.agents_total > 0 ? stats.agents_active / stats.agents_total : 0;
  score += Math.round(agentRatio * 5);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Score Hero Panel ─────────────────────────────────────────────────────────
function ScoreHeroPanel({ stats, loading }: { stats: OverviewStats | null; loading: boolean }) {
  const score = stats ? computeBrandHealth(stats) : 0;
  const protectionOk = (stats?.active_threats ?? 0) === 0;
  const lastBlocked = stats?.recent_activity?.find(
    (a) => a.kind === "threat_detected" || a.kind === "threat_updated"
  );

  return (
    <div
      className="card flex flex-col items-center justify-between p-8 min-h-[360px]"
      style={{ minWidth: 280 }}
    >
      {/* Score ring hero */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        {loading ? (
          <div className="w-[200px] h-[200px] rounded-full animate-pulse" style={{ background: "var(--surface-overlay)" }} />
        ) : (
          <ScoreRing
            score={score}
            size="hero-xl"
            label="Brand Health Score"
            showLabel
            showHealth
          />
        )}

        <div className="text-center">
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Protected by{" "}
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {stats?.agents_active ?? 0} active AI agents
            </span>
          </div>
        </div>
      </div>

      {/* Editorial status bar */}
      <div
        className="w-full rounded-lg px-4 py-3 mt-6"
        style={{
          background: protectionOk
            ? "rgba(22,163,74,0.08)"
            : "rgba(232,22,59,0.08)",
          border: `1px solid ${protectionOk ? "rgba(22,163,74,0.2)" : "rgba(232,22,59,0.2)"}`,
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="status-dot"
            style={{
              background: protectionOk ? "var(--green-400)" : "var(--red-400)",
              animation: protectionOk ? "statusPulse 2s ease-in-out infinite" : "none",
            }}
          />
          <span className="text-xs font-semibold" style={{ color: protectionOk ? "var(--green-400)" : "var(--red-400)" }}>
            {protectionOk ? "Your profile is currently protected." : `${stats?.active_threats} active threat${stats?.active_threats !== 1 ? "s" : ""} detected.`}
          </span>
        </div>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {protectionOk
            ? `Last threat blocked ${lastBlocked ? timeAgo(lastBlocked.timestamp) : "recently"}.`
            : `${stats?.critical_threats ?? 0} critical · SOC analysts investigating.`}
        </p>
      </div>
    </div>
  );
}

// ─── Threat Timeline ──────────────────────────────────────────────────────────
function ThreatTimeline({ activity }: { activity: ActivityEvent[] }) {
  // Build 7-day chart data from activity events
  const days: Record<string, number> = {};
  const now = Date.now();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    days[d.toLocaleDateString("en-US", { month: "short", day: "numeric" })] = 0;
  }
  activity
    .filter((a) => a.kind === "threat_detected")
    .forEach((a) => {
      const key = new Date(a.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (key in days) days[key]++;
    });
  const data = Object.entries(days).map(([date, threats]) => ({ date, threats }));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="card-elevated px-3 py-2 text-xs">
        <div style={{ color: "var(--text-tertiary)" }}>{label}</div>
        <div className="font-semibold" style={{ color: "var(--red-400)" }}>
          {payload[0].value} threat{payload[0].value !== 1 ? "s" : ""}
        </div>
      </div>
    );
  };

  return (
    <div className="card p-6 flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Threat Activity
        </h2>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>7-day view</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="threatGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#E8163B" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#E8163B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="threats"
            stroke="#E8163B"
            strokeWidth={1.5}
            fill="url(#threatGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Stat Cards Row ───────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, accentColor, trend,
}: {
  label: string;
  value: number | string;
  sub: string;
  accentColor: string;
  trend?: { dir: "up" | "down"; label: string };
}) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="text-11 uppercase tracking-widest font-semibold" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </div>
      <div className="flex items-end justify-between">
        <span
          className="tabular font-display font-bold leading-none"
          style={{ fontSize: 36, color: accentColor, fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </span>
        {trend && (
          <span
            className="flex items-center gap-0.5 text-xs font-medium mb-1"
            style={{ color: trend.dir === "up" ? "var(--red-400)" : "var(--green-400)" }}
          >
            {trend.dir === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend.label}
          </span>
        )}
      </div>
      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{sub}</div>
    </div>
  );
}

// ─── Agent Quick Status — Heartbeat Grid ─────────────────────────────────────
function AgentQuickStatus({ agents }: { agents: AgentDefinition[] }) {
  function agentDotClass(status: string | null) {
    if (status === "running") return "scanning";
    if (status === "completed") return "active";
    if (status === "failed") return "alert";
    return "idle";
  }

  const activeCount = agents.filter((a) => a.is_active).length;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            AI Agents
          </h2>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            <span style={{ color: "var(--green-400)" }}>{activeCount} active</span>
            {" "}· {agents.length} deployed
          </p>
        </div>
        <Link
          to="/agents"
          className="text-xs flex items-center gap-1 transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold-400)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
        >
          View all <ExternalLink size={10} />
        </Link>
      </div>
      {/* Heartbeat grid — 2 columns */}
      <div className="grid grid-cols-2 gap-2.5">
        {agents.slice(0, 6).map((agent, idx) => (
          <div
            key={agent.id}
            className="card-enter flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{
              "--card-index": idx,
              background: "var(--surface-overlay)",
              border: "1px solid var(--border-subtle)",
            } as React.CSSProperties}
          >
            <AgentIcon name={agent.name as AgentName} size={24} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold font-display truncate" style={{ color: "var(--text-primary)" }}>
                {agent.name}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`status-dot ${agentDotClass(agent.last_run_status)}`} style={{ width: 6, height: 6 }} />
                <span className="text-[9px] font-mono truncate" style={{ color: "var(--text-tertiary)" }}>
                  {agent.last_run_status ?? "idle"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const kindIcon: Record<ActivityEvent["kind"], React.ReactNode> = {
    agent_run:        <Bot size={11} />,
    threat_detected:  <AlertTriangle size={11} />,
    threat_updated:   <Activity size={11} />,
    takedown_created: <Flag size={11} />,
    takedown_updated: <Flag size={11} />,
  };
  const kindColor: Record<ActivityEvent["kind"], string> = {
    agent_run:        "var(--violet-400)",
    threat_detected:  "var(--red-400)",
    threat_updated:   "var(--threat-high)",
    takedown_created: "var(--gold-400)",
    takedown_updated: "var(--text-tertiary)",
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Activity Feed
        </h2>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{events.length} events · 24h</span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: "var(--text-tertiary)" }}>
          No activity in the last 24 hours.
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div
            className="absolute top-2 bottom-2"
            style={{ left: 7, width: 1, background: "var(--border-subtle)" }}
          />
          <div className="space-y-4 pl-6" aria-live="polite">
            {events.map((ev) => (
              <div key={`${ev.kind}-${ev.id}-${ev.timestamp}`} className="relative flex items-start gap-3 min-w-0">
                {/* Timeline dot */}
                <div
                  className="absolute flex items-center justify-center rounded-full"
                  style={{
                    left: -24,
                    top: 2,
                    width: 16,
                    height: 16,
                    background: kindColor[ev.kind],
                    color: "#fff",
                  }}
                >
                  {kindIcon[ev.kind]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {ev.title}
                    </span>
                    {ev.severity && ev.severity !== "none" && (
                      <span
                        className={`badge-${ev.severity === "critical" ? "critical" : ev.severity === "high" ? "high" : "medium"}`}
                      >
                        {ev.severity}
                      </span>
                    )}
                    <span className="text-[10px] font-mono ml-auto shrink-0" style={{ color: "var(--text-tertiary)" }}>
                      {timeAgo(ev.timestamp)}
                    </span>
                  </div>
                  {(ev.detail || ev.influencer_name) && (
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {ev.influencer_name && <span style={{ color: "var(--text-secondary)" }}>{ev.influencer_name} · </span>}
                      {ev.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Overview() {
  const { user, selectedInfluencer, setThreatCount } = useOutletContext<Ctx>();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await overview.stats(selectedInfluencer?.id);
      setStats(data);
      setThreatCount(data.active_threats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedInfluencer]);

  const title = selectedInfluencer ? selectedInfluencer.display_name : "All Influencers";

  return (
    <div className="p-6 max-w-content mx-auto" style={{ minHeight: "100%", background: "var(--surface-base)" }}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold" style={{ fontSize: 22, color: "var(--text-primary)" }}>
            Dashboard{" "}
            <span style={{ color: "var(--gold-400)" }}>{title}</span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {loading ? "Refreshing..." : `Updated just now · ${stats?.agents_active ?? 0} agents active`}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="btn-ghost flex items-center gap-2"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Row 1: Score Hero + Threat Timeline ─────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5 mb-5" style={{ alignItems: "stretch" }}>
        <ScoreHeroPanel stats={stats} loading={loading} />
        <div className="flex-1 flex flex-col gap-5 min-w-0">
          {stats && <ThreatTimeline activity={stats.recent_activity ?? []} />}

          {/* Inline threat list — top 3 recent */}
          {(stats?.recent_threats?.length ?? 0) > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Threats</h3>
                <Link
                  to="/threats"
                  className="text-xs flex items-center gap-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  View all <ExternalLink size={10} />
                </Link>
              </div>
              <div className="space-y-2">
                {stats!.recent_threats.slice(0, 3).map((threat) => (
                  <div
                    key={threat.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer"
                    style={{
                      background: "var(--surface-overlay)",
                      border: "1px solid var(--border-subtle)",
                      borderLeft: threat.severity === "critical" ? "3px solid var(--red-400)" : "1px solid var(--border-subtle)",
                    }}
                  >
                    <PlatformIcon platform={threat.platform} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>
                        @{threat.suspect_handle}
                      </div>
                      {threat.influencer_name && (
                        <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>→ {threat.influencer_name}</div>
                      )}
                    </div>
                    <span className={`badge-${threat.severity}`}>{threat.severity}</span>
                    <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                      {timeAgo(threat.detected_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Stat Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-5">
        <StatCard
          label="Accounts Monitored"
          value={stats?.accounts_monitored ?? 0}
          sub={`across ${stats?.platforms_count ?? 0} platforms`}
          accentColor="var(--gold-400)"
        />
        <StatCard
          label="Active Threats"
          value={stats?.active_threats ?? 0}
          sub={`${stats?.critical_threats ?? 0} critical`}
          accentColor="var(--red-400)"
          trend={stats?.active_threats ? { dir: "up", label: `${stats.critical_threats} critical` } : undefined}
        />
        <StatCard
          label="Pending Takedowns"
          value={stats?.pending_takedowns ?? 0}
          sub={`${stats?.critical_takedowns ?? 0} urgent`}
          accentColor="var(--threat-high)"
        />
        <StatCard
          label="Agents Active"
          value={`${stats?.agents_active ?? 0}/${stats?.agents_total ?? 9}`}
          sub="AI protection layer"
          accentColor="var(--green-400)"
        />
      </div>

      {/* ── Row 3: Activity Feed + Agent Quick Status ─────────────── */}
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="flex-1 min-w-0" style={{ flex: "3" }}>
          <ActivityFeed events={stats?.recent_activity ?? []} />
        </div>
        <div className="lg:min-w-[240px]" style={{ flex: "2" }}>
          <AgentQuickStatus agents={stats?.agent_heartbeat ?? []} />
        </div>
      </div>
    </div>
  );
}
