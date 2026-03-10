import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { socialIocs, type SocialIOC } from "../lib/api";
import { Card, CardContent, Badge } from "../components/ui";

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const platformColors: Record<string, string> = {
  twitter: "text-cyan-400",
  reddit: "text-orange-400",
  telegram: "text-blue-400",
  mastodon: "text-purple-400",
  discord: "text-indigo-400",
};

export function SocialIntelPage() {
  const [platform, setPlatform] = useState<string | undefined>();
  const { data, isLoading } = useQuery({
    queryKey: ["social-iocs", platform],
    queryFn: () => socialIocs.list(50, platform),
  });

  const stats = data?.stats ?? {} as Record<string, number>;
  const iocs = data?.iocs ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Social Intel</h1>
        <p className="text-sm text-[--text-secondary]">Community-sourced IOCs with confidence scoring and platform tracking</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total IOCs", value: stats.total ?? 0 },
          { label: "Verified", value: stats.verified ?? 0, color: "text-green-400" },
          { label: "Avg Confidence", value: `${Math.round(stats.avg_confidence ?? 0)}%`, color: "text-cyan-400" },
          { label: "Platforms", value: stats.platforms ?? 0 },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "twitter", "reddit", "telegram", "mastodon", "discord"].map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p === "all" ? undefined : p)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              (p === "all" && !platform) || p === platform
                ? "border-cyan-500 bg-cyan-500/15 text-cyan-400"
                : "border-[--border-subtle] text-[--text-tertiary] hover:text-[--text-secondary]"
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* IOC List */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">IOC Feed ({iocs.length})</h3>
          {isLoading ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading...</div>
          ) : iocs.length === 0 ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">No IOCs found</div>
          ) : (
            <div className="space-y-3">
              {iocs.map((ioc) => (
                <div key={ioc.id} className="flex items-center gap-4 p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold uppercase ${platformColors[ioc.platform] ?? "text-[--text-secondary]"}`}>
                        {ioc.platform}
                      </span>
                      <span className="text-sm font-mono text-[--text-primary] truncate">{ioc.ioc_value}</span>
                      {ioc.verified ? <Badge variant="low">Verified</Badge> : null}
                    </div>
                    <div className="text-xs text-[--text-tertiary]">
                      {ioc.ioc_type} · @{ioc.author} · Confidence: {ioc.confidence}% · {timeAgo(ioc.captured_at)}
                      {ioc.context && <span className="ml-2 text-[--text-secondary]">— {ioc.context}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={ioc.confidence >= 80 ? "high" : ioc.confidence >= 50 ? "medium" : "low"}>
                      {ioc.confidence}%
                    </Badge>
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
