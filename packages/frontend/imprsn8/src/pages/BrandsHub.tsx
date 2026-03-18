/**
 * Brands Hub — 3-tab system for brand monitoring at scale.
 *
 * Tabs:
 *   1. Under Attack — brands with active threats (red badge)
 *   2. Watchlist — monitored brands
 *   3. All Brands — full catalog with search/sort/pagination
 */

import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search, Shield, ShieldAlert, Eye, EyeOff, ChevronLeft, ChevronRight,
  ExternalLink, AlertTriangle, TrendingUp, Plus, FileText,
} from "lucide-react";
import { brands, type BrandListItem, type BrandTabCounts } from "../lib/api";

type Tab = "under_attack" | "watchlist" | "all";

const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
  { key: "under_attack", label: "Under Attack", icon: <ShieldAlert size={14} /> },
  { key: "watchlist", label: "Watchlist", icon: <Eye size={14} /> },
  { key: "all", label: "All Brands", icon: <Shield size={14} /> },
];

type SortKey = "threats" | "name" | "recent";

const PAGE_SIZE = 30;

export default function BrandsHub() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("under_attack");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("threats");
  const [page, setPage] = useState(0);
  const [addDomain, setAddDomain] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["brands-hub", tab, debouncedSearch, sort, page],
    queryFn: () => brands.list({
      tab,
      q: debouncedSearch || undefined,
      sort,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });

  const monitorMutation = useMutation({
    mutationFn: (domain: string) => brands.monitor({ domain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands-hub"] });
      setAddDomain("");
      setShowAddForm(false);
    },
  });

  const unmonitorMutation = useMutation({
    mutationFn: (brandId: string) => brands.unmonitor(brandId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands-hub"] }),
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const tabs = data?.tabs ?? { under_attack: 0, watchlist: 0, all: 0 };
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleTabChange = useCallback((t: Tab) => {
    setTab(t);
    setPage(0);
  }, []);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Brands Hub
          </h1>
          <p className="text-sm" style={{ color: "var(--text-tertiary)", marginTop: 4 }}>
            Monitor and protect brands at scale
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            background: "var(--accent-primary)", color: "#fff",
            border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
        >
          <Plus size={14} /> Add Brand
        </button>
      </div>

      {/* Add Brand Form */}
      {showAddForm && (
        <div style={{
          background: "var(--surface-overlay)", borderRadius: 12,
          padding: 20, marginBottom: 20,
          border: "1px solid var(--border-subtle)",
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                Domain to monitor
              </label>
              <input
                type="text"
                value={addDomain}
                onChange={e => setAddDomain(e.target.value)}
                placeholder="e.g. acme.com"
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  background: "var(--surface-primary)", color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)", fontSize: 14,
                }}
              />
            </div>
            <button
              onClick={() => addDomain && monitorMutation.mutate(addDomain)}
              disabled={!addDomain || monitorMutation.isPending}
              style={{
                padding: "8px 20px", borderRadius: 8,
                background: monitorMutation.isPending ? "var(--surface-tertiary)" : "var(--accent-primary)",
                color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              {monitorMutation.isPending ? "Adding..." : "Start Monitoring"}
            </button>
          </div>
          {monitorMutation.isError && (
            <p className="text-xs" style={{ color: "var(--semantic-error)", marginTop: 8 }}>
              {(monitorMutation.error as Error)?.message ?? "Failed to add brand"}
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20,
        borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 16px", fontSize: 13, fontWeight: 600,
              background: "none", border: "none", cursor: "pointer",
              color: tab === t.key ? "var(--accent-primary)" : "var(--text-tertiary)",
              borderBottom: tab === t.key ? "2px solid var(--accent-primary)" : "2px solid transparent",
              marginBottom: -1,
              transition: "all 150ms",
            }}
          >
            {t.icon}
            {t.label}
            <span style={{
              fontSize: 11, padding: "1px 6px", borderRadius: 10,
              background: t.key === "under_attack" && tabs.under_attack > 0
                ? "var(--semantic-error)" : "var(--surface-tertiary)",
              color: t.key === "under_attack" && tabs.under_attack > 0
                ? "#fff" : "var(--text-secondary)",
              fontWeight: 700,
            }}>
              {tabs[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search + Sort bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
          <Search size={14} style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-tertiary)",
          }} />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search brands..."
            style={{
              width: "100%", padding: "8px 12px 8px 34px", borderRadius: 8,
              background: "var(--surface-primary)", color: "var(--text-primary)",
              border: "1px solid var(--border-subtle)", fontSize: 13,
            }}
          />
        </div>
        <select
          value={sort}
          onChange={e => { setSort(e.target.value as SortKey); setPage(0); }}
          style={{
            padding: "8px 12px", borderRadius: 8,
            background: "var(--surface-primary)", color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)", fontSize: 13,
          }}
        >
          <option value="threats">Most Threats</option>
          <option value="name">Name A-Z</option>
          <option value="recent">Recently Targeted</option>
        </select>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {total} brand{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Brand Table */}
      <div style={{
        background: "var(--surface-overlay)", borderRadius: 12,
        border: "1px solid var(--border-subtle)", overflow: "hidden",
      }}>
        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 100px 100px 120px 100px",
          padding: "10px 20px", gap: 12,
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--surface-secondary)",
        }}>
          {["Brand", "Source", "Threats", "Active", "Last Seen", "Actions"].map(h => (
            <div key={h} className="text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: "var(--text-tertiary)" }}>{h}</div>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
            Loading brands...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Shield size={32} style={{ color: "var(--text-tertiary)", margin: "0 auto 12px" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              {tab === "under_attack" ? "No brands under active attack" :
               tab === "watchlist" ? "No brands on your watchlist yet" :
               "No brands found"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)", marginTop: 4 }}>
              {tab === "watchlist" ? "Add a domain above to start monitoring" :
               search ? "Try a different search term" : "Import brands from Tranco or add manually"}
            </p>
          </div>
        )}

        {/* Brand rows */}
        {items.map(brand => (
          <BrandRow
            key={brand.id}
            brand={brand}
            onToggleMonitor={() =>
              brand.is_monitored
                ? unmonitorMutation.mutate(brand.id)
                : monitorMutation.mutate(brand.canonical_domain)
            }
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, marginTop: 16,
        }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: "6px 12px", borderRadius: 6,
              background: "var(--surface-overlay)", color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)", cursor: page === 0 ? "default" : "pointer",
              opacity: page === 0 ? 0.5 : 1, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding: "6px 12px", borderRadius: 6,
              background: "var(--surface-overlay)", color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
              cursor: page >= totalPages - 1 ? "default" : "pointer",
              opacity: page >= totalPages - 1 ? 0.5 : 1,
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Brand Row ───────────────────────────────────────────────────

function BrandRow({ brand, onToggleMonitor }: { brand: BrandListItem; onToggleMonitor: () => void }): React.ReactElement {
  const severity = brand.active_threats >= 10 ? "critical" :
    brand.active_threats >= 5 ? "high" :
    brand.active_threats > 0 ? "medium" : "none";

  const severityColor = severity === "critical" ? "var(--semantic-error)" :
    severity === "high" ? "#f59e0b" :
    severity === "medium" ? "var(--accent-primary)" : "var(--text-tertiary)";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "2fr 1fr 100px 100px 120px 100px",
      padding: "12px 20px", gap: 12,
      borderBottom: "1px solid var(--border-subtle)",
      alignItems: "center",
      transition: "background 100ms",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-secondary)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Brand info */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=32`}
          alt=""
          style={{ width: 24, height: 24, borderRadius: 4 }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div style={{ minWidth: 0 }}>
          <Link
            to={`/report/${brand.id}?period=30d`}
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {brand.name}
          </Link>
          <div className="text-xs" style={{ color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {brand.canonical_domain}
          </div>
        </div>
      </div>

      {/* Source */}
      <div>
        <SourceBadge source={brand.source} />
      </div>

      {/* Threats */}
      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {brand.threat_count.toLocaleString()}
      </div>

      {/* Active */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {brand.active_threats > 0 && (
          <AlertTriangle size={12} style={{ color: severityColor }} />
        )}
        <span className="text-sm font-semibold" style={{ color: severityColor }}>
          {brand.active_threats}
        </span>
      </div>

      {/* Last Seen */}
      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {brand.last_threat_seen ? timeAgo(brand.last_threat_seen) : "—"}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onToggleMonitor}
          title={brand.is_monitored ? "Stop monitoring" : "Start monitoring"}
          style={{
            padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-subtle)",
            background: brand.is_monitored ? "var(--accent-primary)" : "var(--surface-primary)",
            color: brand.is_monitored ? "#fff" : "var(--text-secondary)",
            cursor: "pointer", display: "flex", alignItems: "center",
          }}
        >
          {brand.is_monitored ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
        <Link
          to={`/report/${brand.id}?period=30d`}
          title="View report"
          style={{
            padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-subtle)",
            background: "var(--surface-primary)", color: "var(--text-secondary)",
            cursor: "pointer", display: "flex", alignItems: "center", textDecoration: "none",
          }}
        >
          <FileText size={12} />
        </Link>
      </div>
    </div>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────

function SourceBadge({ source }: { source: string | null }) {
  const label = source === "tranco" ? "Tranco" :
    source === "public_assess" ? "Assessment" :
    source === "self_service" ? "Self-Service" :
    source === "manual" ? "Manual" : source ?? "Manual";

  const bg = source === "tranco" ? "#3b82f620" :
    source === "public_assess" ? "#8b5cf620" :
    source === "self_service" ? "#10b98120" : "var(--surface-tertiary)";

  const color = source === "tranco" ? "#3b82f6" :
    source === "public_assess" ? "#8b5cf6" :
    source === "self_service" ? "#10b981" : "var(--text-tertiary)";

  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 10,
      background: bg, color, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {label}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
