import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus, Edit2, X, Check, UserCheck, Shield, Users, BarChart2,
  AlertTriangle, Flag, Database, RefreshCw, Mail, UserPlus,
  Activity, CheckCircle2, XCircle, Lock, Server, HardDrive, ExternalLink,
  Clock, FileText,
} from "lucide-react";
import { admin, influencers as influencersApi, type AdminUser } from "../lib/api";
import type { AdminStats, InfluencerProfile } from "../lib/types";
import { InviteInfluencerModal } from "../components/InviteInfluencerModal";

const PLANS = ["free", "pro", "enterprise"] as const;
const ROLES = ["influencer", "staff", "soc", "admin"] as const;
const TIERS = ["starter", "pro", "enterprise"] as const;

// ─── Platform Admin Link ──────────────────────────────────────────────────────
function PlatformAdminLink() {
  return (
    <a
      href="https://lrxradar.com/admin"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border"
      style={{
        color: "#22D3EE",
        borderColor: "rgba(34,211,238,0.3)",
        background: "rgba(34,211,238,0.06)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,211,238,0.12)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(34,211,238,0.06)")}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: "#22D3EE" }}
      />
      Trust Radar Admin
      <ExternalLink size={10} style={{ opacity: 0.7 }} />
    </a>
  );
}

type Tab = "influencers" | "users" | "breakdown" | "health" | "reports" | "brands";

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="card p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
        {icon}
        {label}
      </div>
      <div
        className="font-bold text-2xl font-mono tabular"
        style={{ color: "var(--gold-400)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{sub}</div>}
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
  // Invite modal: which influencer to invite (null = picker open, InfluencerProfile = pre-selected)
  const [inviteTarget, setInviteTarget] = useState<InfluencerProfile | null | "picker">(null);
  const [pickerSearch, setPickerSearch] = useState("");

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

  const filteredForPicker = influencerList.filter((i) =>
    i.active && (
      i.display_name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      i.handle.toLowerCase().includes(pickerSearch.toLowerCase())
    )
  );

  return (
    <div className="space-y-4">
      {error && <div className="soc-card border-red-500/30 text-red-400 text-sm">{error}</div>}

      {/* Influencer picker (shown before InviteInfluencerModal when no specific row was clicked) */}
      {inviteTarget === "picker" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-soc-card border border-soc-border rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-soc-border">
              <h2 className="font-bold text-slate-100 text-sm">Select Influencer to Invite</h2>
              <button onClick={() => setInviteTarget(null)} className="btn-icon !p-1.5"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-3">
              <input
                className="soc-input w-full"
                placeholder="Search by name or handle…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredForPicker.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-6">No active influencers found</div>
                ) : filteredForPicker.map((inf) => (
                  <button
                    key={inf.id}
                    onClick={() => { setInviteTarget(inf); setPickerSearch(""); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-soc-border/30 transition-colors text-left"
                  >
                    {inf.avatar_url ? (
                      <img src={inf.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-soc-border shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple/20 border border-purple/30 flex items-center justify-center text-sm font-bold text-purple-light shrink-0">
                        {inf.display_name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-slate-200">{inf.display_name}</div>
                      <div className="text-[10px] text-slate-500">@{inf.handle}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* InviteInfluencerModal for the selected influencer */}
      {inviteTarget && inviteTarget !== "picker" && (
        <InviteInfluencerModal influencer={inviteTarget} onClose={() => setInviteTarget(null)} />
      )}

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Users ({total})</h2>
          <button
            onClick={() => setInviteTarget("picker")}
            className="btn-gold flex items-center gap-1.5 !py-1.5 !px-3 !text-xs"
          >
            <UserPlus size={12} /> Add / Invite User
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["Email / Handle", "Plan", "Role", "Assigned Influencer", "Score", "Admin", "Joined"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-overlay)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
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
                  <td className="px-4 py-3 font-bold font-mono text-xs tabular" style={{ color: "var(--gold-400)", fontVariantNumeric: "tabular-nums" }}>{u.impression_score}</td>
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
    <div className="card p-5" style={{ borderColor: "var(--border-gold)" }}>
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
  const [inviting, setInviting] = useState(false);
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

  const row = (
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
            onClick={() => setInviting(true)}
            disabled={saving}
            className="btn-icon !p-1.5 hover:text-gold"
            title="Invite influencer"
          >
            <Mail size={11} />
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

  return (
    <>
      {row}
      {inviting && <InviteInfluencerModal influencer={inf} onClose={() => setInviting(false)} />}
    </>
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

// ─── System Health Tab ────────────────────────────────────────────────────────

interface HealthData {
  status: "healthy" | "degraded" | "error";
  timestamp: string;
  environment: string;
  database: {
    status: "ok" | "error";
    response_ms: number;
    sqlite_version: string;
    journal_mode: string;
    encryption_at_rest: string;
    encryption_in_transit: string;
    last_migration: string;
    tables: { name: string; rows: number }[];
  };
  kv_sessions:  { status: string; binding: string };
  r2_assets:    { status: string; binding: string };
  compliance: {
    data_residency: string;
    audit_logging:  string;
    hitl_enforced:  string;
  };
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold ${ok ? "text-status-live" : "text-threat-critical"}`}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {label}
    </div>
  );
}

function HealthRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-soc-border/50 last:border-0">
      <span className="text-[11px] text-slate-500 uppercase tracking-wider shrink-0">{label}</span>
      <span className={`text-xs text-right ${mono ? "font-mono text-slate-300" : "text-slate-300"}`}>{value}</span>
    </div>
  );
}

function BackfillGeoButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ enriched: number; remaining: number } | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/admin/backfill-geo", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("imprsn8_token")}` },
      });
      const json = await res.json() as { success: boolean; data?: { enriched: number; remaining: number }; error?: string };
      if (json.success && json.data) {
        setResult(json.data);
      } else {
        setError(json.error ?? "Failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="soc-card flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <RefreshCw size={14} className="text-gold" />
        <span className="font-semibold text-slate-200 text-sm">Geo Backfill</span>
        <span className="text-[10px] text-slate-500">Enrich up to 500 IPs per click</span>
      </div>
      <button
        onClick={run}
        disabled={running}
        className="btn-gold flex items-center gap-1.5 !py-1.5 !px-3 !text-xs ml-auto"
      >
        <RefreshCw size={12} className={running ? "animate-spin" : ""} />
        {running ? "Enriching…" : "Backfill Geo"}
      </button>
      {result && (
        <span className="text-xs font-mono" style={{ color: result.remaining > 0 ? "var(--gold-400)" : "var(--semantic-success)" }}>
          {result.enriched} enriched · {result.remaining} remaining
        </span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

function BackfillBrandMatchButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ matched: number; pending: number } | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/admin/backfill-brand-match", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("imprsn8_token")}` },
      });
      const json = await res.json() as { success: boolean; data?: { matched: number; pending: number }; error?: string };
      if (json.success && json.data) {
        setResult(json.data);
      } else {
        setError(json.error ?? "Failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="soc-card flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <Database size={14} className="text-gold" />
        <span className="font-semibold text-slate-200 text-sm">Brand Match</span>
        <span className="text-[10px] text-slate-500">Match up to 500 unlinked threats per click</span>
      </div>
      <button
        onClick={run}
        disabled={running}
        className="btn-gold flex items-center gap-1.5 !py-1.5 !px-3 !text-xs ml-auto"
      >
        <RefreshCw size={12} className={running ? "animate-spin" : ""} />
        {running ? "Matching…" : "Match Brands"}
      </button>
      {result && (
        <span className="text-xs font-mono" style={{ color: result.pending > 0 ? "var(--gold-400)" : "var(--semantic-success)" }}>
          {result.matched} matched · {result.pending} pending
        </span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

function HealthTab() {
  const [data, setData] = useState<HealthData | null>(null);
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
      <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="soc-card border-red-500/30 bg-red-950/20 text-red-400 text-sm flex items-center gap-2">
      <XCircle size={14} />
      {error}
    </div>
  );

  if (!data) return null;

  const dbOk = data.database.status === "ok";
  const kvOk = data.kv_sessions.status === "ok";
  const r2Ok = data.r2_assets.status === "ok";

  return (
    <div className="space-y-5">
      {/* Overall status bar */}
      <div className={`soc-card flex items-center gap-4 flex-wrap ${
        data.status === "healthy"
          ? "border-status-live/30 bg-status-live/5"
          : "border-gold/30 bg-gold/5"
      }`}>
        <div className={`w-3 h-3 rounded-full animate-pulse ${data.status === "healthy" ? "bg-status-live" : "bg-gold"}`} />
        <div>
          <div className={`font-bold text-sm uppercase tracking-widest ${data.status === "healthy" ? "text-status-live" : "text-gold"}`}>
            {data.status === "healthy" ? "All Systems Operational" : "Degraded — Check Below"}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Env: {data.environment} · Checked {checkedAt?.toLocaleTimeString() ?? "—"}
          </div>
        </div>
        <div className="ml-auto flex gap-3">
          <StatusBadge ok={dbOk} label="Database" />
          <StatusBadge ok={kvOk} label="KV Sessions" />
          <StatusBadge ok={r2Ok} label="R2 Assets" />
        </div>
        <button onClick={load} disabled={loading} className="btn-icon !p-1.5">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Geo Backfill */}
      <BackfillGeoButton />
      <BackfillBrandMatchButton />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Database */}
        <div className="soc-card space-y-0">
          <div className="flex items-center gap-2 mb-3">
            <Database size={14} className="text-gold" />
            <span className="font-semibold text-slate-200 text-sm">Database (Cloudflare D1)</span>
            <StatusBadge ok={dbOk} label={dbOk ? "OK" : "Error"} />
          </div>
          <HealthRow label="Response time" value={`${data.database.response_ms} ms`} mono />
          <HealthRow label="SQLite version"    value={data.database.sqlite_version} mono />
          <HealthRow label="Journal mode"      value={data.database.journal_mode} mono />
          <HealthRow label="Last migration"    value={data.database.last_migration} mono />
          <HealthRow
            label="Encryption at rest"
            value={
              <span className="flex items-center gap-1.5">
                <Lock size={10} className="text-status-live shrink-0" />
                {data.database.encryption_at_rest}
              </span>
            }
          />
          <HealthRow
            label="Encryption in transit"
            value={
              <span className="flex items-center gap-1.5">
                <Lock size={10} className="text-status-live shrink-0" />
                {data.database.encryption_in_transit}
              </span>
            }
          />
        </div>

        {/* Compliance */}
        <div className="soc-card space-y-0">
          <div className="flex items-center gap-2 mb-3">
            <Lock size={14} className="text-gold" />
            <span className="font-semibold text-slate-200 text-sm">Compliance &amp; Controls</span>
          </div>
          <HealthRow label="Data residency"  value={data.compliance.data_residency} />
          <HealthRow label="Audit logging"   value={data.compliance.audit_logging} />
          <HealthRow label="HITL enforcement" value={data.compliance.hitl_enforced} />
          <HealthRow label="KV Sessions"     value={<StatusBadge ok={kvOk} label={data.kv_sessions.status} />} />
          <HealthRow label="R2 Assets"       value={<StatusBadge ok={r2Ok} label={data.r2_assets.status} />} />
        </div>

        {/* Table row counts */}
        <div className="soc-card md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Server size={14} className="text-gold" />
            <span className="font-semibold text-slate-200 text-sm">Table Row Counts</span>
            <span className="text-[10px] text-slate-600">Live counts — admin only</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {data.database.tables.map((t) => (
              <div key={t.name} className="bg-soc-bg/60 rounded p-2.5 text-center">
                <div className={`text-base font-bold font-mono ${t.rows < 0 ? "text-slate-600" : "text-slate-200"}`}>
                  {t.rows < 0 ? "—" : t.rows.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-600 mt-0.5 font-mono truncate">{t.name}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Storage health note */}
      <div className="flex items-start gap-2 text-[11px] text-slate-600 bg-soc-bg/40 rounded p-3 border border-soc-border/50">
        <HardDrive size={12} className="mt-0.5 shrink-0 text-slate-600" />
        <span>
          Cloudflare D1 databases are replicated globally with point-in-time restore.
          Encryption keys are managed by Cloudflare's platform — no customer key management required.
          This view is only visible to admin-role users.
        </span>
      </div>
    </div>
  );
}

// ─── Root AdminPage ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) ?? "influencers";
  function setTab(id: Tab) {
    setSearchParams({ tab: id }, { replace: false });
  }
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [influencerList, setInfluencerList] = useState<InfluencerProfile[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    Promise.all([admin.stats(), influencersApi.list()])
      .then(([s, infs]) => { setStats(s); setInfluencerList(infs); })
      .finally(() => setLoadingStats(false));
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "influencers", label: "Influencers",    icon: <UserCheck size={14} /> },
    { id: "users",       label: "Users",          icon: <Users size={14} /> },
    { id: "breakdown",   label: "Platform Stats", icon: <BarChart2 size={14} /> },
    { id: "brands",      label: "Brands",         icon: <Database size={14} /> },
    { id: "health",      label: "System Health",  icon: <Activity size={14} /> },
    { id: "reports",     label: "Reports",        icon: <FileText size={14} /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Admin Console</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-mono">Platform management · imprsn8</p>
        </div>
        <div className="flex items-center gap-3">
          <PlatformAdminLink />
          <span className="text-[10px] bg-red-500/15 text-red-400 px-3 py-1 rounded-full font-mono border border-red-500/30 uppercase tracking-widest">
            Admin
          </span>
        </div>
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
      {tab === "health"      && <HealthTab />}
      {tab === "breakdown"   && stats && <BreakdownTab stats={stats} />}
      {tab === "breakdown"   && !stats && !loadingStats && (
        <div className="text-center py-12 text-slate-500 text-sm">No stats available</div>
      )}
      {tab === "brands"      && <BrandsManagementTab />}
      {tab === "reports"     && <ScheduledReportsStub />}
    </div>
  );
}

// ─── Brands Management Tab ────────────────────────────────────────────────────

function BrandsManagementTab() {
  const [brands, setBrands] = useState<Array<{
    id: string; name: string; canonical_domain: string; sector: string | null;
    source: string | null; first_seen: string; threat_count: number;
    active_threats: number; is_monitored: number;
  }>>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<Array<{ source: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [trancoLimit, setTrancoLimit] = useState(500);

  const fetchBrands = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (sourceFilter) params.set("source", sourceFilter);
    params.set("limit", "50");
    params.set("offset", String(offset));
    fetch(`/api/admin/brands?${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("imprsn8_token")}`, "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then((json: { success: boolean; data: typeof brands; total: number; sources: typeof sources }) => {
        if (json.success) {
          setBrands(json.data);
          setTotal(json.total);
          setSources(json.sources);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBrands(); }, [search, sourceFilter, offset]);

  const handleImportTranco = () => {
    setImporting(true);
    setImportResult(null);
    fetch("/api/admin/import-tranco", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("imprsn8_token")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: trancoLimit }),
    })
      .then(r => r.json())
      .then((json: { success: boolean; data?: { message: string }; error?: string }) => {
        setImportResult(json.success ? json.data?.message ?? "Done" : json.error ?? "Failed");
        if (json.success) fetchBrands();
      })
      .catch(e => setImportResult(String(e)))
      .finally(() => setImporting(false));
  };

  const handleBulkMonitor = () => {
    if (selected.size === 0) return;
    fetch("/api/admin/brands/bulk-monitor", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("imprsn8_token")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ brand_ids: [...selected] }),
    })
      .then(r => r.json())
      .then(() => { setSelected(new Set()); fetchBrands(); });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === brands.length) setSelected(new Set());
    else setSelected(new Set(brands.map(b => b.id)));
  };

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <Database size={20} style={{ color: "#3b82f6" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Import Brands from Tranco</h3>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Bulk-import top domains from the Tranco popularity list</p>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="text-[10px] font-bold tracking-wider block mb-1" style={{ color: "var(--text-tertiary)" }}>TOP N DOMAINS</label>
            <input
              type="number"
              value={trancoLimit}
              onChange={e => setTrancoLimit(Math.min(2000, Math.max(10, parseInt(e.target.value) || 500)))}
              className="px-3 py-1.5 rounded-md text-sm w-24"
              style={{ background: "var(--surface-primary)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}
            />
          </div>
          <button
            onClick={handleImportTranco}
            disabled={importing}
            className="px-4 py-1.5 rounded-md text-sm font-semibold"
            style={{
              background: importing ? "var(--surface-tertiary)" : "#3b82f6",
              color: "#fff", border: "none", cursor: importing ? "wait" : "pointer",
            }}
          >
            {importing ? "Importing..." : "Import from Tranco"}
          </button>
        </div>
        {importResult && (
          <p className="text-xs mt-3" style={{ color: importResult.includes("Failed") ? "var(--semantic-error)" : "var(--semantic-success)" }}>
            {importResult}
          </p>
        )}
      </div>

      {/* Source breakdown */}
      {sources.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setSourceFilter(""); setOffset(0); }}
            className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: !sourceFilter ? "var(--accent-primary)" : "var(--surface-tertiary)",
              color: !sourceFilter ? "#fff" : "var(--text-tertiary)",
              border: "none", cursor: "pointer",
            }}
          >
            All ({total})
          </button>
          {sources.map(s => (
            <button
              key={s.source}
              onClick={() => { setSourceFilter(s.source); setOffset(0); }}
              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: sourceFilter === s.source ? "var(--accent-primary)" : "var(--surface-tertiary)",
                color: sourceFilter === s.source ? "#fff" : "var(--text-tertiary)",
                border: "none", cursor: "pointer",
              }}
            >
              {s.source} ({s.count})
            </button>
          ))}
        </div>
      )}

      {/* Search + Bulk actions */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setOffset(0); }}
          placeholder="Search brands..."
          className="px-3 py-2 rounded-lg text-sm flex-1"
          style={{ background: "var(--surface-primary)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", maxWidth: 350 }}
        />
        {selected.size > 0 && (
          <button
            onClick={handleBulkMonitor}
            className="px-4 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "var(--accent-primary)", color: "#fff", border: "none", cursor: "pointer" }}
          >
            Monitor Selected ({selected.size})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
              <th className="p-3 text-left w-8">
                <input type="checkbox" checked={selected.size === brands.length && brands.length > 0} onChange={toggleSelectAll} />
              </th>
              <th className="p-3 text-left text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-tertiary)" }}>Brand</th>
              <th className="p-3 text-left text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-tertiary)" }}>Source</th>
              <th className="p-3 text-right text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-tertiary)" }}>Threats</th>
              <th className="p-3 text-right text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-tertiary)" }}>Active</th>
              <th className="p-3 text-center text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-tertiary)" }}>Monitored</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="p-6 text-center" style={{ color: "var(--text-tertiary)" }}>Loading...</td></tr>
            )}
            {!loading && brands.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center" style={{ color: "var(--text-tertiary)" }}>No brands found</td></tr>
            )}
            {brands.map(b => (
              <tr
                key={b.id}
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface-secondary)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}
              >
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleSelect(b.id)} />
                </td>
                <td className="p-3">
                  <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{b.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{b.canonical_domain}</div>
                </td>
                <td className="p-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{
                      background: b.source === "tranco" ? "rgba(59,130,246,0.1)" : "var(--surface-tertiary)",
                      color: b.source === "tranco" ? "#3b82f6" : "var(--text-tertiary)",
                    }}>
                    {b.source ?? "manual"}
                  </span>
                </td>
                <td className="p-3 text-right font-mono" style={{ color: "var(--text-primary)" }}>{b.threat_count}</td>
                <td className="p-3 text-right font-mono" style={{ color: b.active_threats > 0 ? "var(--semantic-error)" : "var(--text-tertiary)" }}>
                  {b.active_threats}
                </td>
                <td className="p-3 text-center">
                  {b.is_monitored ? (
                    <CheckCircle2 size={14} style={{ color: "var(--semantic-success)", margin: "0 auto" }} />
                  ) : (
                    <XCircle size={14} style={{ color: "var(--text-tertiary)", opacity: 0.3, margin: "0 auto" }} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - 50))}
            disabled={offset === 0}
            className="px-3 py-1 rounded text-xs"
            style={{ background: "var(--surface-overlay)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", opacity: offset === 0 ? 0.4 : 1 }}
          >
            Previous
          </button>
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {offset + 1}–{Math.min(offset + 50, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + 50)}
            disabled={offset + 50 >= total}
            className="px-3 py-1 rounded text-xs"
            style={{ background: "var(--surface-overlay)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", opacity: offset + 50 >= total ? 0.4 : 1 }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Scheduled Reports Stub ───────────────────────────────────────────────────
function ScheduledReportsStub() {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(109,64,237,0.1)", border: "1px solid rgba(109,64,237,0.2)" }}>
            <Clock size={20} style={{ color: "var(--violet-400)" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Scheduled Reports</h3>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Automatic weekly/monthly reports delivered to stakeholders</p>
          </div>
        </div>
        <div className="rounded-lg p-8 text-center" style={{ background: "var(--surface-overlay)", border: "1px dashed var(--border-subtle)" }}>
          <FileText size={32} className="mx-auto mb-3" style={{ color: "var(--text-tertiary)", opacity: 0.5 }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Coming Soon</p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)", maxWidth: 400, margin: "0 auto" }}>
            Automatic weekly and monthly threat intelligence reports delivered to stakeholders via email.
            Configure recipients, schedule, and report format.
          </p>
        </div>
      </div>
      <div className="card p-6">
        <div className="text-[10px] font-bold tracking-widest mb-4" style={{ color: "var(--text-tertiary)" }}>ON-DEMAND REPORTS</div>
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          Generate brand threat intelligence reports from the Dashboard. Each monitored brand has a "Generate Report" button that opens a printable PDF-ready report.
        </p>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--violet-400)" }}>
          <ExternalLink size={12} />
          <span>Go to Dashboard to generate reports</span>
        </div>
      </div>
    </div>
  );
}
