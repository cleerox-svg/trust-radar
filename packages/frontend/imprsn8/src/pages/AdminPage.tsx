import { useState, useEffect } from "react";
import { Plus, Edit2, X, Check, UserCheck, Shield, Users, BarChart2, AlertTriangle, Flag } from "lucide-react";
import { admin, influencers as influencersApi, type AdminUser } from "../lib/api";
import type { AdminStats, InfluencerProfile } from "../lib/types";

const PLANS = ["free", "pro", "enterprise"] as const;
const ROLES = ["influencer", "staff", "soc", "admin"] as const;
const TIERS = ["starter", "pro", "enterprise"] as const;

type Tab = "influencers" | "users" | "breakdown";

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="soc-card space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="font-bold text-2xl text-gold font-mono">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

// ─── Generic select cell ──────────────────────────────────────────────────────
function SelectCell<T extends string>({
  value, options, onChange, disabled,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="bg-soc-bg border border-soc-border text-xs text-slate-300 rounded px-2 py-1
                 focus:border-gold/50 focus:outline-none disabled:opacity-40 capitalize"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab({ influencerList }: { influencerList: InfluencerProfile[] }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    admin.users().then((u) => {
      setUsers(u.users);
      setTotal(u.total);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function updateUser(id: string, data: Parameters<typeof admin.updateUser>[1]) {
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

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {error && <div className="soc-card border-red-500/30 text-red-400 text-sm">{error}</div>}
      <div className="soc-card p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-soc-border flex items-center justify-between">
          <h2 className="font-semibold text-slate-200 text-sm">Users ({total})</h2>
          <span className="text-[10px] text-slate-500 font-mono">Edit plan, role, and influencer assignment inline</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-soc-border">
                {["Email / Handle", "Plan", "Role", "Assigned Influencer", "Score", "Admin", "Joined"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-soc-border last:border-0 hover:bg-soc-border/10 transition-colors">
                  <td className="px-4 py-3 max-w-[160px]">
                    <div className="font-mono text-xs text-slate-300 truncate">{u.email}</div>
                    {u.username && <div className="text-[10px] text-slate-500">@{u.username}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <SelectCell
                      value={u.plan as typeof PLANS[number]}
                      options={PLANS}
                      disabled={saving === u.id}
                      onChange={(plan) => updateUser(u.id, { plan })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <SelectCell
                      value={u.role as typeof ROLES[number]}
                      options={ROLES}
                      disabled={saving === u.id}
                      onChange={(role) => updateUser(u.id, { role })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {(u.role === "influencer" || u.role === "staff") ? (
                      <select
                        className="bg-soc-bg border border-soc-border text-xs text-slate-300 rounded px-2 py-1
                                   focus:border-gold/50 focus:outline-none disabled:opacity-40 max-w-[160px]"
                        value={u.assigned_influencer_id ?? ""}
                        disabled={saving === u.id}
                        onChange={(e) => updateUser(u.id, { assigned_influencer_id: e.target.value || null })}
                      >
                        <option value="">— none —</option>
                        {influencerList.map((inf) => (
                          <option key={inf.id} value={inf.id}>{inf.display_name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[10px] text-slate-600">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-gold font-mono text-xs">{u.impression_score}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => updateUser(u.id, { is_admin: !u.is_admin })}
                      disabled={saving === u.id}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                        u.is_admin
                          ? "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                          : "bg-soc-border/30 text-slate-500 border-soc-border hover:border-gold/30 hover:text-gold"
                      }`}
                    >
                      {u.is_admin ? "admin" : "user"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-slate-500 font-mono whitespace-nowrap">
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

// ─── Create Influencer Form ───────────────────────────────────────────────────
function CreateInfluencerForm({
  onCreated,
  onCancel,
}: {
  onCreated: (inf: InfluencerProfile) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ display_name: "", handle: "", avatar_url: "", tier: "starter" as typeof TIERS[number] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.display_name.trim() || !form.handle.trim()) return;
    setSaving(true);
    setError("");
    try {
      const inf = await influencersApi.create({
        display_name: form.display_name.trim(),
        handle: form.handle.trim().replace(/^@/, ""),
        avatar_url: form.avatar_url.trim() || undefined,
        tier: form.tier,
      });
      onCreated(inf);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create influencer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="soc-card border-gold/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">New Influencer Profile</h3>
        <button onClick={onCancel} className="btn-icon !p-1.5"><X size={14} /></button>
      </div>
      {error && <div className="text-red-400 text-xs mb-3 bg-red-950/30 border border-red-900/30 rounded px-3 py-2">{error}</div>}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Display Name *</label>
          <input className="soc-input" placeholder="Kyle Rez" value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} required />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Handle *</label>
          <input className="soc-input" placeholder="@kylerez" value={form.handle}
            onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} required />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Avatar URL</label>
          <input className="soc-input" placeholder="https://..." value={form.avatar_url}
            onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Tier</label>
          <select className="soc-select" value={form.tier}
            onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as typeof TIERS[number] }))}>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="col-span-2 flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving || !form.display_name.trim() || !form.handle.trim()} className="btn-gold flex items-center gap-2">
            <Check size={13} />
            {saving ? "Creating…" : "Create Influencer"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Influencer Row (inline edit) ─────────────────────────────────────────────
function InfluencerRow({
  inf,
  onUpdated,
}: {
  inf: InfluencerProfile;
  onUpdated: (updated: InfluencerProfile) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: inf.display_name, handle: inf.handle, tier: inf.tier, avatar_url: inf.avatar_url ?? "" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await influencersApi.update(inf.id, {
        display_name: form.display_name,
        handle: form.handle.replace(/^@/, ""),
        tier: form.tier as InfluencerProfile["tier"],
        avatar_url: form.avatar_url || undefined,
      });
      onUpdated(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    setSaving(true);
    try {
      const updated = await influencersApi.update(inf.id, { active: inf.active ? 0 : 1 } as Partial<InfluencerProfile>);
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  const tierColor: Record<string, string> = {
    starter:    "text-slate-400 border-slate-600",
    pro:        "text-purple-light border-purple/40",
    enterprise: "text-gold border-gold/40",
  };

  if (editing) {
    return (
      <tr className="border-b border-soc-border bg-gold/5">
        <td className="px-4 py-2">
          <input className="soc-input !py-1 !text-xs w-full" value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
        </td>
        <td className="px-4 py-2">
          <input className="soc-input !py-1 !text-xs w-full" value={form.handle}
            onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} />
        </td>
        <td className="px-4 py-2">
          <select className="soc-select !text-xs !py-1" value={form.tier}
            onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </td>
        <td className="px-4 py-2" colSpan={3}>
          <input className="soc-input !py-1 !text-xs w-full" placeholder="https://..." value={form.avatar_url}
            onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))} />
        </td>
        <td className="px-4 py-2">
          <div className="flex gap-1.5">
            <button onClick={handleSave} disabled={saving} className="btn-gold !px-2 !py-1 !text-xs flex items-center gap-1">
              <Check size={11} /> {saving ? "…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost !px-2 !py-1 !text-xs">
              <X size={11} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-b border-soc-border last:border-0 transition-colors ${inf.active ? "hover:bg-soc-border/10" : "opacity-50"}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {inf.avatar_url ? (
            <img src={inf.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-soc-border" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-purple/20 border border-purple/30 flex items-center justify-center text-[11px] font-bold text-purple-light">
              {inf.display_name[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-medium text-slate-200">{inf.display_name}</div>
            {!inf.active && <div className="text-[9px] text-red-500 font-mono tracking-widest">INACTIVE</div>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 font-mono">@{inf.handle}</td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${tierColor[inf.tier] ?? "text-slate-400 border-slate-600"}`}>
          {inf.tier}
        </span>
      </td>
      <td className="px-4 py-3 text-xs font-mono text-slate-300">{inf.monitored_count ?? 0}</td>
      <td className="px-4 py-3">
        {(inf.active_threats ?? 0) > 0
          ? <span className="text-threat-critical text-xs font-bold">{inf.active_threats}</span>
          : <span className="text-slate-600 text-xs">0</span>}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{new Date(inf.created_at).toLocaleDateString()}</td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          <button onClick={() => setEditing(true)} disabled={saving} className="btn-icon !p-1.5" title="Edit">
            <Edit2 size={11} />
          </button>
          <button
            onClick={toggleActive}
            disabled={saving}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
              inf.active
                ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                : "bg-status-live/10 text-status-live border-status-live/20 hover:bg-status-live/20"
            }`}
          >
            {inf.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Influencers Tab ──────────────────────────────────────────────────────────
function InfluencersTab() {
  const [list, setList] = useState<InfluencerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    influencersApi.list()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {error && <div className="soc-card border-red-500/30 text-red-400 text-sm">{error}</div>}

      {showCreate && (
        <CreateInfluencerForm
          onCreated={(inf) => { setList((prev) => [inf, ...prev]); setShowCreate(false); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="soc-card p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-soc-border flex items-center justify-between">
          <h2 className="font-semibold text-slate-200 text-sm">
            Influencer Profiles ({list.length})
            <span className="ml-2 text-[10px] text-status-live font-mono">{list.filter((i) => i.active).length} active</span>
          </h2>
          <button onClick={() => setShowCreate(true)} disabled={showCreate} className="btn-gold flex items-center gap-1.5 !py-1.5 !px-3 !text-xs">
            <Plus size={12} /> Add Influencer
          </button>
        </div>

        {list.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="text-slate-500 text-sm">No influencer profiles yet.</div>
            <button onClick={() => setShowCreate(true)} className="text-gold text-sm hover:underline">Add the first one →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-soc-border">
                  {["Influencer", "Handle", "Tier", "Accounts", "Threats", "Created", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((inf) => (
                  <InfluencerRow
                    key={inf.id}
                    inf={inf}
                    onUpdated={(updated) => setList((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Platform Breakdown Tab ───────────────────────────────────────────────────
function BreakdownTab({ stats }: { stats: AdminStats }) {
  function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
      <div className="flex items-center gap-3 py-2 border-b border-soc-border/50 last:border-0">
        <span className="text-xs text-slate-400 w-28 truncate capitalize">{label.replace(/_/g, " ")}</span>
        <div className="flex-1 h-1.5 bg-soc-border rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-bold font-mono text-slate-200 w-8 text-right">{value}</span>
      </div>
    );
  }

  const maxPlatform = Math.max(...(stats.threats_by_platform.map((r) => r.cnt)), 1);
  const maxType = Math.max(...(stats.takedowns_by_type.map((r) => r.cnt)), 1);
  const maxRisk = Math.max(...(stats.accounts_by_risk.map((r) => r.cnt)), 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="soc-card">
        <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">THREATS BY PLATFORM</div>
        {stats.threats_by_platform.length === 0 ? (
          <div className="text-center py-6 text-slate-600 text-xs">No data</div>
        ) : stats.threats_by_platform.map((r) => (
          <Bar key={r.platform} label={r.platform} value={r.cnt} max={maxPlatform} color="bg-threat-critical" />
        ))}
      </div>
      <div className="soc-card">
        <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">TAKEDOWNS BY TYPE</div>
        {stats.takedowns_by_type.length === 0 ? (
          <div className="text-center py-6 text-slate-600 text-xs">No data</div>
        ) : stats.takedowns_by_type.map((r) => (
          <Bar key={r.takedown_type} label={r.takedown_type} value={r.cnt} max={maxType} color="bg-gold" />
        ))}
      </div>
      <div className="soc-card">
        <div className="text-[10px] font-bold text-slate-500 tracking-widest mb-3">ACCOUNTS BY RISK</div>
        {stats.accounts_by_risk.length === 0 ? (
          <div className="text-center py-6 text-slate-600 text-xs">No data</div>
        ) : stats.accounts_by_risk.map((r) => {
          const color = r.risk_category === "imposter" ? "bg-threat-critical" :
                        r.risk_category === "suspicious" ? "bg-threat-high" :
                        r.risk_category === "legitimate" ? "bg-status-live" : "bg-slate-500";
          return <Bar key={r.risk_category} label={r.risk_category} value={r.cnt} max={maxRisk} color={color} />;
        })}
      </div>
    </div>
  );
}

// ─── Root AdminPage ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("influencers");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [influencerList, setInfluencerList] = useState<InfluencerProfile[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    Promise.all([admin.stats(), influencersApi.list()])
      .then(([s, infs]) => { setStats(s); setInfluencerList(infs); })
      .finally(() => setLoadingStats(false));
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "influencers", label: "Influencers", icon: <UserCheck size={14} /> },
    { id: "users",       label: "Users",       icon: <Users size={14} /> },
    { id: "breakdown",   label: "Platform Stats", icon: <BarChart2 size={14} /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Admin Console</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-mono">Platform management · imprsn8</p>
        </div>
        <span className="text-[10px] bg-red-500/15 text-red-400 px-3 py-1 rounded-full font-mono border border-red-500/30 uppercase tracking-widest">
          Admin
        </span>
      </div>

      {/* Stats bar */}
      {!loadingStats && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Users size={12} />} label="Total Users" value={stats.users} />
          <StatCard icon={<Shield size={12} />} label="Influencers" value={stats.influencers} sub={`${influencerList.filter((i) => i.active).length} active`} />
          <StatCard icon={<AlertTriangle size={12} />} label="Active Threats" value={stats.active_threats} />
          <StatCard icon={<Flag size={12} />} label="Pending Takedowns" value={stats.pending_takedowns} />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-soc-border">
        {tabs.map((t) => (
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

      {/* Tab content */}
      {tab === "influencers" && <InfluencersTab />}
      {tab === "users"       && <UsersTab influencerList={influencerList} />}
      {tab === "breakdown"   && stats && <BreakdownTab stats={stats} />}
      {tab === "breakdown"   && !stats && !loadingStats && (
        <div className="text-center py-12 text-slate-500 text-sm">No stats available</div>
      )}
    </div>
  );
}
