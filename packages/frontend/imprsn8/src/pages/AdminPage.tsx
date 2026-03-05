import { useState, useEffect } from "react";
import { admin, type AdminUser, type AdminStats } from "../lib/api";

const PLANS = ["free", "pro", "enterprise"] as const;

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card space-y-1">
      <div className="text-xs text-brand-muted uppercase tracking-wider">{label}</div>
      <div className="font-bold text-2xl gradient-text">{value}</div>
      {sub && <div className="text-xs text-brand-muted">{sub}</div>}
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

  async function updateUser(id: string, data: { plan?: string; is_admin?: boolean }) {
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
        <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Admin Panel</h1>
          <p className="text-brand-muted text-sm mt-0.5">Platform management · imprsn8</p>
        </div>
        <span className="text-xs bg-red-500/15 text-red-400 px-3 py-1 rounded-full font-mono border border-red-500/30">
          ADMIN
        </span>
      </div>

      {error && (
        <div className="card border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats.users.total} sub={`${stats.users.pro} pro · ${stats.users.enterprise} enterprise`} />
          <StatCard label="Avg Score" value={stats.users.avg_impression_score} />
          <StatCard label="Total Analyses" value={stats.analyses.total} />
          <StatCard label="Avg Analysis Score" value={stats.analyses.avg_score} />
        </div>
      )}

      {/* Users table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border">
          <h2 className="font-semibold text-slate-200">Users ({total})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border">
                {["Email / Handle", "Plan", "Score", "Analyses", "Admin", "Joined"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-brand-muted uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-brand-border last:border-0 hover:bg-brand-border/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-slate-300 truncate max-w-[180px]">{u.email}</div>
                    {u.username && <div className="text-xs text-brand-muted">@{u.username}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="bg-brand-bg border border-brand-border text-xs text-slate-300 rounded px-2 py-1 focus:border-brand-purple focus:outline-none"
                      value={u.plan}
                      disabled={saving === u.id}
                      onChange={(e) => updateUser(u.id, { plan: e.target.value })}
                    >
                      {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 font-bold gradient-text">{u.impression_score}</td>
                  <td className="px-4 py-3 text-xs text-brand-muted">{u.total_analyses}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => updateUser(u.id, { is_admin: !u.is_admin })}
                      disabled={saving === u.id}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        u.is_admin
                          ? "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                          : "bg-brand-border text-brand-muted border-brand-border hover:border-brand-purple hover:text-brand-purple"
                      }`}
                    >
                      {u.is_admin ? "admin" : "user"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-muted font-mono">
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
