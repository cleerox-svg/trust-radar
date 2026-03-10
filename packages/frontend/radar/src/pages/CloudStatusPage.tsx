import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cloudIncidents, type CloudIncident } from "../lib/api";
import { Card, CardContent, Badge } from "../components/ui";
import { StatusDot } from "../components/ui/StatusDot";

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const severityBadge: Record<string, "critical" | "high" | "medium" | "low" | "info"> = {
  critical: "critical", major: "high", minor: "medium", maintenance: "info",
};

const statusVariant: Record<string, "active" | "alert" | "scanning" | "idle" | "offline"> = {
  investigating: "alert", identified: "scanning", monitoring: "scanning", resolved: "active", postmortem: "idle",
};

export function CloudStatusPage() {
  const [provider, setProvider] = useState<string | undefined>();
  const [activeOnly, setActiveOnly] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["cloud-incidents", provider, activeOnly],
    queryFn: () => cloudIncidents.list(provider, activeOnly),
  });

  const stats = data?.stats ?? {} as Record<string, number>;
  const incidents = data?.incidents ?? [];
  const byProvider = (data?.byProvider ?? []) as Array<{ provider: string; count: number; active: number }>;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Cloud Status</h1>
        <p className="text-sm text-[--text-secondary]">CSP, SaaS, and social platform incident monitoring</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Incidents", value: stats.total ?? 0 },
          { label: "Active", value: stats.active ?? 0, color: "text-threat-critical" },
          { label: "Critical", value: stats.critical ?? 0, color: "text-threat-high" },
          { label: "Providers", value: stats.providers ?? 0, color: "text-cyan-400" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Provider breakdown */}
      {byProvider.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3">By Provider</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {byProvider.map((p) => (
                <button
                  key={p.provider}
                  onClick={() => setProvider(provider === p.provider ? undefined : p.provider)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    provider === p.provider
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-[--border-subtle] bg-[--surface-base] hover:border-[--border-default]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot variant={p.active > 0 ? "alert" : "active"} />
                    <span className="text-xs font-medium text-[--text-primary] truncate">{p.provider}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-bold text-[--text-primary] tabular-nums">{p.count}</span>
                    {p.active > 0 && <span className="text-xs text-threat-critical">{p.active} active</span>}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[--text-secondary] cursor-pointer">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="rounded border-[--border-subtle]"
          />
          Active incidents only
        </label>
        {provider && (
          <button
            onClick={() => setProvider(undefined)}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Incident list */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Incidents ({incidents.length})</h3>
          {isLoading ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading...</div>
          ) : incidents.length === 0 ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">No incidents found</div>
          ) : (
            <div className="space-y-3">
              {incidents.map((inc) => (
                <div key={inc.id} className="flex items-start gap-4 p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                  <StatusDot variant={statusVariant[inc.status] ?? "idle"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-cyan-400">{inc.provider}</span>
                      <span className="text-xs text-[--text-tertiary]">{inc.service}</span>
                      <Badge variant={severityBadge[inc.severity] ?? "info"}>{inc.severity}</Badge>
                      <Badge variant={inc.status === "resolved" ? "low" : "medium"}>{inc.status}</Badge>
                    </div>
                    <h4 className="text-sm font-medium text-[--text-primary] mb-0.5">{inc.title}</h4>
                    {inc.description && <p className="text-xs text-[--text-tertiary] line-clamp-2">{inc.description}</p>}
                    <div className="text-xs text-[--text-tertiary] mt-1">
                      Started: {timeAgo(inc.started_at)}
                      {inc.resolved_at && <span className="ml-2">· Resolved: {timeAgo(inc.resolved_at)}</span>}
                      {inc.impact && <span className="ml-2">· Impact: {inc.impact}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
