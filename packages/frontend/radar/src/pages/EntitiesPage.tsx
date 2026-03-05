import { useEffect, useState } from "react";
import { scans, ScanResult } from "../lib/api";

function riskColor(r: ScanResult["risk_level"]) {
  const map: Record<string, string> = {
    safe:     "text-radar-green",
    low:      "text-radar-blue",
    medium:   "text-radar-yellow",
    high:     "text-radar-orange",
    critical: "text-radar-red",
  };
  return map[r] ?? "text-radar-muted";
}

function riskBg(r: ScanResult["risk_level"]) {
  const map: Record<string, string> = {
    safe:     "bg-radar-green/10 border-radar-green/30",
    low:      "bg-radar-blue/10 border-radar-blue/30",
    medium:   "bg-radar-yellow/10 border-radar-yellow/30",
    high:     "bg-radar-orange/10 border-radar-orange/30",
    critical: "bg-radar-red/10 border-radar-red/30",
  };
  return map[r] ?? "bg-radar-border/30 border-radar-border";
}

function ScoreRing({ score }: { score: number }) {
  const r = 18; const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const dash = (pct / 100) * c;
  const color = score >= 80 ? "#00ff88" : score >= 50 ? "#f59e0b" : "#ff4444";
  return (
    <svg width="44" height="44" className="rotate-[-90deg]">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#1a2744" strokeWidth="3" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s" }} />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="10" fontWeight="700" className="rotate-90 origin-center" style={{ transform: "rotate(90deg)", transformOrigin: "22px 22px" }}>
        {score}
      </text>
    </svg>
  );
}

export default function EntitiesPage() {
  const [data, setData] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  useEffect(() => {
    scans.history(100)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter((s) => {
    const matchSearch = !search ||
      s.domain.toLowerCase().includes(search.toLowerCase()) ||
      s.url.toLowerCase().includes(search.toLowerCase());
    const matchRisk = riskFilter === "all" || s.risk_level === riskFilter;
    return matchSearch && matchRisk;
  });

  const riskCounts = data.reduce<Record<string, number>>((acc, s) => {
    acc[s.risk_level] = (acc[s.risk_level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-radar-text">Entities</h1>
          <p className="text-xs text-radar-muted mt-0.5">Tracked domains and URLs from scan history</p>
        </div>
        <div className="text-xs font-mono text-radar-muted">{filtered.length} entities</div>
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {(["safe", "low", "medium", "high", "critical"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRiskFilter(riskFilter === r ? "all" : r)}
            className={`stat-card text-center cursor-pointer hover:border-radar-border-2 transition-colors ${
              riskFilter === r ? riskBg(r) : ""
            }`}
          >
            <div className={`text-lg font-bold font-mono ${riskColor(r)}`}>
              {riskCounts[r] ?? 0}
            </div>
            <div className="text-[10px] text-radar-muted capitalize">{r}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search domain or URL…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {riskFilter !== "all" && (
          <button className="btn-ghost text-xs" onClick={() => setRiskFilter("all")}>
            Clear filter
          </button>
        )}
      </div>

      {error && (
        <div className="card border-radar-red/30 bg-radar-red/5 text-radar-red text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-radar-muted text-sm animate-pulse">
          Loading entities…
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-radar-border bg-radar-sidebar">
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Score</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Domain</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Risk</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Country</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">SSL</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">VirusTotal</th>
                <th className="text-left px-4 py-2.5 text-radar-muted font-medium">Scanned</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-radar-muted">
                    No entities found
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
                  <td className="px-4 py-2">
                    <ScoreRing score={s.trust_score} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-mono text-radar-text">{s.domain}</div>
                    <div className="text-radar-muted truncate max-w-[200px]">{s.url}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${riskBg(s.risk_level)} ${riskColor(s.risk_level)}`}>
                      {s.risk_level}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-radar-muted">{s.metadata.country ?? "—"}</td>
                  <td className="px-4 py-2">
                    {s.metadata.ssl_valid === undefined ? (
                      <span className="text-radar-muted">—</span>
                    ) : s.metadata.ssl_valid ? (
                      <span className="text-radar-green font-mono">✓ valid</span>
                    ) : (
                      <span className="text-radar-red font-mono">✗ invalid</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {s.metadata.virustotal ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-radar-red">{s.metadata.virustotal.malicious}m</span>
                        <span className="text-radar-yellow">{s.metadata.virustotal.suspicious}s</span>
                        <span className="text-radar-green">{s.metadata.virustotal.harmless}h</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2 text-radar-muted whitespace-nowrap">
                    {new Date(s.created_at).toLocaleDateString()}
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
