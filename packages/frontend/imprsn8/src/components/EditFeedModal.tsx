/**
 * EditFeedModal — pre-populated config form for updating an existing DataFeed.
 * Mirrors ConfigForm in AddFeedModal but calls feedsApi.update() instead of create().
 * Masked auth values (****xxxx) are left unchanged unless the user types a new value.
 */
import { useState } from "react";
import { X, ChevronLeft, Check, ExternalLink, Zap, Save } from "lucide-react";
import { feeds as feedsApi } from "../lib/api";
import { FEED_CATALOG_MAP, TIER_LABELS, type FeedTier } from "../lib/feedCatalog";
import type { DataFeed } from "../lib/types";

const TIER_COLORS: Record<FeedTier, { badge: string }> = {
  free:     { badge: "bg-status-live/10 border-status-live/30 text-status-live" },
  low_cost: { badge: "bg-gold/10 border-gold/30 text-gold" },
  paid:     { badge: "bg-purple/10 border-purple/20 text-purple-light" },
};

/** Parse settings_json back into string-keyed form values for the edit form. */
function parseSettingsJson(json: string): Record<string, string> {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) {
        out[k] = (v as string[]).join("\n");
      } else {
        out[k] = String(v ?? "");
      }
    }
    return out;
  } catch {
    return {};
  }
}

function isMasked(val: string | null): boolean {
  if (!val) return false;
  return /^\*+/.test(val);
}

interface Props {
  feed: DataFeed;
  onUpdated: (feed: DataFeed) => void;
  onClose: () => void;
}

export function EditFeedModal({ feed, onUpdated, onClose }: Props) {
  const feedType = FEED_CATALOG_MAP[feed.platform as keyof typeof FEED_CATALOG_MAP];
  const tier = (feed.tier ?? "free") as FeedTier;
  const tc = TIER_COLORS[tier] ?? TIER_COLORS.free;

  // Pre-populate from existing feed
  const [name, setName] = useState(feed.name);
  const [apiKey, setApiKey] = useState("");            // blank = keep existing masked value
  const [apiSecret, setApiSecret] = useState("");      // blank = keep existing masked value
  const [intervalMins, setIntervalMins] = useState(feed.pull_interval_mins);
  const [settings, setSettings] = useState<Record<string, string>>(() =>
    parseSettingsJson(feed.settings_json ?? "{}")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  if (!feedType) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(4px)" }}>
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-soc-card border border-soc-border rounded-2xl shadow-2xl w-full max-w-xl p-6">
          <button onClick={onClose} className="absolute top-4 right-4 btn-icon !p-1.5"><X size={14} /></button>
          <p className="text-slate-400 text-sm">Unknown platform: <code className="text-gold">{feed.platform}</code>. Cannot edit.</p>
        </div>
      </div>
    );
  }

  function buildSettingsJson(): string {
    const obj: Record<string, unknown> = {};
    for (const field of feedType.settingsFields) {
      const raw = settings[field.key] ?? "";
      if (!raw && !field.required) continue;
      if (field.type === "textarea") {
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
      const patch: Parameters<typeof feedsApi.update>[1] = {
        name,
        settings_json: buildSettingsJson(),
        pull_interval_mins: intervalMins,
      };
      // Only send auth fields if the user typed something new (not just a masked placeholder)
      if (apiKey && !isMasked(apiKey))   patch.api_key    = apiKey;
      if (apiSecret && !isMasked(apiSecret)) patch.api_secret = apiSecret;

      const updated = await feedsApi.update(feed.id, patch);
      setSaved(true);
      setTimeout(() => {
        onUpdated(updated);
        onClose();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update feed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(4px)" }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-soc-card border border-soc-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 btn-icon !p-1.5"><X size={14} /></button>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex items-center gap-1 !py-1 !px-2">
              <ChevronLeft size={13} /> Back
            </button>
            <span className="text-lg">{feedType.icon}</span>
            <div>
              <div className="font-bold text-slate-100 text-sm">{feedType.displayName}</div>
              <div className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border inline-block ${tc.badge}`}>
                {TIER_LABELS[tier]} · {feedType.tierCost}
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
              <span>Pull execution is <strong>not yet implemented</strong> for this platform. Settings will be saved.</span>
            </div>
          )}

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {/* Feed name */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Feed Name *</label>
              <input className="soc-input w-full" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {/* Auth fields — show placeholder hint if masked */}
            {feedType.authFields.map((af) => {
              const existingMasked = af.key === "api_key" ? feed.api_key : feed.api_secret;
              const currentVal     = af.key === "api_key" ? apiKey : apiSecret;
              return (
                <div key={af.key}>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    {af.label} {af.required && <span className="text-slate-600">(leave blank to keep existing)</span>}
                  </label>
                  <input
                    className="soc-input w-full font-mono text-xs"
                    type={af.type}
                    placeholder={existingMasked ? existingMasked : (af.placeholder ?? "")}
                    value={currentVal}
                    onChange={(e) =>
                      af.key === "api_key" ? setApiKey(e.target.value) : setApiSecret(e.target.value)
                    }
                  />
                  {af.help && <div className="text-[10px] text-slate-600 mt-1">{af.help}</div>}
                </div>
              );
            })}

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
                onChange={(e) =>
                  setIntervalMins(Math.max(feedType.minIntervalMins, parseInt(e.target.value) || feed.pull_interval_mins))
                }
              />
              <div className="text-[10px] text-slate-600 mt-1">Minimum: {feedType.minIntervalMins} min</div>
            </div>
          </div>

          {error && (
            <div className="text-xs text-threat-critical bg-threat-critical/10 border border-threat-critical/20 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || saved}
              className={`flex items-center gap-2 flex-1 justify-center ${
                saved ? "btn-ghost !border-status-live/40 !text-status-live" : "btn-gold"
              }`}
            >
              {saved ? <><Check size={13} /> Saved</> : saving ? "Saving…" : <><Save size={13} /> Save Changes</>}
            </button>
            <button type="button" onClick={onClose} disabled={saving} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditFeedModal;
