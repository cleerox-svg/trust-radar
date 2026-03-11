import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { feeds, type FeedSchedule, type FeedStatsData } from "../lib/api";
import { Card, CardContent, Badge, Button } from "../components/ui";
import { StatusDot } from "../components/ui/StatusDot";
import { cn } from "../lib/cn";
import { useState } from "react";
import {
  Plus, Pencil, Trash2, Play, RotateCcw, Power, PowerOff,
  ExternalLink, Database, Activity, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, X, Check, Save, ChevronLeft, Settings2,
} from "lucide-react";
import {
  INTEL_FEED_CATALOG, INTEL_FEED_MAP, TIER_LABELS, TIER_COLORS, TIER_GROUPS,
  CATEGORY_ICONS, type IntelFeedType, type FeedTier,
} from "../lib/feedCatalog";

const tierLabels: Record<number, string> = {
  1: "Real-time Critical",
  2: "High Priority",
  3: "Standard",
  4: "Social / OSINT",
  5: "API-dependent",
  6: "Enrichment",
};

function FeedStatusBadge({ feed }: { feed: FeedSchedule }) {
  if (feed.circuit_open) return <Badge variant="critical">Circuit Open</Badge>;
  if (!feed.enabled) return <Badge variant="info">Disabled</Badge>;
  if (feed.consecutive_failures > 0) return <Badge variant="medium">Failing ({feed.consecutive_failures})</Badge>;
  return <Badge variant="low">Active</Badge>;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ═══ Add Feed Modal ═══════════════════════════════════════════════ */

function AddFeedModal({ onCreated, onClose }: { onCreated: (feed: FeedSchedule) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<IntelFeedType | null>(null);
  const [search, setSearch] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(4px)" }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[--surface-raised] border border-[--border-subtle] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded hover:bg-[--surface-overlay] text-[--text-tertiary]">
          <X className="w-4 h-4" />
        </button>
        {selected ? (
          <FeedConfigForm feedType={selected} onBack={() => setSelected(null)} onCreated={onCreated} />
        ) : (
          <FeedPlatformPicker search={search} setSearch={setSearch} onSelect={setSelected} />
        )}
      </div>
    </div>
  );
}

function FeedPlatformPicker({ search, setSearch, onSelect }: { search: string; setSearch: (s: string) => void; onSelect: (ft: IntelFeedType) => void }) {
  const q = search.toLowerCase();
  const tiers: (FeedTier | "custom")[] = [1, 2, 3, 4, 5, 6, "custom"];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-[--text-primary] mb-0.5">Add Intelligence Feed</h2>
        <p className="text-xs text-[--text-tertiary]">Select a provider to connect. Credentials are stored securely.</p>
      </div>
      <input
        className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm text-[--text-primary] placeholder:text-[--text-disabled]"
        placeholder="Search feeds..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="space-y-5 max-h-[420px] overflow-y-auto pr-1">
        {tiers.map((tier) => {
          const items = (TIER_GROUPS[tier] ?? []).filter(
            (f) => !q || f.displayName.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
          );
          if (items.length === 0) return null;
          const tc = TIER_COLORS[tier === "custom" ? "custom" : tier as FeedTier];
          const label = tier === "custom" ? "Custom" : TIER_LABELS[tier as FeedTier];
          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-2 h-2 rounded-full", tc.dot)} />
                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", tc.badge)}>{label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((ft) => (
                  <button
                    key={ft.feedName}
                    onClick={() => onSelect(ft)}
                    className="p-3 rounded-lg text-left border border-[--border-subtle] bg-[--surface-base] hover:border-cyan-400/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xl leading-none">{ft.icon}</span>
                      {ft.implemented && (
                        <span className="text-[9px] font-bold text-green-400 border border-green-400/30 px-1.5 py-0.5 rounded-full">LIVE</span>
                      )}
                    </div>
                    <div className="font-semibold text-xs text-[--text-primary] mb-0.5">{ft.displayName}</div>
                    <div className="text-[9px] text-[--text-tertiary] leading-snug line-clamp-2">{ft.description}</div>
                    <div className="text-[9px] text-[--text-disabled] mt-1.5 flex items-center gap-1">
                      {CATEGORY_ICONS[ft.category] ?? ""} {ft.category}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeedConfigForm({ feedType, onBack, onCreated }: { feedType: IntelFeedType; onBack: () => void; onCreated: (feed: FeedSchedule) => void }) {
  const tc = TIER_COLORS[feedType.tier === 3 && feedType.feedName === "custom" ? "custom" : feedType.tier];
  const [name, setName] = useState(`${feedType.displayName}`);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [intervalMins, setIntervalMins] = useState(feedType.defaultIntervalMins);
  const [feedUrl, setFeedUrl] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>(() =>
    Object.fromEntries(feedType.settingsFields.map((f) => [f.key, String(f.default ?? "")]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function buildSettingsJson(): string {
    const obj: Record<string, unknown> = {};
    for (const field of feedType.settingsFields) {
      const raw = settings[field.key] ?? "";
      if (!raw && !field.required) continue;
      if (field.type === "textarea") obj[field.key] = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      else if (field.type === "number") obj[field.key] = Number(raw);
      else if (field.type === "boolean") obj[field.key] = raw === "true";
      else obj[field.key] = raw;
    }
    return JSON.stringify(obj);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const feed = await feeds.create({
        feed_name: feedType.feedName === "custom" ? name.toLowerCase().replace(/[^a-z0-9_]/g, "_") : feedType.feedName,
        display_name: name,
        url: feedUrl || "",
        tier: feedType.tier,
        category: feedType.category,
        parser: feedType.parser,
        interval_mins: intervalMins,
        description: feedType.description,
        provider_url: feedType.providerUrl,
        api_key: apiKey || undefined,
        api_secret: apiSecret || undefined,
        settings_json: buildSettingsJson(),
      });
      onCreated(feed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create feed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-1.5 rounded hover:bg-[--surface-overlay] text-[--text-tertiary]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-lg">{feedType.icon}</span>
        <div>
          <div className="font-bold text-[--text-primary] text-sm">{feedType.displayName}</div>
          <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border inline-block", tc.badge)}>
            Tier {feedType.tier} · {feedType.category}
          </span>
        </div>
        {feedType.providerUrl && (
          <a href={feedType.providerUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-[--text-tertiary] hover:text-cyan-400">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <div className="p-3 rounded-md bg-[--surface-base] border border-[--border-subtle] flex gap-3 text-xs text-[--text-secondary]">
        <div className="flex-1">Quota: {feedType.quotaInfo}</div>
        <div className="text-[--text-tertiary]">Min interval: {feedType.minIntervalMins}m</div>
      </div>

      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        <div>
          <label className="text-[10px] text-[--text-tertiary] uppercase tracking-wider block mb-1">Feed Name *</label>
          <input className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm text-[--text-primary]" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {feedType.feedName === "custom" && (
          <div>
            <label className="text-[10px] text-[--text-tertiary] uppercase tracking-wider block mb-1">Feed URL *</label>
            <input className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm text-[--text-primary] font-mono" required value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="https://..." />
          </div>
        )}

        {feedType.authFields.map((af) => (
          <div key={af.key}>
            <label className="text-[10px] text-[--text-tertiary] uppercase tracking-wider block mb-1">
              {af.label} {af.required && "*"}
            </label>
            <input
              className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm font-mono text-[--text-primary]"
              type={af.type}
              required={af.required}
              placeholder={af.placeholder ?? ""}
              value={af.key === "api_key" ? apiKey : apiSecret}
              onChange={(e) => af.key === "api_key" ? setApiKey(e.target.value) : setApiSecret(e.target.value)}
            />
            {af.help && <div className="text-[10px] text-[--text-disabled] mt-1">{af.help}</div>}
          </div>
        ))}

        {feedType.settingsFields.map((sf) => (
          <div key={sf.key}>
            <label className="text-[10px] text-[--text-tertiary] uppercase tracking-wider block mb-1">
              {sf.label} {sf.required && "*"}
            </label>
            {sf.type === "textarea" ? (
              <textarea
                className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm font-mono text-[--text-primary] resize-y min-h-[72px]"
                required={sf.required}
                placeholder={sf.placeholder ?? ""}
                value={settings[sf.key] ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, [sf.key]: e.target.value }))}
              />
            ) : sf.type === "select" && sf.options ? (
              <select
                className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm text-[--text-primary]"
                value={settings[sf.key] ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, [sf.key]: e.target.value }))}
              >
                {sf.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm text-[--text-primary]"
                type={sf.type === "number" ? "number" : "text"}
                required={sf.required}
                placeholder={sf.placeholder ?? ""}
                value={settings[sf.key] ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, [sf.key]: e.target.value }))}
              />
            )}
            {sf.help && <div className="text-[10px] text-[--text-disabled] mt-1">{sf.help}</div>}
          </div>
        ))}

        <div>
          <label className="text-[10px] text-[--text-tertiary] uppercase tracking-wider block mb-1">Pull Interval (minutes)</label>
          <input
            className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm text-[--text-primary]"
            type="number"
            min={feedType.minIntervalMins}
            max={10080}
            value={intervalMins}
            onChange={(e) => setIntervalMins(Math.max(feedType.minIntervalMins, parseInt(e.target.value) || feedType.defaultIntervalMins))}
          />
          <div className="text-[10px] text-[--text-disabled] mt-1">Minimum: {feedType.minIntervalMins} min</div>
        </div>
      </div>

      {error && <div className="text-xs text-threat-critical bg-threat-critical/10 border border-threat-critical/20 rounded px-3 py-2">{error}</div>}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 flex-1 px-4 py-2 rounded-md bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/25 text-sm font-medium disabled:opacity-50">
          {saving ? "Saving\u2026" : <><Check className="w-3.5 h-3.5" /> Add Feed</>}
        </button>
        <button type="button" onClick={onBack} disabled={saving} className="px-4 py-2 rounded-md border border-[--border-subtle] text-sm text-[--text-secondary] hover:bg-[--surface-overlay]">Cancel</button>
      </div>
    </form>
  );
}

/* ═══ Edit Feed Modal ══════════════════════════════════════════════ */

function EditFeedModal({ feed, onUpdated, onClose }: { feed: FeedSchedule; onUpdated: (f: FeedSchedule) => void; onClose: () => void }) {
  const catalogEntry = INTEL_FEED_MAP[feed.feed_name];
  const [name, setName] = useState(feed.display_name);
  const [intervalMins, setIntervalMins] = useState(feed.interval_mins);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>(() => {
    try {
      const obj = JSON.parse(feed.settings_json ?? "{}") as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = Array.isArray(v) ? (v as string[]).join("\n") : String(v ?? "");
      }
      return out;
    } catch { return {}; }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function buildSettingsJson(): string {
    const fields = catalogEntry?.settingsFields ?? [];
    const obj: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = settings[field.key] ?? "";
      if (!raw && !field.required) continue;
      if (field.type === "textarea") obj[field.key] = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      else if (field.type === "number") obj[field.key] = Number(raw);
      else if (field.type === "boolean") obj[field.key] = raw === "true";
      else obj[field.key] = raw;
    }
    return JSON.stringify(obj);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        display_name: name,
        interval_mins: intervalMins,
        settings_json: buildSettingsJson(),
      };
      if (apiKey && !/^\*+/.test(apiKey)) patch.api_key = apiKey;
      if (apiSecret && !/^\*+/.test(apiSecret)) patch.api_secret = apiSecret;

      const updated = await feeds.update(feed.id, patch);
      setSaved(true);
      setTimeout(() => { onUpdated(updated); onClose(); }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  const tc = TIER_COLORS[(feed.tier ?? 3) as FeedTier] ?? TIER_COLORS[3];
  const authFields = catalogEntry?.authFields ?? [];
  const settingsFields = catalogEntry?.settingsFields ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(4px)" }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[--surface-raised] border border-[--border-subtle] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded hover:bg-[--surface-overlay] text-[--text-tertiary]">
          <X className="w-4 h-4" />
        </button>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-lg">{catalogEntry?.icon ?? "📡"}</span>
            <div>
              <div className="font-bold text-[--text-primary] text-sm">{catalogEntry?.displayName ?? feed.feed_name}</div>
              <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border inline-block", tc.badge)}>
                Tier {feed.tier} · {feed.category}
              </span>
            </div>
            {(catalogEntry?.providerUrl || feed.provider_url) && (
              <a href={catalogEntry?.providerUrl ?? feed.provider_url ?? ""} target="_blank" rel="noopener noreferrer" className="ml-auto text-[--text-tertiary] hover:text-cyan-400">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {catalogEntry && (
            <div className="p-3 rounded-md bg-[--surface-base] border border-[--border-subtle] flex gap-3 text-xs text-[--text-secondary]">
              <div className="flex-1">Quota: {catalogEntry.quotaInfo}</div>
              <div className="text-[--text-tertiary]">Min: {catalogEntry.minIntervalMins}m</div>
            </div>
          )}

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            <div>
              <label className="text-[10px] text-[--text-tertiary] uppercase tracking-wider block mb-1">Feed Name *</label>
              <input className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm text-[--text-primary]" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {authFields.map((af) => (
              <div key={af.key}>
                <label className="text-[10px] text-[--text-tertiary] uppercase tracking-wider block mb-1">
                  {af.label} <span className="text-[--text-disabled]">(leave blank to keep existing)</span>
                </label>
                <input
                  className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm font-mono text-[--text-primary]"
                  type={af.type}
                  placeholder={af.key === "api_key" ? (feed.api_key_encrypted ?? af.placeholder ?? "") : (feed.api_secret_encrypted ?? af.placeholder ?? "")}
                  value={af.key === "api_key" ? apiKey : apiSecret}
                  onChange={(e) => af.key === "api_key" ? setApiKey(e.target.value) : setApiSecret(e.target.value)}
                />
                {af.help && <div className="text-[10px] text-[--text-disabled] mt-1">{af.help}</div>}
              </div>
            ))}

            {settingsFields.map((sf) => (
              <div key={sf.key}>
                <label className="text-[10px] text-[--text-tertiary] uppercase tracking-wider block mb-1">
                  {sf.label} {sf.required && "*"}
                </label>
                {sf.type === "textarea" ? (
                  <textarea
                    className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm font-mono text-[--text-primary] resize-y min-h-[72px]"
                    required={sf.required}
                    placeholder={sf.placeholder ?? ""}
                    value={settings[sf.key] ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, [sf.key]: e.target.value }))}
                  />
                ) : sf.type === "select" && sf.options ? (
                  <select
                    className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm text-[--text-primary]"
                    value={settings[sf.key] ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, [sf.key]: e.target.value }))}
                  >
                    {sf.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm text-[--text-primary]"
                    type={sf.type === "number" ? "number" : "text"}
                    required={sf.required}
                    placeholder={sf.placeholder ?? ""}
                    value={settings[sf.key] ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, [sf.key]: e.target.value }))}
                  />
                )}
                {sf.help && <div className="text-[10px] text-[--text-disabled] mt-1">{sf.help}</div>}
              </div>
            ))}

            <div>
              <label className="text-[10px] text-[--text-tertiary] uppercase tracking-wider block mb-1">Pull Interval (minutes)</label>
              <input
                className="w-full px-3 py-2 rounded-md border border-[--border-subtle] bg-[--surface-base] text-sm text-[--text-primary]"
                type="number"
                min={catalogEntry?.minIntervalMins ?? 5}
                max={10080}
                value={intervalMins}
                onChange={(e) => setIntervalMins(Math.max(catalogEntry?.minIntervalMins ?? 5, parseInt(e.target.value) || feed.interval_mins))}
              />
            </div>
          </div>

          {error && <div className="text-xs text-threat-critical bg-threat-critical/10 border border-threat-critical/20 rounded px-3 py-2">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || saved}
              className={cn(
                "flex items-center justify-center gap-2 flex-1 px-4 py-2 rounded-md border text-sm font-medium disabled:opacity-50",
                saved
                  ? "bg-green-500/10 text-green-400 border-green-400/30"
                  : "bg-cyan-400/15 text-cyan-400 border-cyan-400/30 hover:bg-cyan-400/25"
              )}
            >
              {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : saving ? "Saving\u2026" : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
            </button>
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-md border border-[--border-subtle] text-sm text-[--text-secondary] hover:bg-[--surface-overlay]">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══ Feed Analytics Page ══════════════════════════════════════════ */

export function FeedAnalyticsPage() {
  const qc = useQueryClient();
  const { data: feedList, isLoading: loadingFeeds } = useQuery({ queryKey: ["feeds"], queryFn: feeds.list });
  const { data: stats } = useQuery({ queryKey: ["feed-stats"], queryFn: feeds.stats });

  const [showAdd, setShowAdd] = useState(false);
  const [editFeed, setEditFeed] = useState<FeedSchedule | null>(null);
  const [expandedFeed, setExpandedFeed] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [tierFilter, setTierFilter] = useState<number | null>(null);

  const triggerMut = useMutation({
    mutationFn: (id: string) => feeds.trigger(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feeds"] }); qc.invalidateQueries({ queryKey: ["feed-stats"] }); },
  });
  const resetMut = useMutation({
    mutationFn: (id: string) => feeds.resetCircuit(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feeds"] }); },
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => feeds.update(id, { enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feeds"] }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => feeds.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feeds"] }); qc.invalidateQueries({ queryKey: ["feed-stats"] }); },
  });

  const handleCreated = (feed: FeedSchedule) => {
    qc.invalidateQueries({ queryKey: ["feeds"] });
    qc.invalidateQueries({ queryKey: ["feed-stats"] });
    setShowAdd(false);
  };

  const handleUpdated = (feed: FeedSchedule) => {
    qc.invalidateQueries({ queryKey: ["feeds"] });
    setEditFeed(null);
  };

  const filteredFeeds = (feedList ?? []).filter((f) => tierFilter === null || f.tier === tierFilter);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1 flex items-center gap-2">
            <Database className="w-6 h-6 text-cyan-400" />
            Intelligence Feeds
          </h1>
          <p className="text-sm text-[--text-secondary]">Manage feed providers, credentials, schedules, and monitor ingestion health</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[--surface-base] rounded-md border border-[--border-subtle] p-0.5">
            <button onClick={() => setViewMode("table")} className={cn("text-2xs px-2.5 py-1 rounded font-mono transition-colors", viewMode === "table" ? "bg-cyan-400/15 text-cyan-400 font-semibold" : "text-[--text-tertiary] hover:text-[--text-secondary]")}>Table</button>
            <button onClick={() => setViewMode("cards")} className={cn("text-2xs px-2.5 py-1 rounded font-mono transition-colors", viewMode === "cards" ? "bg-cyan-400/15 text-cyan-400 font-semibold" : "text-[--text-tertiary] hover:text-[--text-secondary]")}>Cards</button>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/25 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Feed
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {stats && <SummaryCards stats={stats} />}

      {/* Tier filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setTierFilter(null)}
          className={cn("text-2xs px-2.5 py-1 rounded-md border font-mono transition-colors",
            tierFilter === null ? "bg-cyan-400/15 text-cyan-400 border-cyan-400/30" : "bg-[--surface-base] text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
          )}
        >All ({feedList?.length ?? 0})</button>
        {[1, 2, 3, 4, 5, 6].map((t) => {
          const count = (feedList ?? []).filter((f) => f.tier === t).length;
          if (count === 0) return null;
          const tc = TIER_COLORS[t as FeedTier];
          return (
            <button
              key={t}
              onClick={() => setTierFilter(tierFilter === t ? null : t)}
              className={cn("text-2xs px-2.5 py-1 rounded-md border font-mono transition-colors",
                tierFilter === t ? cn(tc.badge) : "bg-[--surface-base] text-[--text-tertiary] border-[--border-subtle] hover:text-[--text-secondary]"
              )}
            >T{t} ({count})</button>
          );
        })}
      </div>

      {/* Feed Table/Cards */}
      {viewMode === "table" ? (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3">All Feeds ({filteredFeeds.length})</h3>
            {loadingFeeds ? (
              <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading feeds...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[--border-subtle] text-left text-xs text-[--text-tertiary]">
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Feed</th>
                      <th className="pb-2 pr-3">Tier</th>
                      <th className="pb-2 pr-3">Interval</th>
                      <th className="pb-2 pr-3">Last Pull</th>
                      <th className="pb-2 pr-3">New (Last)</th>
                      <th className="pb-2 pr-3">Total (Lifetime)</th>
                      <th className="pb-2 pr-3">Runs</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeeds.map((feed) => {
                      const catalogEntry = INTEL_FEED_MAP[feed.feed_name];
                      return (
                        <tr key={feed.id} className="border-b border-[--border-subtle] last:border-0 group">
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <StatusDot variant={feed.circuit_open ? "alert" : feed.enabled ? "active" : "offline"} />
                              <FeedStatusBadge feed={feed} />
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{catalogEntry?.icon ?? "📡"}</span>
                              <div>
                                <div className="font-medium text-[--text-primary]">{feed.display_name}</div>
                                <div className="text-xs text-[--text-tertiary] flex items-center gap-1.5">
                                  <span className="font-mono">{feed.feed_name}</span>
                                  {feed.requires_key ? <span className="text-amber-400">(key)</span> : null}
                                  {feed.is_custom ? <Badge variant="info" className="text-2xs">Custom</Badge> : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border", (TIER_COLORS[(feed.tier ?? 3) as FeedTier] ?? TIER_COLORS[3]).badge)}>
                              T{feed.tier}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-[--text-secondary] font-mono text-xs">{feed.interval_mins}m</td>
                          <td className="py-2.5 pr-3 text-[--text-secondary] text-xs">{timeAgo(feed.last_run_at)}</td>
                          <td className="py-2.5 pr-3">
                            <span className={cn("font-mono text-xs font-bold", (feed.last_items_new ?? 0) > 0 ? "text-cyan-400" : "text-[--text-tertiary]")}>
                              {feed.last_items_new ?? 0}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-[--text-secondary] font-mono text-xs font-bold">{formatNumber(feed.total_items)}</td>
                          <td className="py-2.5 pr-3 text-[--text-secondary] font-mono text-xs">{feed.total_runs}</td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditFeed(feed)}
                                title="Edit configuration"
                                className="p-1.5 rounded hover:bg-[--surface-overlay] text-[--text-tertiary] hover:text-cyan-400"
                              >
                                <Settings2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => toggleMut.mutate({ id: feed.id, enabled: !feed.enabled })}
                                title={feed.enabled ? "Disable feed" : "Enable feed"}
                                className="p-1.5 rounded hover:bg-[--surface-overlay] text-[--text-tertiary] hover:text-amber-400"
                              >
                                {feed.enabled ? <Power className="w-3.5 h-3.5 text-green-400" /> : <PowerOff className="w-3.5 h-3.5" />}
                              </button>
                              {feed.circuit_open ? (
                                <button onClick={() => resetMut.mutate(feed.id)} title="Reset circuit breaker" className="p-1.5 rounded hover:bg-[--surface-overlay] text-threat-critical hover:text-amber-400">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => triggerMut.mutate(feed.id)}
                                  disabled={triggerMut.isPending}
                                  title="Run now"
                                  className="p-1.5 rounded hover:bg-[--surface-overlay] text-[--text-tertiary] hover:text-green-400 disabled:opacity-50"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {feed.is_custom ? (
                                <button
                                  onClick={() => { if (confirm("Delete this custom feed?")) deleteMut.mutate(feed.id); }}
                                  title="Delete feed"
                                  className="p-1.5 rounded hover:bg-[--surface-overlay] text-[--text-tertiary] hover:text-threat-critical"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Card View */
        <div className="space-y-6">
          {[1, 2, 3, 4, 5, 6].map((tier) => {
            const tierFeeds = filteredFeeds.filter((f) => f.tier === tier);
            if (tierFeeds.length === 0) return null;
            const tc = TIER_COLORS[tier as FeedTier];
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("w-2 h-2 rounded-full", tc.dot)} />
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", tc.badge)}>
                    {TIER_LABELS[tier as FeedTier]}
                  </span>
                  <span className="text-[10px] text-[--text-tertiary]">{tierFeeds.length} feeds</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {tierFeeds.map((feed) => {
                    const catalogEntry = INTEL_FEED_MAP[feed.feed_name];
                    return (
                      <Card key={feed.id} className="overflow-hidden">
                        <CardContent className="!p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xl">{catalogEntry?.icon ?? "📡"}</span>
                              <div className="min-w-0">
                                <div className="font-semibold text-xs text-[--text-primary] truncate">{feed.display_name}</div>
                                <div className="text-[9px] text-[--text-tertiary] font-mono">{feed.feed_name}</div>
                              </div>
                            </div>
                            <FeedStatusBadge feed={feed} />
                          </div>

                          <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                            <div className="bg-[--surface-base] rounded p-1.5">
                              <div className={cn("text-xs font-bold font-mono", (feed.last_items_new ?? 0) > 0 ? "text-cyan-400" : "text-[--text-secondary]")}>
                                {feed.last_items_new ?? 0}
                              </div>
                              <div className="text-[9px] text-[--text-tertiary]">New (Last)</div>
                            </div>
                            <div className="bg-[--surface-base] rounded p-1.5">
                              <div className="text-xs font-bold text-[--text-primary] font-mono">{formatNumber(feed.total_items)}</div>
                              <div className="text-[9px] text-[--text-tertiary]">Total</div>
                            </div>
                            <div className="bg-[--surface-base] rounded p-1.5">
                              <div className="text-xs font-bold text-[--text-primary] font-mono">{feed.interval_mins}m</div>
                              <div className="text-[9px] text-[--text-tertiary]">Interval</div>
                            </div>
                          </div>

                          <div className="text-[10px] text-[--text-tertiary] mb-2">
                            Last pull: <span className="text-[--text-secondary]">{timeAgo(feed.last_run_at)}</span>
                            {feed.last_error && (
                              <div className="text-threat-critical mt-0.5 truncate" title={feed.last_error}>
                                {feed.last_error}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => triggerMut.mutate(feed.id)}
                              disabled={triggerMut.isPending || !!feed.circuit_open}
                              className="flex items-center gap-1 flex-1 justify-center px-2 py-1.5 text-xs rounded-md bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/25 disabled:opacity-50"
                            >
                              <Play className="w-3 h-3" /> Run
                            </button>
                            <button onClick={() => setEditFeed(feed)} title="Edit" className="px-2 py-1.5 rounded-md border border-[--border-subtle] text-[--text-tertiary] hover:text-cyan-400 hover:border-cyan-400/40">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => toggleMut.mutate({ id: feed.id, enabled: !feed.enabled })} title={feed.enabled ? "Disable" : "Enable"} className="px-2 py-1.5 rounded-md border border-[--border-subtle] text-[--text-tertiary] hover:text-amber-400">
                              {feed.enabled ? <Power className="w-3 h-3 text-green-400" /> : <PowerOff className="w-3 h-3" />}
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Ingestions */}
      {stats && stats.recentIngestions.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Recent Ingestions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-subtle] text-left text-xs text-[--text-tertiary]">
                    <th className="pb-2 pr-4">Feed</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">New</th>
                    <th className="pb-2 pr-4">Threats</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentIngestions.slice(0, 20).map((ing, i) => (
                    <tr key={i} className="border-b border-[--border-subtle] last:border-0">
                      <td className="py-2 pr-4 font-medium text-[--text-primary]">{ing.feed_name ?? "\u2014"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={ing.status === "success" ? "low" : "critical"}>{ing.status}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-[--text-secondary] font-mono">{ing.items_new}</td>
                      <td className="py-2 pr-4 text-[--text-secondary] font-mono">{ing.threats_created}</td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{formatDuration(ing.duration_ms)}</td>
                      <td className="py-2 text-[--text-tertiary]">{timeAgo(ing.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {showAdd && <AddFeedModal onCreated={handleCreated} onClose={() => setShowAdd(false)} />}
      {editFeed && <EditFeedModal feed={editFeed} onUpdated={handleUpdated} onClose={() => setEditFeed(null)} />}
    </div>
  );
}

function SummaryCards({ stats }: { stats: FeedStatsData }) {
  const s = stats.summary;
  const cards = [
    { label: "Total Feeds", value: s.total_feeds, sub: `${s.enabled_feeds} enabled`, color: "text-cyan-400" },
    { label: "Circuit Breakers", value: s.circuit_open, sub: s.circuit_open > 0 ? "Needs attention" : "All healthy", color: s.circuit_open > 0 ? "text-threat-critical" : "text-green-400" },
    { label: "Lifetime Runs", value: s.total_runs, sub: "Total pull cycles", color: "text-[--text-primary]" },
    { label: "Lifetime Items", value: s.total_items, sub: "Total IOCs ingested", color: "text-[--text-primary]" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent>
            <div className="text-xs text-[--text-tertiary] mb-1">{c.label}</div>
            <div className={cn("text-2xl font-bold tabular-nums", c.color)}>{formatNumber(c.value ?? 0)}</div>
            <div className="text-xs text-[--text-secondary] mt-1">{c.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
