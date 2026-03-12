import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, BarChart2, Activity, Database, Lock, Server, Inbox,
  HardDrive, RefreshCw, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";
import {
  admin, feeds, agents, dataExport, leads as leadsApi,
  type AdminUser, type AdminStats, type FeedSchedule, type FeedStatsData,
  type AgentStatsData, type AdminHealthData, type Lead,
} from "../lib/api";
import { Card, CardContent, Badge, Button } from "../components/ui";
import { StatusDot } from "../components/ui/StatusDot";

const PLANS = ["free", "pro", "enterprise"] as const;
type Tab = "users" | "feeds" | "agents" | "health" | "leads";

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent>
        <div className="text-xs text-[--text-tertiary]">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${color ?? "text-[--text-primary]"}`}>{value}</div>
        {sub && <div className="text-xs text-[--text-secondary] mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Platform Admin Switcher ──────────────────────────────────────────────────
function PlatformAdminLink() {
  return (
    <a
      href="https://imprsn8.com/admin"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border"
      style={{
        color: "#EAB308",
        borderColor: "rgba(234,179,8,0.3)",
        background: "rgba(234,179,8,0.06)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(234,179,8,0.12)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(234,179,8,0.06)")}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: "#EAB308" }}
      />
      imprsn8 Admin
      <ExternalLink size={10} style={{ opacity: 0.7 }} />
    </a>
  );
}

// ─── Health Tab ──────────────────────────────────────────────────────────────
function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold ${ok ? "text-green-400" : "text-red-400"}`}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {label}
    </div>
  );
}

function HealthRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-[--border-subtle] last:border-0">
      <span className="text-[11px] text-[--text-tertiary] uppercase tracking-wider shrink-0">{label}</span>
      <span className={`text-xs text-right ${mono ? "font-mono text-[--text-primary]" : "text-[--text-secondary]"}`}>{value}</span>
    </div>
  );
}

function HealthTab({ feedStats }: { feedStats?: FeedStatsData }) {
  const [data, setData] = useState<AdminHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await admin.health();
      setData(result);
      setCheckedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Health check failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <Card>
      <CardContent className="flex items-center gap-2 text-red-400">
        <XCircle size={14} />
        {error}
      </CardContent>
    </Card>
  );

  if (!data) return null;

  const dbOk = data.database.status === "ok";
  const kvOk = data.kv_cache.status === "ok";

  return (
    <div className="space-y-5">
      {/* Overall status */}
      <Card className={data.status === "healthy" ? "border-green-500/30" : "border-amber-500/30"}>
        <CardContent className="flex items-center gap-4 flex-wrap">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ background: data.status === "healthy" ? "#22C55E" : "#F59E0B" }}
          />
          <div>
            <div
              className="font-bold text-sm uppercase tracking-widest"
              style={{ color: data.status === "healthy" ? "#22C55E" : "#F59E0B" }}
            >
              {data.status === "healthy" ? "All Systems Operational" : "Degraded — Check Below"}
            </div>
            <div className="text-[10px] text-[--text-tertiary] mt-0.5 font-mono">
              Env: {data.environment} · Checked {checkedAt?.toLocaleTimeString() ?? "—"}
            </div>
          </div>
          <div className="ml-auto flex gap-4">
            <StatusBadge ok={dbOk} label="Database" />
            <StatusBadge ok={kvOk} label="KV Cache" />
          </div>
          <button onClick={load} disabled={loading} className="p-1.5 rounded text-[--text-tertiary] hover:text-[--text-primary] transition-colors border border-[--border-subtle]">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Database */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Database size={14} className="text-cyan-400" />
              <span className="font-semibold text-[--text-primary] text-sm">Database (Cloudflare D1)</span>
              <StatusBadge ok={dbOk} label={dbOk ? "OK" : "Error"} />
            </div>
            <HealthRow label="Response time" value={`${data.database.response_ms} ms`} mono />
            <HealthRow label="SQLite version" value={data.database.sqlite_version} mono />
            <HealthRow label="Journal mode" value={data.database.journal_mode} mono />
            <HealthRow label="Last migration" value={data.database.last_migration} mono />
            <HealthRow
              label="Encryption at rest"
              value={
                <span className="flex items-center gap-1.5">
                  <Lock size={10} className="text-green-400 shrink-0" />
                  {data.database.encryption_at_rest}
                </span>
              }
            />
            <HealthRow
              label="Encryption in transit"
              value={
                <span className="flex items-center gap-1.5">
                  <Lock size={10} className="text-green-400 shrink-0" />
                  {data.database.encryption_in_transit}
                </span>
              }
            />
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Lock size={14} className="text-cyan-400" />
              <span className="font-semibold text-[--text-primary] text-sm">Compliance &amp; Controls</span>
            </div>
            <HealthRow label="Data residency" value={data.compliance.data_residency} />
            <HealthRow label="Audit logging" value={data.compliance.audit_logging} />
            <HealthRow label="HITL enforcement" value={data.compliance.hitl_enforced} />
            <HealthRow label="KV Cache" value={<StatusBadge ok={kvOk} label={data.kv_cache.status} />} />
            {feedStats && (
              <HealthRow
                label="Active feeds"
                value={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[--text-primary]">{feedStats.summary.enabled_feeds}</span>
                    <span className="text-[--text-tertiary]">/ {feedStats.summary.total_feeds}</span>
                    {feedStats.summary.circuit_open > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-mono">
                        {feedStats.summary.circuit_open} open circuits
                      </span>
                    )}
                  </span>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Table row counts */}
        <Card className="md:col-span-2">
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Server size={14} className="text-cyan-400" />
              <span className="font-semibold text-[--text-primary] text-sm">Table Row Counts</span>
              <span className="text-[10px] text-[--text-tertiary]">Live counts — admin only</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {data.database.tables.map((t) => (
                <div key={t.name} className="rounded p-2.5 text-center border border-[--border-subtle]" style={{ background: "var(--surface-base)" }}>
                  <div className={`text-base font-bold font-mono ${t.rows < 0 ? "text-[--text-tertiary]" : "text-[--text-primary]"}`}>
                    {t.rows < 0 ? "—" : t.rows.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-[--text-tertiary] mt-0.5 font-mono truncate">{t.name}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card className="md:col-span-2">
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <HardDrive size={14} className="text-cyan-400" />
              <span className="font-semibold text-[--text-primary] text-sm">Data Export</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => dataExport.scans()}>
                Export Scans (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={() => dataExport.signals()}>
                Export Signals (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={() => dataExport.alerts()}>
                Export Alerts (CSV)
              </Button>
            </div>
            <p className="text-[11px] text-[--text-tertiary] mt-3">
              Cloudflare D1 databases are replicated globally with point-in-time restore.
              Encryption keys are managed by Cloudflare's platform — no customer key management required.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Root AdminPage ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) ?? "users";
  function setTab(t: Tab) { setSearchParams({ tab: t }, { replace: false }); }

  const qc = useQueryClient();
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: admin.stats });
  const { data: usersData, isLoading: usersLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => admin.users(50) });
  const { data: feedList } = useQuery({ queryKey: ["admin-feeds"], queryFn: feeds.list, enabled: tab === "feeds" });
  const { data: feedStats } = useQuery({ queryKey: ["admin-feed-stats"], queryFn: feeds.stats, enabled: tab === "feeds" || tab === "health" });
  const { data: agentList } = useQuery({ queryKey: ["admin-agents"], queryFn: agents.list, enabled: tab === "agents" });
  const { data: agentStats } = useQuery({ queryKey: ["admin-agent-stats"], queryFn: agents.stats, enabled: tab === "agents" });
  const { data: leadsData, isLoading: leadsLoading } = useQuery({ queryKey: ["admin-leads"], queryFn: () => leadsApi.list(), enabled: tab === "leads" });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { plan?: string; scans_limit?: number; is_admin?: boolean } }) =>
      admin.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const toggleFeed = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => feeds.update(id, { enabled }),
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

  const updateLead = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; notes?: string } }) => leadsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-leads"] }),
  });

  const users = usersData?.users ?? [];
  const totalUsers = usersData?.total ?? 0;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "users",  label: "Users",        icon: <Users size={14} /> },
    { key: "feeds",  label: "Intel Feeds",  icon: <BarChart2 size={14} /> },
    { key: "agents", label: "Agents",       icon: <Activity size={14} /> },
    { key: "health", label: "System Health",icon: <Server size={14} /> },
    { key: "leads", label: "Leads", icon: <Inbox size={14} /> },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Admin Console</h1>
          <p className="text-sm text-[--text-secondary]">Platform management · Trust Radar</p>
        </div>
        <div className="flex items-center gap-3">
          <PlatformAdminLink />
          <Badge variant="critical">ADMIN</Badge>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats.users.total}
            sub={`${stats.users.pro} pro · ${stats.users.enterprise} ent`}
            color="text-cyan-400"
          />
          <StatCard label="Total Scans" value={stats.scans.total} />
          <StatCard
            label="High Risk"
            value={stats.scans.high_risk}
            sub={`avg trust ${stats.scans.avg_trust}`}
            color="text-threat-high"
          />
          <StatCard
            label="Open Alerts"
            value={stats.alerts.open}
            sub={`${stats.alerts.total} total`}
            color={stats.alerts.open > 0 ? "text-threat-critical" : "text-green-400"}
          />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[--border-subtle]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-all border-b-2 -mb-px ${
              tab === t.key
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-[--text-tertiary] hover:text-[--text-secondary]"
            }`}
          >
            {t.icon}
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
                    {users.map((u: AdminUser) => (
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
                              if (!isNaN(val) && val !== u.scans_limit)
                                updateUser.mutate({ id: u.id, data: { scans_limit: val } });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => updateUser.mutate({ id: u.id, data: { is_admin: !u.is_admin } })}
                            disabled={updateUser.isPending}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                              u.is_admin
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-[--surface-base] text-[--text-tertiary] border-[--border-subtle]"
                            }`}
                          >
                            {u.is_admin ? "admin" : "user"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-[--text-tertiary] font-mono">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
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
                { label: "Total Feeds",    value: feedStats.summary.total_feeds },
                { label: "Enabled",        value: feedStats.summary.enabled_feeds, color: "text-green-400" },
                { label: "Circuit Open",   value: feedStats.summary.circuit_open, color: feedStats.summary.circuit_open > 0 ? "text-threat-critical" : "text-green-400" },
                { label: "Total Runs",     value: feedStats.summary.total_runs },
                { label: "Items Ingested", value: feedStats.summary.total_items, color: "text-cyan-400" },
              ].map((c) => <StatCard key={c.label} {...c} />)}
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
                    {(feedList ?? []).map((f: FeedSchedule) => (
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
                                f.enabled
                                  ? "text-red-400 border-red-500/30 hover:bg-red-500/10"
                                  : "text-green-400 border-green-500/30 hover:bg-green-500/10"
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
                { label: "Total Runs",       value: (agentStats as AgentStatsData).summary.total_runs },
                { label: "Successes",        value: (agentStats as AgentStatsData).summary.successes,  color: "text-green-400" },
                { label: "Failures",         value: (agentStats as AgentStatsData).summary.failures,   color: (agentStats as AgentStatsData).summary.failures > 0 ? "text-threat-critical" : "text-green-400" },
                { label: "Awaiting Approval",value: (agentStats as AgentStatsData).summary.awaiting_approval, color: (agentStats as AgentStatsData).summary.awaiting_approval > 0 ? "text-amber-400" : undefined },
                { label: "Items Processed",  value: (agentStats as AgentStatsData).summary.total_processed, color: "text-cyan-400" },
              ].map((c) => <StatCard key={c.label} {...c} />)}
            </div>
          )}
          <Card>
            <CardContent className="!p-0">
              <div className="px-4 py-3 border-b border-[--border-subtle]">
                <h2 className="text-sm font-semibold text-[--text-primary]">Agent Registry</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {(agentList ?? []).map((a) => (
                  <div
                    key={a.name}
                    className="p-4 rounded-lg border border-[--border-subtle] hover:border-[--border-default] transition-colors"
                    style={{ background: "var(--surface-base)" }}
                  >
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

      {/* System Health tab */}
      {tab === "health" && <HealthTab feedStats={feedStats} />}

      {/* Leads tab */}
      {tab === "leads" && (
        <div className="space-y-4">
          {leadsData?.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <StatCard label="Total Leads" value={leadsData.stats.total ?? 0} color="text-cyan-400" />
              <StatCard label="New" value={leadsData.stats.new_leads ?? 0} color="text-amber-400" />
              <StatCard label="Contacted" value={leadsData.stats.contacted ?? 0} />
              <StatCard label="Qualified" value={leadsData.stats.qualified ?? 0} color="text-cyan-400" />
              <StatCard label="Converted" value={leadsData.stats.converted ?? 0} color="text-green-400" />
            </div>
          )}
          <Card>
            <CardContent className="!p-0">
              <div className="px-4 py-3 border-b border-[--border-subtle] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[--text-primary]">
                  Leads ({leadsData?.leads?.length ?? 0})
                </h2>
              </div>
              {leadsLoading ? (
                <div className="text-sm text-[--text-tertiary] py-12 text-center">Loading leads...</div>
              ) : !leadsData?.leads?.length ? (
                <div className="text-sm text-[--text-tertiary] py-12 text-center">No leads yet. Leads appear when users submit the public brand scan form.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[--border-subtle]">
                        {["Name", "Email", "Domain", "Phone", "Company", "Status", "Date"].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs text-[--text-tertiary] font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leadsData.leads.map((lead: Lead) => (
                        <tr key={lead.id} className="border-b border-[--border-subtle] last:border-0 hover:bg-[--surface-raised] transition-colors">
                          <td className="px-4 py-3 text-[--text-primary] font-medium">{lead.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[--text-primary]">{lead.email}</td>
                          <td className="px-4 py-3 font-mono text-xs text-cyan-400">{lead.domain ?? "\u2014"}</td>
                          <td className="px-4 py-3 text-xs text-[--text-secondary]">{lead.phone ?? "\u2014"}</td>
                          <td className="px-4 py-3 text-xs text-[--text-secondary]">{lead.company ?? "\u2014"}</td>
                          <td className="px-4 py-3">
                            <select
                              className="text-xs px-2 py-1 rounded bg-[--surface-base] border border-[--border-subtle] text-[--text-primary]"
                              value={lead.status}
                              disabled={updateLead.isPending}
                              onChange={(e) => updateLead.mutate({ id: lead.id, data: { status: e.target.value } })}
                            >
                              {["new", "contacted", "qualified", "converted", "rejected"].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-xs text-[--text-tertiary]">{new Date(lead.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
