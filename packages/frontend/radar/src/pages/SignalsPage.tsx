import { useEffect, useState } from "react";
import { signals, Signal } from "../lib/api";

function qualityClass(q: number) {
  if (q >= 80) return "quality-high";
  if (q >= 50) return "quality-mid";
  return "quality-low";
}

function sourceClass(src: string) {
  const s = src.toLowerCase();
  if (s.startsWith("alpha")) return "badge-alpha";
  if (s.startsWith("beta"))  return "badge-beta";
  if (s.startsWith("gamma")) return "badge-gamma";
  return "badge-node";
}

function riskBadge(r?: string) {
  const map: Record<string, string> = {
    safe:     "bg-radar-green/15 text-radar-green",
    low:      "bg-radar-blue/15 text-radar-blue",
    medium:   "bg-radar-yellow/15 text-radar-yellow",
    high:     "bg-radar-orange/15 text-radar-orange",
    critical: "bg-radar-red/15 text-radar-red",
  };
  if (!r) return null;
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${map[r] ?? "bg-radar-border text-radar-muted"}`}>
      {r}
    </span>
  );
}

export default function SignalsPage() {
  const [data, setData] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    signals.list(100)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter((s) =>
    !search ||
    s.source.toLowerCase().includes(search.toLowerCase()) ||
    (s.domain ?? "").toLowerCase().includes(search.toLowerCase()) ||
    s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-radar-text">Signals</h1>
          <p className="text-xs text-radar-muted mt-0.5">Incoming radar signals — live feed</p>
        </div>
        <div className="text-xs font-mono text-radar-muted">
          {filtered.length} / {data.length} signals
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          className="input max-w-xs"
          placeholder="Filter by source, domain, tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 text-radar-muted text-sm animate-pulse">
          Loading signals…
        </div>
      )}
      {error && (
        <div className="card border-radar-red/30 bg-radar-red/5 text-radar-red text-sm">{error}</div>
      )}

      {!loading && !error && (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-radar-border bg-radar-sidebar">
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Time</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Source</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Domain</th>
                <th className="text-right px-4 py-2.5 text-radar-muted font-medium">Range (m)</th>
                <th className="text-right px-4 py-2.5 text-radar-muted font-medium">Intensity</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Quality</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Risk</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-radar-muted">
                    No signals found
                  </td>
                </tr>
              )}
              {filtered.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-radar-border/50 hover:bg-radar-sidebar/50 transition-colors ${
                    i % 2 === 0 ? "" : "bg-radar-sidebar/20"
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono text-radar-muted whitespace-nowrap">
                    {new Date(s.captured_at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`badge-source ${sourceClass(s.source)}`}>{s.source}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-radar-text">{s.domain ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-right text-radar-text">{s.range_m.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-right text-radar-cyan">{s.intensity_dbz} dBZ</td>
                  <td className="px-4 py-2.5">
                    <span className={qualityClass(s.quality)}>{s.quality}%</span>
                  </td>
                  <td className="px-4 py-2.5">{riskBadge(s.risk_level)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {s.tags.map((t) => (
                        <span key={t} className="bg-radar-border text-radar-muted rounded px-1.5 py-0.5 text-[10px] font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
