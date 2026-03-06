import { useState } from "react";
import { X, ChevronLeft, Check, ExternalLink, Zap } from "lucide-react";
import { feeds as feedsApi } from "../lib/api";
import {
  FEED_CATALOG, TIER_GROUPS, TIER_LABELS,
  type FeedType, type FeedTier,
} from "../lib/feedCatalog";
import type { DataFeed } from "../lib/types";

interface Props {
  onCreated: (feed: DataFeed) => void;
  onClose: () => void;
}

const TIER_COLORS: Record<FeedTier, { badge: string; border: string; dot: string }> = {
  free:     { badge: "bg-status-live/10 border-status-live/30 text-status-live",     border: "border-status-live/30",  dot: "bg-status-live" },
  low_cost: { badge: "bg-gold/10 border-gold/30 text-gold",                          border: "border-gold/30",         dot: "bg-gold" },
  paid:     { badge: "bg-purple/10 border-purple/20 text-purple-light",              border: "border-purple/30",       dot: "bg-purple-light" },
};

// ─── Step 1: Platform picker ──────────────────────────────────────────────────

function PlatformPicker({ onSelect }: { onSelect: (ft: FeedType) => void }) {
  const [search, setSearch] = useState("");
  const tiers: FeedTier[] = ["free", "low_cost", "paid"];
  const q = search.toLowerCase();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-100 mb-0.5">Select Platform</h2>
        <p className="text-xs text-slate-500">Choose a data source to connect. Credentials are stored securely.</p>
      </div>
      <input
        className="soc-input w-full"
        placeholder="Search platforms…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="space-y-5 max-h-[420px] overflow-y-auto pr-1">
        {tiers.map((tier) => {
          const items = TIER_GROUPS[tier].filter(
            (f) => !q || f.displayName.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
          );
          if (items.length === 0) return null;
          const tc = TIER_COLORS[tier];
          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${tc.dot}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tc.badge}`}>
                  {TIER_LABELS[tier]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((ft) => (
                  <button
                    key={ft.platform}
                    onClick={() => onSelect(ft)}
                    className={`soc-card !p-3 text-left hover:${tc.border} hover:border-soc-border-bright transition-all group`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xl leading-none">{ft.icon}</span>
                      {ft.implemented && (
                        <span className="text-[9px] font-bold text-status-live border border-status-live/30 px-1.5 py-0.5 rounded-full">LIVE</span>
                      )}
                    </div>
                    <div className="font-semibold text-xs text-slate-200 mb-0.5">{ft.displayName}</div>
                    <div className="text-[9px] text-slate-500 leading-snug line-clamp-2">{ft.description}</div>
                    <div className="text-[9px] font-bold text-slate-600 mt-1.5">{ft.tierCost}</div>
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

// ─── Step 2: Config form ──────────────────────────────────────────────────────

function ConfigForm({
  feedType,
  onBack,
  onCreated,
}: {
  feedType: FeedType;
  onBack: () => void;
  onCreated: (feed: DataFeed) => void;
}) {
  const tc = TIER_COLORS[feedType.tier];
  const [name, setName] = useState(`${feedType.displayName} Monitor`);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [intervalMins, setIntervalMins] = useState(feedType.defaultIntervalMins);
  // settings fields stored as string values keyed by field.key
  const [settings, setSettings] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      feedType.settingsFields.map((f) => [f.key, String(f.default ?? "")])
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function buildSettingsJson(): string {
    const obj: Record<string, unknown> = {};
    for (const field of feedType.settingsFields) {
      const raw = settings[field.key] ?? "";
      if (!raw && !field.required) continue;
      if (field.type === "textarea") {
        // Split textarea into array (one item per non-empty line)
        obj[field.key] = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      } else if (field.type === "number") {
        obj[field.key] = Number(raw);
      } else if (field.type === "boolean") {
        obj[field.key] = raw === "true";
      } else {
        obj[field.key] = raw;
      }
    }
    return JSON.stringify(obj);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const feed = await feedsApi.create({
        name,
        platform: feedType.platform,
        api_key: apiKey || undefined,
        api_secret: apiSecret || undefined,
        settings_json: buildSettingsJson(),
        pull_interval_mins: intervalMins,
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="btn-ghost flex items-center gap-1 !py-1 !px-2">
          <ChevronLeft size={13} /> Back
        </button>
        <span className="text-lg">{feedType.icon}</span>
        <div>
          <div className="font-bold text-slate-100 text-sm">{feedType.displayName}</div>
          <div className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border inline-block ${tc.badge}`}>
            {TIER_LABELS[feedType.tier]} · {feedType.tierCost}
          </div>
        </div>
        <a href={feedType.docsUrl} target="_blank" rel="noopener noreferrer"
          className="ml-auto text-slate-600 hover:text-gold transition-colors">
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Info strip */}
      <div className="soc-card !p-3 bg-soc-bg/50 flex gap-3 text-xs text-slate-400">
        <div className="flex-1"><span className="text-slate-600">Quota: </span>{feedType.quotaInfo}</div>
        <div className="text-slate-600">Min interval: {feedType.minIntervalMins}m</div>
      </div>

      {!feedType.implemented && (
        <div className="soc-card border-gold/20 bg-gold/5 text-xs text-gold flex gap-2 items-start">
          <Zap size={13} className="shrink-0 mt-0.5" />
          <span>
            This platform is <strong>configured but pull execution is not yet implemented</strong>.
            Your credentials will be stored and the feed will appear in the list.
            Pull support will be added in a future release.
          </span>
        </div>
      )}

      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {/* Feed name */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Feed Name *</label>
          <input className="soc-input w-full" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {/* Auth fields */}
        {feedType.authFields.map((af) => (
          <div key={af.key}>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
              {af.label} {af.required && "*"}
            </label>
            <input
              className="soc-input w-full font-mono text-xs"
              type={af.type}
              required={af.required}
              placeholder={af.placeholder ?? ""}
              value={af.key === "api_key" ? apiKey : apiSecret}
              onChange={(e) =>
                af.key === "api_key" ? setApiKey(e.target.value) : setApiSecret(e.target.value)
              }
            />
            {af.help && <div className="text-[10px] text-slate-600 mt-1">{af.help}</div>}
          </div>
        ))}

        {/* Settings fields */}
        {feedType.settingsFields.map((sf) => (
          <div key={sf.key}>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
              {sf.label} {sf.required && "*"}
            </label>
            {sf.type === "textarea" ? (
              <textarea
                className="soc-input w-full font-mono text-xs resize-y min-h-[72px]"
                required={sf.required}
                placeholder={sf.placeholder ?? ""}
                value={settings[sf.key] ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, [sf.key]: e.target.value }))}
              />
            ) : sf.type === "select" && sf.options ? (
              <select
                className="soc-select w-full"
                value={settings[sf.key] ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, [sf.key]: e.target.value }))}
              >
                {sf.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                className="soc-input w-full text-xs"
                type={sf.type === "number" ? "number" : "text"}
                required={sf.required}
                placeholder={sf.placeholder ?? ""}
                value={settings[sf.key] ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, [sf.key]: e.target.value }))}
              />
            )}
            {sf.help && <div className="text-[10px] text-slate-600 mt-1">{sf.help}</div>}
          </div>
        ))}

        {/* Pull interval */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Pull Interval (minutes)</label>
          <input
            className="soc-input w-full text-xs"
            type="number"
            min={feedType.minIntervalMins}
            max={10080}
            value={intervalMins}
            onChange={(e) => setIntervalMins(Math.max(feedType.minIntervalMins, parseInt(e.target.value) || feedType.defaultIntervalMins))}
          />
          <div className="text-[10px] text-slate-600 mt-1">
            Minimum for this platform: {feedType.minIntervalMins} min. Cron runs every 30 min.
          </div>
        </div>
      </div>

      {error && <div className="text-xs text-threat-critical bg-threat-critical/10 border border-threat-critical/20 rounded px-3 py-2">{error}</div>}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-gold flex items-center gap-2 flex-1 justify-center">
          {saving ? "Saving…" : <><Check size={13} /> Add Feed</>}
        </button>
        <button type="button" onClick={onBack} disabled={saving} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export function AddFeedModal({ onCreated, onClose }: Props) {
  const [selected, setSelected] = useState<FeedType | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(4px)" }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-soc-card border border-soc-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 btn-icon !p-1.5">
          <X size={14} />
        </button>
        {selected
          ? <ConfigForm feedType={selected} onBack={() => setSelected(null)} onCreated={onCreated} />
          : <PlatformPicker onSelect={setSelected} />}
      </div>
    </div>
  );
}

export default AddFeedModal;
