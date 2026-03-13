import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { emailAuth, type EmailAuthReport } from "../lib/api";
import { Card, CardContent, Badge } from "../components/ui";

const resultColors: Record<string, "low" | "critical" | "medium" | "high" | "info"> = {
  pass: "low", fail: "critical", softfail: "medium", neutral: "info", none: "high",
};

export function EmailAuthPage() {
  const [domain, setDomain] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["email-auth", domain],
    queryFn: () => emailAuth.list(domain || undefined),
  });

  const stats = data?.stats ?? {} as Record<string, number>;
  const reports = data?.reports ?? [];
  const byType = (data?.byType ?? []) as Array<{ report_type: string; result: string; count: number }>;

  // Calc pass rate
  const total = (stats.total as number) || 0;
  const passCount = (stats.pass_count as number) || 0;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Email Authentication</h1>
        <p className="text-sm text-[--text-secondary]">SPF/DKIM/DMARC compliance monitoring and reporting</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Reports", value: stats.total ?? 0 },
          { label: "Pass Rate", value: `${passRate}%`, color: passRate >= 80 ? "text-green-400" : "text-threat-medium" },
          { label: "Failures", value: stats.fail_count ?? 0, color: "text-threat-critical" },
          { label: "Soft Fails", value: stats.softfail_count ?? 0, color: "text-threat-medium" },
          { label: "Domains", value: stats.domains ?? 0, color: "text-blue-500" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By Type breakdown */}
      {byType.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Results by Protocol</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {byType.map((r) => (
                <div key={`${r.report_type}-${r.result}`} className="flex items-center justify-between p-2.5 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                  <div>
                    <span className="text-xs font-bold text-[--text-primary] uppercase">{r.report_type}</span>
                    <Badge variant={resultColors[r.result] ?? "info"} className="ml-2">{r.result}</Badge>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[--text-secondary]">{r.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domain filter */}
      <div>
        <input
          type="text"
          placeholder="Filter by domain..."
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full max-w-md text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {/* Report list */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Authentication Reports ({reports.length})</h3>
          {isLoading ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">No email auth reports found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-subtle] text-left text-xs text-[--text-tertiary]">
                    <th className="pb-2 pr-4">Domain</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Result</th>
                    <th className="pb-2 pr-4">Alignment</th>
                    <th className="pb-2 pr-4">Source</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-b border-[--border-subtle] last:border-0">
                      <td className="py-2 pr-4 font-medium text-[--text-primary] font-mono text-xs">{r.domain}</td>
                      <td className="py-2 pr-4 uppercase text-xs text-[--text-secondary]">{r.report_type}</td>
                      <td className="py-2 pr-4"><Badge variant={resultColors[r.result] ?? "info"}>{r.result}</Badge></td>
                      <td className="py-2 pr-4 text-xs text-[--text-tertiary]">{r.alignment ?? "—"}</td>
                      <td className="py-2 pr-4 text-xs text-[--text-tertiary] font-mono">{r.source_domain ?? r.source_ip ?? "—"}</td>
                      <td className="py-2 text-xs text-[--text-tertiary]">{new Date(r.report_date).toLocaleDateString()}</td>
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
