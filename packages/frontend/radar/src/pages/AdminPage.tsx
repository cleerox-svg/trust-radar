import { useState, useEffect } from "react";
import { admin, type AdminUser, type AdminStats } from "../lib/api";

const PLANS = ["free", "pro", "enterprise"] as const;

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card space-y-1">
      <div className="text-xs text-radar-muted uppercase tracking-wider">{label}</div>
      <div className="font-mono font-bold text-2xl text-radar-cyan">{value}</div>
      {sub && <div className="text-xs text-radar-muted">{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([admin.stats(), admin.users()])
      .then(([s, u]) => {
        setStats(s);
        setUsers(u.users);
        setTotal(u.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function updateUser(id: string, data: { plan?: string; scans_limit?: number; is_admin?: boolean }) {
    setSaving(id);
    try {
      const updated = await admin.updateUser(id, data);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-radar-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Admin Panel</h1>
          <p className="text-xs text-radar-muted mt-0.5">Platform management · Trust Radar</p>
        </div>
        <span className="text-xs bg-radar-red/15 text-radar-red px-2 py-1 rounded-full font-mono border border-radar-red/30">
          ADMIN
        </span>
      </div>

      {error && (
        <div className="card border-radar-red/40 text-radar-red text-sm">{error}</div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats.users.total} sub={`${stats.users.pro} pro · ${stats.users.enterprise} enterprise`} />
          <StatCard label="Total Scans" value={stats.scans.total} />
          <StatCard label="High Risk Scans" value={stats.scans.high_risk} sub={`avg trust ${stats.scans.avg_trust}`} />
          <StatCard label="Open Alerts" value={stats.alerts.open} sub={`${stats.alerts.total} total`} />
        </div>
      )}

      {/* Users table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-radar-border flex items-center justify-between">
          <h2 className="font-semibold text-slate-200 text-sm">Users ({total})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-radar-border">
                {["Email", "Plan", "Scans", "Limit", "Admin", "Joined"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-radar-muted uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-radar-border last:border-0 hover:bg-radar-border/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-300 max-w-[200px] truncate">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="bg-radar-bg border border-radar-border text-xs text-slate-300 rounded px-2 py-1 focus:border-radar-cyan focus:outline-none"
                      value={u.plan}
                      disabled={saving === u.id}
                      onChange={(e) => updateUser(u.id, { plan: e.target.value })}
                    >
                      {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-radar-muted">{u.scans_used}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      className="bg-radar-bg border border-radar-border text-xs text-slate-300 rounded px-2 py-1 w-20 focus:border-radar-cyan focus:outline-none"
                      defaultValue={u.scans_limit}
                      min={0}
                      max={100000}
                      disabled={saving === u.id}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val !== u.scans_limit) updateUser(u.id, { scans_limit: val });
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => updateUser(u.id, { is_admin: !u.is_admin })}
                      disabled={saving === u.id}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        u.is_admin
                          ? "bg-radar-red/15 text-radar-red border-radar-red/30 hover:bg-radar-red/25"
                          : "bg-radar-border text-radar-muted border-radar-border hover:border-radar-cyan hover:text-radar-cyan"
                      }`}
                    >
                      {u.is_admin ? "admin" : "user"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-radar-muted font-mono">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
