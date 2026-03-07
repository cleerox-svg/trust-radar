import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, RefreshCw, Trash2, ExternalLink, Eye } from "lucide-react";
import { accounts, influencers as influencersApi } from "../lib/api";
import { Ring } from "../components/ui/Ring";
import { PlatformIcon, PlatformFilterBar, PLATFORM_CONFIG } from "../components/ui/PlatformIcon";
import { RiskBadge } from "../components/ui/SeverityBadge";
import type { MonitoredAccount, InfluencerProfile, User, Platform, HandleVariant } from "../lib/types";

interface Ctx { user: User; selectedInfluencer: InfluencerProfile | null; influencerList: InfluencerProfile[]; }

const ALL_PLATFORMS = Object.keys(PLATFORM_CONFIG) as Platform[];

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
  const { user, selectedInfluencer, influencerList } = useOutletContext<Ctx>();
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

  // Handle variants (typosquat watchlist) — only when viewing a specific influencer
  const [variants, setVariants] = useState<HandleVariant[]>([]);
  const [showVariants, setShowVariants] = useState(false);
  const [variantForm, setVariantForm] = useState({ platform: "tiktok", original_handle: "", variant_handle: "", variant_type: "other" });
  const [addingVariant, setAddingVariant] = useState(false);

  useEffect(() => {
    if (selectedInfluencer) {
      influencersApi.listVariants(selectedInfluencer.id).then(setVariants).catch(() => setVariants([]));
    } else {
      setVariants([]);
    }
  }, [selectedInfluencer]);

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInfluencer || !variantForm.variant_handle.trim()) return;
    setAddingVariant(true);
    try {
      const v = await influencersApi.addVariant(selectedInfluencer.id, {
        platform: variantForm.platform,
        original_handle: variantForm.original_handle || selectedInfluencer.handle,
        variant_handle: variantForm.variant_handle.replace(/^@/, ""),
        variant_type: variantForm.variant_type,
      });
      setVariants((prev) => [v, ...prev]);
      setVariantForm({ platform: "tiktok", original_handle: "", variant_handle: "", variant_type: "other" });
    } finally {
      setAddingVariant(false);
    }
  }

  async function handleRemoveVariant(variantId: string) {
    if (!selectedInfluencer) return;
    await influencersApi.deleteVariant(selectedInfluencer.id, variantId);
    setVariants((prev) => prev.filter((v) => v.id !== variantId));
  }

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

  // Per-platform counts for the filter bar badge
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { all: list.length };
    for (const a of list) counts[a.platform] = (counts[a.platform] ?? 0) + 1;
    return counts;
  }, [list]);

  // Only show platforms that have at least 1 account (or "all")
  const activePlatforms = useMemo(
    () => ALL_PLATFORMS.filter((p) => (platformCounts[p] ?? 0) > 0),
    [platformCounts]
  );

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
            <button
              onClick={() => {
                setAddForm({ influencer_id: selectedInfluencer?.id ?? "", platform: "tiktok", handle: "", profile_url: "", is_verified: 0 });
                setShowAdd(true);
              }}
              className="btn-gold flex items-center gap-2"
            >
              <Plus size={14} /> Add Account
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <PlatformFilterBar
          selected={filterPlatform}
          onChange={setFilterPlatform}
          platforms={activePlatforms.length > 0 ? activePlatforms : undefined}
          showCount={platformCounts}
        />
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "legitimate", "suspicious", "imposter"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRisk(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border ${
                filterRisk === r
                  ? "bg-purple border-purple text-white"
                  : "bg-soc-border/20 border-soc-border/40 text-slate-400 hover:border-soc-border-bright hover:text-slate-200"
              }`}
            >
              {r === "all" ? "All Risk Levels" : r}
              {r !== "all" && list.filter((a) => a.risk_category === r).length > 0 && (
                <span className="ml-1 opacity-60 font-normal">
                  ({list.filter((a) => a.risk_category === r).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Add account modal */}
      {showAdd && (
        <div className="soc-card border-gold/20">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Add Monitored Account</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
            {/* Influencer picker — only shown when not scoped to a specific influencer */}
            {!selectedInfluencer && (
              <div className="col-span-2">
                <label className="text-xs text-slate-500 block mb-1">Influencer *</label>
                {influencerList.length === 0 ? (
                  <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded px-3 py-2">
                    No influencer profiles found. Create one in Admin → Influencers first.
                  </div>
                ) : (
                  <select
                    className="soc-select"
                    value={addForm.influencer_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, influencer_id: e.target.value }))}
                    required
                  >
                    <option value="">— select influencer —</option>
                    {influencerList.map((inf) => (
                      <option key={inf.id} value={inf.id}>{inf.display_name} (@{inf.handle})</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div>
              <label className="text-xs text-slate-500 block mb-1">Platform</label>
              <select className="soc-select" value={addForm.platform}
                onChange={(e) => setAddForm((f) => ({ ...f, platform: e.target.value as Platform }))}>
                {ALL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_CONFIG[p]?.name ?? p}</option>
                ))}
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
              <button
                type="submit"
                disabled={adding || !addForm.handle.trim() || (!selectedInfluencer && !addForm.influencer_id)}
                className="btn-gold"
              >
                {adding ? "Adding…" : "Add Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Typosquat Watchlist — only shown when a specific influencer is selected */}
      {selectedInfluencer && (
        <div className="soc-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-bold text-slate-500 tracking-widest">HANDLE VARIANT WATCHLIST</div>
              <div className="text-xs text-slate-400 mt-0.5">Typosquat handles being monitored for @{selectedInfluencer.handle}</div>
            </div>
            <div className="flex gap-2">
              <span className="text-xs text-slate-500">{variants.length} variants</span>
              {canAdd && (
                <button onClick={() => setShowVariants((v) => !v)} className="btn-icon !p-1.5">
                  <Plus size={12} />
                </button>
              )}
            </div>
          </div>

          {showVariants && canAdd && (
            <form onSubmit={handleAddVariant} className="grid grid-cols-2 gap-2.5 mb-4 pb-4 border-b border-soc-border">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Platform</label>
                <select className="soc-select !py-1.5 !text-xs" value={variantForm.platform}
                  onChange={(e) => setVariantForm((f) => ({ ...f, platform: e.target.value }))}>
                  {ALL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>{PLATFORM_CONFIG[p]?.name ?? p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Variant Type</label>
                <select className="soc-select !py-1.5 !text-xs" value={variantForm.variant_type}
                  onChange={(e) => setVariantForm((f) => ({ ...f, variant_type: e.target.value }))}>
                  {["homoglyph","separator","suffix","prefix","swap","other"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Original Handle</label>
                <input className="soc-input !py-1.5 !text-xs" placeholder={`@${selectedInfluencer.handle}`}
                  value={variantForm.original_handle}
                  onChange={(e) => setVariantForm((f) => ({ ...f, original_handle: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Typosquat Handle *</label>
                <input className="soc-input !py-1.5 !text-xs" placeholder="@variant_handle" required
                  value={variantForm.variant_handle}
                  onChange={(e) => setVariantForm((f) => ({ ...f, variant_handle: e.target.value }))} />
              </div>
              <div className="col-span-2 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowVariants(false)} className="btn-ghost !py-1.5 !px-3 !text-xs">Cancel</button>
                <button type="submit" disabled={addingVariant || !variantForm.variant_handle.trim()} className="btn-gold !py-1.5 !px-3 !text-xs">
                  {addingVariant ? "Adding…" : "Add Variant"}
                </button>
              </div>
            </form>
          )}

          {variants.length === 0 ? (
            <div className="text-center py-4 text-slate-600 text-xs">No variants tracked yet</div>
          ) : (
            <div className="space-y-1.5">
              {variants.map((v) => (
                <div key={v.id} className="flex items-center gap-3 py-2 border-b border-soc-border/50 last:border-0">
                  <Eye size={11} className="text-slate-600 shrink-0" />
                  <PlatformIcon platform={v.platform as Platform} size="sm" />
                  <span className="font-mono text-xs text-slate-300">@{v.variant_handle}</span>
                  <span className="text-[10px] text-slate-500">← @{v.original_handle}</span>
                  <span className="text-[9px] font-bold bg-purple/10 border border-purple/20 text-purple-light px-1.5 py-0.5 rounded-full uppercase">{v.variant_type}</span>
                  {canAdd && (
                    <button onClick={() => handleRemoveVariant(v.id)} className="ml-auto btn-icon !p-1 hover:!border-threat-critical/40 hover:!text-threat-critical">
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
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
