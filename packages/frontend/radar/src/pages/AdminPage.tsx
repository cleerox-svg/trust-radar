import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin, feeds, agents, dataExport, type AdminUser, type AdminStats, type FeedSchedule, type FeedStatsData, type AgentStatsData, type AgentDefinition } from "../lib/api";
import { Card, CardContent, Badge, Button } from "../components/ui";
import { StatusDot } from "../components/ui/StatusDot";

const PLANS = ["free", "pro", "enterprise"] as const;
type Tab = "users" | "feeds" | "agents" | "system";

export default function AdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("users");
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: admin.stats });
  const { data: usersData, isLoading: usersLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => admin.users(50) });
  const { data: feedList } = useQuery({ queryKey: ["admin-feeds"], queryFn: feeds.list, enabled: tab === "feeds" });
  const { data: feedStats } = useQuery({ queryKey: ["admin-feed-stats"], queryFn: feeds.stats, enabled: tab === "feeds" });
  const { data: agentList } = useQuery({ queryKey: ["admin-agents"], queryFn: agents.list, enabled: tab === "agents" });
  const { data: agentStats } = useQuery({ queryKey: ["admin-agent-stats"], queryFn: agents.stats, enabled: tab === "agents" });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { plan?: string; scans_limit?: number; is_admin?: boolean } }) =>
      admin.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const toggleFeed = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      feeds.update(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-feeds"] }),
  });

  const triggerFeed = useMutation({
    mutationFn: (id: string) => feeds.trigger(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-feeds"] }),
  });

  const triggerAllFeeds = useMutation({
    mutationFn: () => feeds.triggerAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-feeds"] }),
  });

  const triggerAgent = useMutation({
    mutationFn: (name: string) => agents.trigger(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-agents", "admin-agent-stats"] }),
  });

  const users = usersData?.users ?? [];
  const totalUsers = usersData?.total ?? 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: "users", label: "Users" },
    { key: "feeds", label: "Intel Feeds" },
    { key: "agents", label: "Agents" },
    { key: "system", label: "System" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Admin Panel</h1>
          <p className="text-sm text-[--text-secondary]">Platform management &amp; operations</p>
        </div>
        <Badge variant="critical">ADMIN</Badge>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: stats.users.total, sub: `${stats.users.pro} pro, ${stats.users.enterprise} ent`, color: "text-cyan-400" },
            { label: "Total Scans", value: stats.scans.total },
            { label: "High Risk", value: stats.scans.high_risk, sub: `avg trust ${stats.scans.avg_trust}`, color: "text-threat-high" },
            { label: "Open Alerts", value: stats.alerts.open, sub: `${stats.alerts.total} total`, color: stats.alerts.open > 0 ? "text-threat-critical" : "text-green-400" },
          ].map((c) => (
            <Card key={c.label}>
              <CardContent>
                <div className="text-xs text-[--text-tertiary]">{c.label}</div>
                <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
                {c.sub && <div className="text-xs text-[--text-secondary] mt-1">{c.sub}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[--border-subtle]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-[--text-tertiary] hover:text-[--text-secondary]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <Card>
          <CardContent className="!p-0">
            <div className="px-4 py-3 border-b border-[--border-subtle] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[--text-primary]">Users ({totalUsers})</h2>
              <Button size="sm" variant="outline" onClick={() => dataExport.scans()}>Export scans CSV</Button>
            </div>
            {usersLoading ? (
              <div className="text-sm text-[--text-tertiary] py-12 text-center">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[--border-subtle]">
                      {["Email", "Plan", "Scans", "Limit", "Admin", "Joined"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs text-[--text-tertiary] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-[--border-subtle] last:border-0 hover:bg-[--surface-raised] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-[--text-primary] max-w-[200px] truncate">{u.email}</td>
                        <td className="px-4 py-3">
                          <select
                            className="text-xs px-2 py-1 rounded bg-[--surface-base] border border-[--border-subtle] text-[--text-primary]"
                            value={u.plan}
                            disabled={updateUser.isPending}
                            onChange={(e) => updateUser.mutate({ id: u.id, data: { plan: e.target.value } })}
                          >
                            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[--text-tertiary]">{u.scans_used}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            className="text-xs px-2 py-1 rounded bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] w-20"
                            defaultValue={u.scans_limit}
                            min={0} max={100000}
                            disabled={updateUser.isPending}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val !== u.scans_limit) updateUser.mutate({ id: u.id, data: { scans_limit: val } });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => updateUser.mutate({ id: u.id, data: { is_admin: !u.is_admin } })}
                            disabled={updateUser.isPending}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                              u.is_admin ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-[--surface-base] text-[--text-tertiary] border-[--border-subtle]"
                            }`}
                          >
                            {u.is_admin ? "admin" : "user"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-[--text-tertiary] font-mono">{new Date(u.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Feeds tab */}
      {tab === "feeds" && (
        <>
          {feedStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: "Total Feeds", value: feedStats.summary.total_feeds },
                { label: "Enabled", value: feedStats.summary.enabled_feeds, color: "text-green-400" },
                { label: "Circuit Open", value: feedStats.summary.circuit_open, color: feedStats.summary.circuit_open > 0 ? "text-threat-critical" : "text-green-400" },
                { label: "Total Runs", value: feedStats.summary.total_runs },
                { label: "Items Ingested", value: feedStats.summary.total_items, color: "text-cyan-400" },
              ].map((c) => (
                <Card key={c.label}>
                  <CardContent>
                    <div className="text-xs text-[--text-tertiary]">{c.label}</div>
                    <div className={`text-xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="!p-0">
              <div className="px-4 py-3 border-b border-[--border-subtle] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[--text-primary]">Feed Schedules</h2>
                <Button size="sm" onClick={() => triggerAllFeeds.mutate()} disabled={triggerAllFeeds.isPending}>
                  {triggerAllFeeds.isPending ? "Running..." : "Trigger All Feeds"}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[--border-subtle]">
                      {["Feed", "Tier", "Interval", "Status", "Last Run", "Items", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs text-[--text-tertiary] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(feedList ?? []).map((f) => (
                      <tr key={f.id} className="border-b border-[--border-subtle] last:border-0 hover:bg-[--surface-raised] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium text-[--text-primary]">{f.display_name}</div>
                          <div className="text-[10px] font-mono text-[--text-tertiary]">{f.feed_name}</div>
                        </td>
                        <td className="px-4 py-3"><Badge variant={f.tier <= 2 ? "critical" : f.tier <= 4 ? "medium" : "low"}>T{f.tier}</Badge></td>
                        <td className="px-4 py-3 text-xs text-[--text-tertiary] font-mono">{f.interval_mins}m</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <StatusDot variant={f.circuit_open ? "alert" : f.enabled ? "active" : "idle"} />
                            <span className="text-xs text-[--text-secondary]">
                              {f.circuit_open ? "Circuit Open" : f.enabled ? "Active" : "Disabled"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[--text-tertiary] font-mono">
                          {f.last_run_at ? new Date(f.last_run_at).toLocaleString() : "Never"}
                        </td>
                        <td className="px-4 py-3 text-xs text-[--text-primary] font-mono tabular-nums">{f.total_items}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleFeed.mutate({ id: f.id, enabled: !f.enabled })}
                              disabled={toggleFeed.isPending}
                              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                                f.enabled ? "text-red-400 border-red-500/30 hover:bg-red-500/10" : "text-green-400 border-green-500/30 hover:bg-green-500/10"
                              }`}
                            >
                              {f.enabled ? "Disable" : "Enable"}
                            </button>
                            <button
                              onClick={() => triggerFeed.mutate(f.id)}
                              disabled={triggerFeed.isPending}
                              className="text-[10px] px-2 py-1 rounded border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                            >
                              Run
                            </button>
                            {f.circuit_open === 1 && (
                              <button
                                onClick={() => feeds.resetCircuit(f.id).then(() => qc.invalidateQueries({ queryKey: ["admin-feeds"] }))}
                                className="text-[10px] px-2 py-1 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Agents tab */}
      {tab === "agents" && (
        <>
          {agentStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: "Total Runs", value: agentStats.summary.total_runs },
                { label: "Successes", value: agentStats.summary.successes, color: "text-green-400" },
                { label: "Failures", value: agentStats.summary.failures, color: agentStats.summary.failures > 0 ? "text-threat-critical" : "text-green-400" },
                { label: "Awaiting Approval", value: agentStats.summary.awaiting_approval, color: agentStats.summary.awaiting_approval > 0 ? "text-amber-400" : "text-[--text-primary]" },
                { label: "Items Processed", value: agentStats.summary.total_processed, color: "text-cyan-400" },
              ].map((c) => (
                <Card key={c.label}>
                  <CardContent>
                    <div className="text-xs text-[--text-tertiary]">{c.label}</div>
                    <div className={`text-xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="!p-0">
              <div className="px-4 py-3 border-b border-[--border-subtle]">
                <h2 className="text-sm font-semibold text-[--text-primary]">Agent Registry</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {(agentList ?? []).map((a) => (
                  <div key={a.name} className="p-4 rounded-lg border border-[--border-subtle] hover:border-[--border-default] transition-colors" style={{ background: "var(--surface-base)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.color }} />
                      <span className="text-sm font-semibold text-[--text-primary]">{a.displayName}</span>
                      {a.requiresApproval && <Badge variant="medium">HITL</Badge>}
                    </div>
                    <p className="text-xs text-[--text-secondary] mb-3">{a.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-mono text-[--text-tertiary]">
                        {a.runsToday} runs today · {a.trigger}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => triggerAgent.mutate(a.name)}
                        disabled={triggerAgent.isPending}
                      >
                        Run
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* System tab */}
      {tab === "system" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Data Export</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => dataExport.scans()}>
                  Export Scan History (CSV)
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => dataExport.signals()}>
                  Export Signals (CSV)
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => dataExport.alerts()}>
                  Export Alerts (CSV)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Platform Info</h3>
              <div className="space-y-2 text-xs">
                {[
                  ["Platform", "Trust Radar v3.0"],
                  ["Backend", "Cloudflare Workers + D1"],
                  ["Feeds", `${feedStats?.summary.total_feeds ?? "—"} configured`],
                  ["Agents", "10 registered"],
                  ["Cron", "*/5 * * * * (every 5 min)"],
                  ["Auth", "JWT + bcrypt"],
                  ["Cache", "KV Namespace"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-1.5 border-b border-[--border-subtle] last:border-0">
                    <span className="text-[--text-tertiary]">{k}</span>
                    <span className="font-mono text-[--text-primary]">{v}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
