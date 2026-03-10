import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { scans, type ScanResult } from "../lib/api";
import { Card, CardContent, Badge, ScoreRing } from "../components/ui";

export default function EntitiesPage() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const { data, isLoading } = useQuery({ queryKey: ["entities"], queryFn: () => scans.history(100) });

  const list = data ?? [];
  const filtered = list.filter((s) => {
    const matchSearch = !search || s.domain.toLowerCase().includes(search.toLowerCase()) || s.url.toLowerCase().includes(search.toLowerCase());
    const matchRisk = riskFilter === "all" || s.risk_level === riskFilter;
    return matchSearch && matchRisk;
  });

  const riskCounts = list.reduce<Record<string, number>>((acc, s) => {
    acc[s.risk_level] = (acc[s.risk_level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Entities</h1>
          <p className="text-sm text-[--text-secondary]">Tracked domains and URLs from scan history</p>
        </div>
        <span className="text-xs font-mono text-[--text-tertiary]">{filtered.length} entities</span>
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {(["safe", "low", "medium", "high", "critical"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRiskFilter(riskFilter === r ? "all" : r)}
            className={`p-3 rounded-lg border text-center transition-colors ${
              riskFilter === r
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-[--border-subtle] bg-[--surface-raised] hover:border-[--border-default]"
            }`}
          >
            <div className={`text-lg font-bold font-mono ${
              r === "critical" ? "text-threat-critical" : r === "high" ? "text-threat-high" :
              r === "medium" ? "text-threat-medium" : r === "low" ? "text-cyan-400" : "text-green-400"
            }`}>
              {riskCounts[r] ?? 0}
            </div>
            <div className="text-[10px] text-[--text-tertiary] capitalize">{r}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search domain or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none"
        />
        {riskFilter !== "all" && (
          <button onClick={() => setRiskFilter("all")} className="text-xs text-cyan-400 hover:text-cyan-300">Clear filter</button>
        )}
      </div>

      <Card>
        <CardContent className="!p-0">
          {isLoading ? (
            <div className="text-sm text-[--text-tertiary] py-12 text-center">Loading entities...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="border-b border-[--border-subtle] text-left text-[--text-tertiary]">
                    <th className="px-4 py-2.5 font-medium">Score</th>
                    <th className="px-4 py-2.5 font-medium">Domain</th>
                    <th className="px-4 py-2.5 font-medium">Risk</th>
                    <th className="px-4 py-2.5 font-medium">Country</th>
                    <th className="px-4 py-2.5 font-medium">SSL</th>
                    <th className="px-4 py-2.5 font-medium">VirusTotal</th>
                    <th className="px-4 py-2.5 font-medium">Scanned</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-[--text-tertiary]">No entities found</td></tr>
                  )}
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-[--border-subtle] last:border-0 hover:bg-[--surface-raised] transition-colors">
                      <td className="px-4 py-2"><ScoreRing score={s.trust_score} size="sm" /></td>
                      <td className="px-4 py-2">
                        <div className="font-mono text-[--text-primary]">{s.domain}</div>
                        <div className="text-[--text-tertiary] truncate max-w-[200px]">{s.url}</div>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={s.risk_level as "critical" | "high" | "medium" | "low"}>{s.risk_level}</Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-[--text-tertiary]">{s.metadata.country ?? "—"}</td>
                      <td className="px-4 py-2">
                        {s.metadata.ssl_valid === undefined ? (
                          <span className="text-[--text-tertiary]">—</span>
                        ) : s.metadata.ssl_valid ? (
                          <span className="text-green-400 font-mono">Valid</span>
                        ) : (
                          <span className="text-red-400 font-mono">Invalid</span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {s.metadata.virustotal ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-red-400">{s.metadata.virustotal.malicious}m</span>
                            <span className="text-yellow-400">{s.metadata.virustotal.suspicious}s</span>
                            <span className="text-green-400">{s.metadata.virustotal.harmless}h</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2 text-[--text-tertiary] whitespace-nowrap">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
