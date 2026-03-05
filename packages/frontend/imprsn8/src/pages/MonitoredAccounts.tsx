import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { accounts } from "../lib/api";
import { Ring } from "../components/ui/Ring";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { RiskBadge } from "../components/ui/SeverityBadge";
import type { MonitoredAccount, InfluencerProfile, User, Platform } from "../lib/types";

interface Ctx { user: User; selectedInfluencer: InfluencerProfile | null; }

const PLATFORMS: Platform[] = ["tiktok", "instagram", "x", "youtube", "facebook", "linkedin", "twitch", "threads"];

function fmtFollowers(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(ts: string | null): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function MonitoredAccounts() {
  const { user, selectedInfluencer } = useOutletContext<Ctx>();
  const [list, setList] = useState<MonitoredAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<{ influencer_id: string; platform: Platform; handle: string; profile_url: string; is_verified: number }>({
    influencer_id: selectedInfluencer?.id ?? "",
    platform: "tiktok",
    handle: "",
    profile_url: "",
    is_verified: 0,
  });
  const [adding, setAdding] = useState(false);
  const canAdd = user.role === "soc" || user.role === "admin";

  async function load() {
    setLoading(true);
    try {
      const data = await accounts.list({
        influencer_id: selectedInfluencer?.id,
        platform: filterPlatform !== "all" ? filterPlatform : undefined,
        risk: filterRisk !== "all" ? filterRisk : undefined,
      });
      setList(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedInfluencer, filterPlatform, filterRisk]);

  // Group by influencer
  const grouped = list.reduce<Record<string, { name: string; handle: string; accounts: MonitoredAccount[] }>>((acc, a) => {
    const key = a.influencer_id;
    if (!acc[key]) acc[key] = { name: a.influencer_name ?? "Unknown", handle: a.influencer_handle ?? "", accounts: [] };
    acc[key].accounts.push(a);
    return acc;
  }, {});

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.handle.trim()) return;
    setAdding(true);
    try {
      const newAcc = await accounts.add({
        influencer_id: addForm.influencer_id || selectedInfluencer?.id || "",
        platform: addForm.platform,
        handle: addForm.handle.replace(/^@/, ""),
        profile_url: addForm.profile_url || undefined,
        is_verified: addForm.is_verified,
      });
      setList((prev) => [newAcc, ...prev]);
      setShowAdd(false);
      setAddForm({ influencer_id: "", platform: "tiktok", handle: "", profile_url: "", is_verified: 0 });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    await accounts.remove(id);
    setList((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Monitored Accounts</h1>
          <p className="text-xs text-slate-500 mt-0.5">{list.length} accounts across platforms</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-icon">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {canAdd && (
            <button onClick={() => setShowAdd(true)} className="btn-gold flex items-center gap-2">
              <Plus size={14} /> Add Account
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1">
          {["all", ...PLATFORMS.slice(0, 6)].map((p) => (
            <button key={p} onClick={() => setFilterPlatform(p)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${filterPlatform === p ? "bg-gold text-soc-bg" : "bg-soc-border/30 text-slate-400 hover:bg-soc-border/60"}`}>
              {p === "all" ? "ALL" : p.slice(0, 2).toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {["all", "legitimate", "suspicious", "imposter"].map((r) => (
            <button key={r} onClick={() => setFilterRisk(r)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all capitalize ${filterRisk === r ? "bg-purple text-white" : "bg-soc-border/30 text-slate-400 hover:bg-soc-border/60"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Add account modal */}
      {showAdd && (
        <div className="soc-card border-gold/20">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Add Monitored Account</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Platform</label>
              <select className="soc-select" value={addForm.platform}
                onChange={(e) => setAddForm((f) => ({ ...f, platform: e.target.value as Platform }))}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Handle</label>
              <input className="soc-input" placeholder="@handle" value={addForm.handle}
                onChange={(e) => setAddForm((f) => ({ ...f, handle: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Profile URL (optional)</label>
              <input className="soc-input" placeholder="https://..." value={addForm.profile_url}
                onChange={(e) => setAddForm((f) => ({ ...f, profile_url: e.target.value }))} />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={adding || !addForm.handle.trim()} className="btn-gold">
                {adding ? "Adding…" : "Add Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Account groups */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No accounts monitored yet</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([influencerId, group]) => (
            <div key={influencerId} className="soc-card space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-soc-border">
                <div className="w-6 h-6 rounded-full bg-purple/20 flex items-center justify-center text-[10px] font-bold text-purple-light">
                  {group.name[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-slate-200">{group.name}</span>
                <span className="text-slate-600">@{group.handle}</span>
                <span className="ml-auto text-xs text-slate-500">{group.accounts.length} accounts</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {group.accounts.map((acc) => (
                  <div key={acc.id} className="bg-soc-bg rounded-xl p-4 border border-soc-border
                                                hover:border-soc-border-bright transition-all">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 flex flex-col items-center">
                        <Ring score={acc.risk_score} size={64} strokeWidth={6} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <PlatformIcon platform={acc.platform} size="sm" />
                          <span className="text-sm font-mono text-slate-200 truncate">@{acc.handle}</span>
                          {acc.is_verified ? <span className="text-gold text-xs">✓</span> : null}
                        </div>
                        <div className="text-xs text-slate-500 mb-1.5">
                          {fmtFollowers(acc.follower_count)} followers
                        </div>
                        <RiskBadge category={acc.risk_category} />
                        <div className="text-[9px] text-slate-600 mt-1.5 font-mono">
                          Scanned: {timeAgo(acc.last_scanned_at)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {acc.profile_url && (
                          <a href={acc.profile_url} target="_blank" rel="noopener noreferrer" className="btn-icon !p-1.5">
                            <ExternalLink size={11} />
                          </a>
                        )}
                        {canAdd && (
                          <button onClick={() => handleRemove(acc.id)} className="btn-icon !p-1.5 hover:!border-threat-critical/40 hover:!text-threat-critical">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
