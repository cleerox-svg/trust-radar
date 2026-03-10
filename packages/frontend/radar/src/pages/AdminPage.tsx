import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin, type AdminUser, type AdminStats } from "../lib/api";
import { Card, CardContent, Badge, Button } from "../components/ui";

const PLANS = ["free", "pro", "enterprise"] as const;

export default function AdminPage() {
  const qc = useQueryClient();
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: admin.stats });
  const { data: usersData, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => admin.users(50) });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { plan?: string; scans_limit?: number; is_admin?: boolean } }) =>
      admin.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const users = usersData?.users ?? [];
  const total = usersData?.total ?? 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Admin Panel</h1>
          <p className="text-sm text-[--text-secondary]">Platform management</p>
        </div>
        <Badge variant="critical">ADMIN</Badge>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: stats.users.total, sub: `${stats.users.pro} pro, ${stats.users.enterprise} enterprise`, color: "text-cyan-400" },
            { label: "Total Scans", value: stats.scans.total },
            { label: "High Risk Scans", value: stats.scans.high_risk, sub: `avg trust ${stats.scans.avg_trust}`, color: "text-threat-high" },
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

      {/* Users table */}
      <Card>
        <CardContent className="!p-0">
          <div className="px-4 py-3 border-b border-[--border-subtle] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[--text-primary]">Users ({total})</h2>
          </div>
          {isLoading ? (
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
                          className="text-xs px-2 py-1 rounded bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] focus:border-cyan-500 focus:outline-none"
                          value={u.plan}
                          disabled={updateMut.isPending}
                          onChange={(e) => updateMut.mutate({ id: u.id, data: { plan: e.target.value } })}
                        >
                          {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[--text-tertiary]">{u.scans_used}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          className="text-xs px-2 py-1 rounded bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] w-20 focus:border-cyan-500 focus:outline-none"
                          defaultValue={u.scans_limit}
                          min={0}
                          max={100000}
                          disabled={updateMut.isPending}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val !== u.scans_limit) updateMut.mutate({ id: u.id, data: { scans_limit: val } });
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => updateMut.mutate({ id: u.id, data: { is_admin: !u.is_admin } })}
                          disabled={updateMut.isPending}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            u.is_admin
                              ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                              : "bg-[--surface-base] text-[--text-tertiary] border-[--border-subtle] hover:border-cyan-500 hover:text-cyan-400"
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
    </div>
  );
}
