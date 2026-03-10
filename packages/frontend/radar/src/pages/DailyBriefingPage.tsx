import { useQuery } from "@tanstack/react-query";
import { briefings, type Briefing } from "../lib/api";
import { Card, CardContent, Badge } from "../components/ui";

function timeAgo(date: string | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function BriefingCard({ briefing }: { briefing: Briefing }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let content: Record<string, any> = {};
  try { if (briefing.body) content = JSON.parse(briefing.body); } catch { /* ignore */ }

  const summary = content.summary as Record<string, unknown> | undefined;
  const riskLevel = (content.riskLevel as string) ?? briefing.severity ?? "unknown";

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[--text-primary]">{briefing.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={riskLevel === "ELEVATED" ? "critical" : riskLevel === "GUARDED" ? "medium" : "low"}>
                {riskLevel}
              </Badge>
              <span className="text-xs text-[--text-tertiary]">{timeAgo(briefing.created_at)}</span>
              <Badge variant={briefing.status === "published" ? "low" : "info"}>{briefing.status}</Badge>
            </div>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total Threats", value: (summary.totalThreats as number) ?? 0 },
              { label: "Critical", value: ((summary.bySeverity as Record<string, number>)?.critical) ?? 0, color: "text-threat-critical" },
              { label: "High", value: ((summary.bySeverity as Record<string, number>)?.high) ?? 0, color: "text-threat-high" },
              { label: "Resolved", value: (summary.resolved as number) ?? 0, color: "text-green-400" },
            ].map((c) => (
              <div key={c.label} className="p-2 rounded bg-[--surface-base] border border-[--border-subtle]">
                <div className="text-[10px] text-[--text-tertiary]">{c.label}</div>
                <div className={`text-lg font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {content.topThreatTypes && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-[--text-secondary] mb-1.5">Top Threat Types</h4>
            <div className="flex flex-wrap gap-1.5">
              {(content.topThreatTypes as Array<{ type: string; cnt: number }>).map((t) => (
                <span key={t.type} className="text-xs px-2 py-0.5 rounded bg-[--surface-base] border border-[--border-subtle] text-[--text-secondary]">
                  {t.type}: {t.cnt}
                </span>
              ))}
            </div>
          </div>
        )}

        {content.criticalHighlights && (content.criticalHighlights as unknown[]).length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-[--text-secondary] mb-1.5">Critical Highlights</h4>
            <div className="space-y-1">
              {(content.criticalHighlights as Array<{ title: string; type: string; source: string }>).slice(0, 5).map((h, i) => (
                <div key={i} className="text-xs text-[--text-secondary] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-threat-critical shrink-0" />
                  <span className="truncate">{h.title}</span>
                  <span className="text-[--text-tertiary] shrink-0">{h.source}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {briefing.summary && !content.summary && (
          <p className="text-sm text-[--text-secondary]">{briefing.summary}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DailyBriefingPage() {
  const { data: briefingList, isLoading } = useQuery({ queryKey: ["briefings"], queryFn: briefings.list });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Daily Briefing</h1>
        <p className="text-sm text-[--text-secondary]">AI-generated threat intelligence briefings</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading briefings...</div>
      ) : (briefingList ?? []).length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h3 className="text-lg font-semibold text-[--text-primary] mb-2">No Briefings Yet</h3>
              <p className="text-sm text-[--text-tertiary] max-w-md">
                Briefings are generated by the Executive Intel agent. Trigger it from the Agent Hub to create your first briefing.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(briefingList ?? []).map((b) => (
            <BriefingCard key={b.id} briefing={b} />
          ))}
        </div>
      )}
    </div>
  );
}
