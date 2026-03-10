import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { scans, type ScanResult } from "../lib/api";
import { Card, CardContent, Badge, Button, ScoreRing } from "../components/ui";

export default function History() {
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const { data, isLoading } = useQuery({ queryKey: ["scan-history"], queryFn: () => scans.history(100) });

  const list = data ?? [];
  const filtered = riskFilter === "all" ? list : list.filter((s) => s.risk_level === riskFilter);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Scan History</h1>
          <p className="text-sm text-[--text-secondary]">Previous URL analysis results</p>
        </div>
        <Link to="/scan"><Button variant="default" size="sm">New Scan</Button></Link>
      </div>

      {/* Risk filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "safe", "low", "medium", "high", "critical"].map((r) => (
          <button
            key={r}
            onClick={() => setRiskFilter(r)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              riskFilter === r
                ? "border-cyan-500 bg-cyan-500/15 text-cyan-400"
                : "border-[--border-subtle] text-[--text-tertiary] hover:text-[--text-secondary]"
            }`}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
            {r !== "all" && <span className="ml-1 opacity-70">{list.filter((s) => s.risk_level === r).length}</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-[--text-tertiary] py-12 text-center">Loading history...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h3 className="text-lg font-semibold text-[--text-primary] mb-2">No Scans Yet</h3>
              <p className="text-sm text-[--text-tertiary] max-w-md mb-4">Run your first analysis to see results here.</p>
              <Link to="/scan"><Button>Start Scanning</Button></Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-subtle] text-left text-xs text-[--text-tertiary]">
                    <th className="px-4 py-2.5 font-medium">Score</th>
                    <th className="px-4 py-2.5 font-medium">Domain</th>
                    <th className="px-4 py-2.5 font-medium">Risk</th>
                    <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b border-[--border-subtle] last:border-0 hover:bg-[--surface-raised] transition-colors">
                      <td className="px-4 py-2.5"><ScoreRing score={item.trust_score} size="sm" /></td>
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-sm text-[--text-primary] truncate max-w-[200px]">{item.domain}</div>
                        <div className="font-mono text-xs text-[--text-tertiary] truncate max-w-[200px]">{item.url}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={item.risk_level as "critical" | "high" | "medium" | "low"}>{item.risk_level}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-[--text-tertiary] hidden sm:table-cell">{new Date(item.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
