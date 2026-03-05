import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { RefreshCw, ExternalLink } from "lucide-react";
import { overview } from "../lib/api";
import { SeverityBadge } from "../components/ui/SeverityBadge";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { Pulse } from "../components/ui/Pulse";
import type { OverviewStats, InfluencerProfile, User } from "../lib/types";

interface Ctx {
  user: User;
  selectedInfluencer: InfluencerProfile | null;
  setThreatCount: (n: number) => void;
}

function AgentStatusDot({ status }: { status: string | null }) {
  if (status === "completed" || status === "running") return <Pulse color="green" size="sm" />;
  if (status === "failed") return <Pulse color="red" size="sm" animate={false} />;
  return <Pulse color="gray" size="sm" animate={false} />;
}

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Overview() {
  const { user, selectedInfluencer, setThreatCount } = useOutletContext<Ctx>();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await overview.stats(selectedInfluencer?.id);
      setStats(data);
      setThreatCount(data.active_threats);
      setLastScan(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedInfluencer]);

  const title = selectedInfluencer ? `${selectedInfluencer.display_name}` : "All Influencers";

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Overview — <span className="text-gold">{title}</span></h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            Last scan: {lastScan ? timeAgo(lastScan) : "—"}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost flex items-center gap-2">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="ACCOUNTS MONITORED"
          value={stats?.accounts_monitored ?? 0}
          sub={`across ${stats?.platforms_count ?? 0} platforms`}
          color="gold"
        />
        <MetricCard
          label="ACTIVE THREATS"
          value={stats?.active_threats ?? 0}
          sub={`${stats?.critical_threats ?? 0} critical`}
          color="red"
          pulse={stats?.active_threats ? "red" : undefined}
        />
        <MetricCard
          label="PENDING TAKEDOWNS"
          value={stats?.pending_takedowns ?? 0}
          sub={`${stats?.critical_takedowns ?? 0} urgent`}
          color="orange"
        />
        <MetricCard
          label="AGENT UPTIME"
          value={`${stats?.agents_active ?? 0} / ${stats?.agents_total ?? 6}`}
          sub="100% operational"
          color="green"
          isText
        />
      </div>

      {/* Recent threats */}
      <div className="soc-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Active Threats</h2>
          <a href="/threats" className="text-xs text-gold hover:text-gold-light flex items-center gap-1">
            View all <ExternalLink size={10} />
          </a>
        </div>

        {!stats?.recent_threats?.length ? (
          <div className="text-center py-8 text-slate-600 text-sm">No active threats — all clear</div>
        ) : (
          <div className="space-y-2">
            {stats.recent_threats.map((threat) => (
              <div key={threat.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg
                                               bg-soc-bg/50 border border-soc-border hover:border-soc-border-bright
                                               transition-all cursor-pointer">
                <PlatformIcon platform={threat.platform} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 font-mono truncate">@{threat.suspect_handle}</div>
                  {threat.influencer_name && (
                    <div className="text-[10px] text-slate-500">→ {threat.influencer_name}</div>
                  )}
                </div>
                <SeverityBadge severity={threat.severity} />
                {threat.similarity_score !== null && (
                  <div className="text-xs font-mono text-gold">Sim: {threat.similarity_score}%</div>
                )}
                <div className="text-[10px] text-slate-600 font-mono">{timeAgo(threat.detected_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent heartbeat */}
      <div className="soc-card">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Agent Heartbeat</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {(stats?.agent_heartbeat ?? []).map((agent) => (
            <div key={agent.id} className="bg-soc-bg rounded-lg p-3 border border-soc-border text-center">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <AgentStatusDot status={agent.last_run_status} />
                <span className="text-[10px] font-bold font-mono text-slate-300">{agent.name}</span>
              </div>
              <div className="text-[9px] text-slate-500 leading-tight">{agent.codename}</div>
              <div className="text-[9px] text-slate-600 mt-1 font-mono">{timeAgo(agent.last_run_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, sub, color, pulse, isText,
}: {
  label: string;
  value: number | string;
  sub: string;
  color: "gold" | "red" | "orange" | "green";
  pulse?: "red" | "green";
  isText?: boolean;
}) {
  const colorMap = {
    gold:   "text-gold",
    red:    "text-threat-critical",
    orange: "text-threat-high",
    green:  "text-status-live",
  };
  return (
    <div className="soc-card space-y-2">
      <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">{label}</div>
      <div className="flex items-center gap-2">
        {pulse && <Pulse color={pulse} size="sm" />}
        <div className={`${isText ? "text-2xl" : "text-4xl"} font-bold font-mono ${colorMap[color]}`}>
          {value}
        </div>
      </div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
