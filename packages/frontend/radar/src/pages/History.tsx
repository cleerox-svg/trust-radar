import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { scans, type ScanResult } from "../lib/api";

const RISK_COLOR: Record<string, string> = {
  safe: "text-radar-green",
  low: "text-sky-400",
  medium: "text-radar-yellow",
  high: "text-orange-400",
  critical: "text-radar-red",
};

export default function History() {
  const [items, setItems] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    scans.history()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-radar-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Scan History</h1>
        <Link to="/scan" className="btn-primary text-sm py-2">New scan</Link>
      </div>

      {error && <div className="card border-radar-red/30 text-radar-red text-sm">{error}</div>}

      {items.length === 0 && !error ? (
        <div className="card text-center space-y-3 py-16">
          <div className="text-4xl">🔍</div>
          <p className="text-radar-muted">No scans yet. Run your first analysis.</p>
          <Link to="/scan" className="btn-primary inline-block text-sm">Start scanning</Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-radar-border text-xs text-radar-muted uppercase tracking-wider">
                <th className="text-left px-5 py-3">Domain</th>
                <th className="text-left px-5 py-3">Score</th>
                <th className="text-left px-5 py-3">Risk</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={item.id}
                  className={`border-b border-radar-border last:border-0 hover:bg-radar-border/30 transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                >
                  <td className="px-5 py-4">
                    <div className="font-mono text-sm text-slate-200 truncate max-w-[200px]">{item.domain}</div>
                    <div className="font-mono text-xs text-radar-muted truncate max-w-[200px]">{item.url}</div>
                  </td>
                  <td className="px-5 py-4 font-mono font-bold">
                    <span className={item.trust_score >= 70 ? "score-safe" : item.trust_score >= 40 ? "score-medium" : "score-high"}>
                      {item.trust_score}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${RISK_COLOR[item.risk_level]}`}>
                      {item.risk_level}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-radar-muted hidden sm:table-cell">
                    {new Date(item.created_at).toLocaleDateString()}
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
