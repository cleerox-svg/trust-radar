import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signals, type Signal } from "../lib/api";
import { Card, CardContent, Badge } from "../components/ui";

export default function SignalsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["signals"], queryFn: () => signals.list(100) });

  const list = data ?? [];
  const filtered = list.filter((s) =>
    !search ||
    s.source.toLowerCase().includes(search.toLowerCase()) ||
    (s.domain ?? "").toLowerCase().includes(search.toLowerCase()) ||
    s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Signals</h1>
          <p className="text-sm text-[--text-secondary]">Incoming radar signals — live feed</p>
        </div>
        <span className="text-xs font-mono text-[--text-tertiary]">{filtered.length} / {list.length} signals</span>
      </div>

      <div>
        <input
          type="text"
          placeholder="Filter by source, domain, tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none"
        />
      </div>

      <Card>
        <CardContent className="!p-0">
          {isLoading ? (
            <div className="text-sm text-[--text-tertiary] py-12 text-center">Loading signals...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-[--border-subtle] text-left text-[--text-tertiary]">
                    <th className="px-4 py-2.5 font-medium">Time</th>
                    <th className="px-4 py-2.5 font-medium">Source</th>
                    <th className="px-4 py-2.5 font-medium">Domain</th>
                    <th className="px-4 py-2.5 font-medium text-right">Range (m)</th>
                    <th className="px-4 py-2.5 font-medium text-right">Intensity</th>
                    <th className="px-4 py-2.5 font-medium">Quality</th>
                    <th className="px-4 py-2.5 font-medium">Risk</th>
                    <th className="px-4 py-2.5 font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-[--text-tertiary]">No signals found</td></tr>
                  )}
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-[--border-subtle] last:border-0 hover:bg-[--surface-raised] transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[--text-tertiary] whitespace-nowrap">{new Date(s.captured_at).toLocaleTimeString()}</td>
                      <td className="px-4 py-2.5"><Badge variant="info">{s.source}</Badge></td>
                      <td className="px-4 py-2.5 font-mono text-[--text-primary]">{s.domain ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-right text-[--text-primary]">{s.range_m.toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-mono text-right text-cyan-400">{s.intensity_dbz} dBZ</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={s.quality >= 80 ? "low" : s.quality >= 50 ? "medium" : "critical"}>{s.quality}%</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {s.risk_level && <Badge variant={s.risk_level as "critical" | "high" | "medium" | "low"}>{s.risk_level}</Badge>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {s.tags.map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[--surface-base] text-[--text-tertiary] font-mono">{t}</span>
                          ))}
                        </div>
                      </td>
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
