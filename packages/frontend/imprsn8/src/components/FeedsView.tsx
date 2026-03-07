/**
 * FeedsView — shared Data Sources panel used in Intelligence page and Admin.
 * Extracted from AdminPage so it can live in the Intelligence tab.
 */
import { useState, useEffect } from "react";
import { Plus, Database, Play, RefreshCw, Zap, Trash2, Pencil } from "lucide-react";
import { feeds as feedsApi } from "../lib/api";
import type { DataFeed } from "../lib/types";
import { AddFeedModal } from "./AddFeedModal";
import { EditFeedModal } from "./EditFeedModal";
import { FEED_CATALOG_MAP, TIER_LABELS, type FeedTier } from "../lib/feedCatalog";

// ─── Tier styles ──────────────────────────────────────────────────────────────
const FEED_TIER_COLORS: Record<FeedTier, { badge: string; dot: string }> = {
  free:     { badge: "bg-status-live/10 border-status-live/30 text-status-live", dot: "bg-status-live" },
  low_cost: { badge: "bg-gold/10 border-gold/30 text-gold",                      dot: "bg-gold" },
  paid:     { badge: "bg-purple/10 border-purple/20 text-purple-light",           dot: "bg-purple-light" },
};

const STATUS_COLORS: Record<string, string> = {
  idle:    "text-slate-500",
  running: "text-gold animate-pulse",
  success: "text-status-live",
  error:   "text-threat-critical",
};

// ─── FeedCard ─────────────────────────────────────────────────────────────────
export function FeedCard({
  feed,
  onTrigger,
  onToggle,
  onDelete,
  onEdit,
}: {
  feed: DataFeed;
  onTrigger: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (feed: DataFeed) => void;
}) {
  const catalog = FEED_CATALOG_MAP[feed.platform as keyof typeof FEED_CATALOG_MAP];
  const tier = (feed.tier ?? "free") as FeedTier;
  const tc = FEED_TIER_COLORS[tier] ?? FEED_TIER_COLORS.free;
  const statusColor = STATUS_COLORS[feed.last_pull_status ?? "idle"] ?? "text-slate-500";
  const lastPull = feed.last_pulled_at
    ? new Date(feed.last_pulled_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Never";

  return (
    <div className={`soc-card transition-all ${feed.is_active ? "" : "opacity-50"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl leading-none shrink-0">{catalog?.icon ?? "📡"}</span>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-slate-200 truncate">{feed.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <div className={`w-1.5 h-1.5 rounded-full ${tc.dot}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${tc.badge}`}>
                {TIER_LABELS[tier]}
              </span>
              <span className="text-[9px] text-slate-600 font-mono">{feed.platform}</span>
            </div>
          </div>
        </div>
        <div className={`text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${statusColor}`}>
          {feed.last_pull_status ?? "idle"}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-soc-bg/60 rounded p-1.5">
          <div className="text-xs font-bold text-slate-200 font-mono">{feed.pull_count ?? 0}</div>
          <div className="text-[9px] text-slate-600">Pulls</div>
        </div>
        <div className="bg-soc-bg/60 rounded p-1.5">
          <div className={`text-xs font-bold font-mono ${(feed.threats_found ?? 0) > 0 ? "text-threat-critical" : "text-slate-200"}`}>
            {feed.threats_found ?? 0}
          </div>
          <div className="text-[9px] text-slate-600">Threats</div>
        </div>
        <div className="bg-soc-bg/60 rounded p-1.5">
          <div className="text-xs font-bold text-slate-200 font-mono">{feed.pull_interval_mins}m</div>
          <div className="text-[9px] text-slate-600">Interval</div>
        </div>
      </div>

      {/* Last pull */}
      <div className="text-[10px] text-slate-600 mb-3">
        Last pull: <span className="text-slate-400">{lastPull}</span>
        {feed.last_pull_error && (
          <div className="text-threat-critical mt-0.5 truncate" title={feed.last_pull_error}>
            ✕ {feed.last_pull_error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={() => onTrigger(feed.id)}
          disabled={feed.last_pull_status === "running"}
          title="Trigger pull now"
          className="btn-gold !px-2 !py-1.5 !text-xs flex items-center gap-1 flex-1 justify-center disabled:opacity-50"
        >
          {feed.last_pull_status === "running"
            ? <><RefreshCw size={11} className="animate-spin" /> Running</>
            : <><Play size={11} /> Run</>}
        </button>
        <button
          onClick={() => onEdit(feed)}
          title="Edit configuration"
          className="btn-ghost !px-2 !py-1.5 !text-xs"
        >
          <Pencil size={11} className="text-slate-400" />
        </button>
        <button
          onClick={() => onToggle(feed.id, !feed.is_active)}
          title={feed.is_active ? "Pause feed" : "Resume feed"}
          className="btn-ghost !px-2 !py-1.5 !text-xs"
        >
          {feed.is_active ? <Zap size={11} className="text-status-live" /> : <Zap size={11} className="text-slate-500" />}
        </button>
        <button
          onClick={() => onDelete(feed.id)}
          title="Delete feed"
          className="btn-icon !p-1.5 hover:text-threat-critical"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── FeedsView ────────────────────────────────────────────────────────────────
export function FeedsView() {
  const [feedList, setFeedList] = useState<DataFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editFeed, setEditFeed] = useState<DataFeed | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);

  async function loadFeeds() {
    setLoading(true);
    try {
      const data = await feedsApi.list();
      setFeedList(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feeds");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFeeds(); }, []);

  async function handleTrigger(id: string) {
    if (triggering) return;
    setTriggering(id);
    setFeedList((prev) => prev.map((f) => f.id === id ? { ...f, last_pull_status: "running" } : f));
    try {
      const result = await feedsApi.trigger(id);
      setFeedList((prev) => prev.map((f) => f.id === id ? result.data : f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trigger failed");
      setFeedList((prev) => prev.map((f) => f.id === id ? { ...f, last_pull_status: "error" } : f));
    } finally {
      setTriggering(null);
    }
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      const updated = await feedsApi.update(id, { is_active: active ? 1 : 0 });
      setFeedList((prev) => prev.map((f) => f.id === id ? updated : f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this feed? This cannot be undone.")) return;
    try {
      await feedsApi.delete(id);
      setFeedList((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function handleUpdated(updated: DataFeed) {
    setFeedList((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    setEditFeed(null);
  }

  function handleCreated(feed: DataFeed) {
    setFeedList((prev) => [...prev, feed]);
    setShowAdd(false);
  }

  const tiers: FeedTier[] = ["free", "low_cost", "paid"];
  const grouped = tiers
    .map((tier) => ({ tier, feeds: feedList.filter((f) => (f.tier ?? "free") === tier) }))
    .filter((g) => g.feeds.length > 0);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {error && <div className="soc-card border-red-500/30 text-red-400 text-sm">{error}</div>}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {feedList.length} feed{feedList.length !== 1 ? "s" : ""} configured
          {feedList.filter((f) => f.is_active).length > 0 && (
            <span className="ml-1.5 text-status-live">
              · {feedList.filter((f) => f.is_active).length} active
            </span>
          )}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-gold flex items-center gap-1.5 !py-1.5 !px-3 !text-xs">
          <Plus size={12} /> Add Feed
        </button>
      </div>

      {/* Empty state */}
      {feedList.length === 0 && (
        <div className="soc-card py-16 text-center space-y-3">
          <Database size={32} className="mx-auto text-slate-700" />
          <div className="text-slate-500 text-sm">No data feeds configured yet.</div>
          <button onClick={() => setShowAdd(true)} className="text-gold text-sm hover:underline">
            Connect your first data source →
          </button>
        </div>
      )}

      {/* Tiered groups */}
      {grouped.map(({ tier, feeds }) => {
        const tc = FEED_TIER_COLORS[tier];
        return (
          <div key={tier}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${tc.dot}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tc.badge}`}>
                {TIER_LABELS[tier]}
              </span>
              <span className="text-[10px] text-slate-600">{feeds.length} feed{feeds.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {feeds.map((feed) => (
                <FeedCard
                  key={feed.id}
                  feed={feed}
                  onTrigger={handleTrigger}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onEdit={setEditFeed}
                />
              ))}
            </div>
          </div>
        );
      })}

      {showAdd && (
        <AddFeedModal
          onCreated={handleCreated}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editFeed && (
        <EditFeedModal
          feed={editFeed}
          onUpdated={handleUpdated}
          onClose={() => setEditFeed(null)}
        />
      )}
    </div>
  );
}
