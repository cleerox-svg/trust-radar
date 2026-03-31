import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

interface BriefingSummary {
  totalThreats: number;
  bySeverity: Record<string, number>;
  activeSources: number;
  resolved: number;
  newLast24h: number;
  riskLevel: string;
}

interface BriefingFeedHealth {
  healthyCount: number;
  staleFeeds: string[];
  recommendations: string[];
}

interface BriefingBody {
  summary: BriefingSummary;
  topBrands: Array<{ brand: string; threatCount: number; severity: string }>;
  topThreatTypes: Array<{ type: string; cnt: number }>;
  topSources: Array<{ source: string; cnt: number }>;
  feedHealth: BriefingFeedHealth;
  trends: Array<{ direction: string; observation: string; significance: string }>;
  campaigns: Array<{ name: string; domainCount: number; severity: string }>;
  topRisks: Array<{ title: string; priority: string; description: string }>;
  recommendations: string[];
  criticalHighlights: Array<{ title: string; type: string; source: string }>;
  period: string;
  riskLevel: string;
  generatedAt: string;
}

interface BriefingRow {
  id: string;
  title: string;
  summary: string;
  body: string;
  severity: string;
  category: string;
  status: string;
  generated_by: string;
  published_at: string;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function freshnessInfo(createdAt: string): { label: string; cls: string } {
  const age = Date.now() - new Date(createdAt).getTime();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  if (age < oneHour) return { label: 'FRESH', cls: 'bg-green-500/20 text-green-400 border-green-500/30' };
  if (age < oneDay) return { label: 'TODAY', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  return { label: 'STALE', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
}

function triggerLabel(generatedBy: string): string {
  if (generatedBy.startsWith('cron')) return 'scheduled';
  return 'manual';
}

function severityDot(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-400';
    case 'high': return 'bg-amber-400';
    case 'medium': return 'bg-yellow-400';
    case 'low': return 'bg-contrail';
    default: return 'bg-green-400';
  }
}

// ─── Sub-components ─────────────────────────────────────────────

function StatCard({ title, metric, metricLabel, children }: {
  title: string;
  metric: string;
  metricLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-cockpit p-4">
      <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3">{title}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {children}
        </div>
        <div className="border-l border-white/10 pl-3 flex flex-col items-center gap-1">
          <div className="text-[32px] font-bold leading-none text-parchment">{metric}</div>
          <div className="text-[9px] text-white/50 uppercase">{metricLabel}</div>
        </div>
      </div>
    </div>
  );
}

function DotRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${count > 0 ? color : 'bg-white/30'}`} />
      <span className="text-[11px] text-white/60 flex-1">{label}</span>
      <span className="text-[11px] font-mono text-white/60">{fmt(count)}</span>
    </div>
  );
}

// ─── Main Widget ────────────────────────────────────────────────

export function DailyBriefingWidget() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: row, isLoading } = useQuery({
    queryKey: ['briefing-latest'],
    queryFn: async () => {
      const res = await api.get<BriefingRow>('/api/briefings/latest');
      return res.data ?? null;
    },
  });

  const handleGenerate = async () => {
    setGenerating(true);
    setToast(null);
    try {
      const res = await api.post<{ data: BriefingRow }>('/api/briefings/generate');
      if (res.success) {
        await queryClient.invalidateQueries({ queryKey: ['briefing-latest'] });
        setToast({ type: 'success', message: 'Briefing generated and emailed to claude.leroux@averrow.com' });
      } else {
        setToast({ type: 'error', message: res.error ?? 'Generation failed' });
      }
    } catch (err) {
      setToast({ type: 'error', message: String(err) });
    } finally {
      setGenerating(false);
    }
  };

  // Parse briefing body
  let briefing: BriefingBody | null = null;
  if (row?.body) {
    try {
      briefing = typeof row.body === 'string' ? JSON.parse(row.body) : row.body as unknown as BriefingBody;
    } catch { /* noop */ }
  }

  const freshness = row ? freshnessInfo(row.created_at) : null;

  // ── Loading state
  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 font-mono text-[11px] text-contrail/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading briefing...
        </div>
      </div>
    );
  }

  // ── Empty state
  if (!row || !briefing) {
    return (
      <div className="glass-card glass-card-amber rounded-xl p-6 space-y-4">
        <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">
          Daily Platform Briefing
        </div>
        <div className="font-mono text-[12px] text-contrail/50">
          No briefing generated yet. Run one to populate this widget.
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 rounded-md bg-[#C83C3C] px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-parchment hover:bg-[#A82E2E] transition-colors disabled:opacity-50"
        >
          {generating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Run Briefing Now
        </button>
        {toast && (
          <div className={`font-mono text-[10px] ${toast.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  // ── Derived data
  const s = briefing.summary;
  const hourlyRate = Math.round(s.newLast24h / 24);
  const topSources = briefing.topSources.slice(0, 5);
  const topBrands = briefing.topBrands.slice(0, 10);
  const anomalies: Array<{ icon: string; text: string; level: 'warn' | 'ok' }> = [];

  // Detect anomalies from feed health
  if (briefing.feedHealth.staleFeeds.length > 0) {
    for (const f of briefing.feedHealth.staleFeeds) {
      anomalies.push({ icon: '\u26A0', text: `${f}: failed recently`, level: 'warn' });
    }
  }
  if (briefing.feedHealth.staleFeeds.length === 0) {
    anomalies.push({ icon: '\u2705', text: 'All ingest feeds healthy', level: 'ok' });
  }
  if (s.riskLevel === 'NORMAL') {
    anomalies.push({ icon: '\u2705', text: 'All agents running', level: 'ok' });
  }

  return (
    <div className="space-y-4">
      {/* ── HEADER BAR ──────────────────────────── */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">
            Daily Platform Briefing
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] text-contrail/50">
              Generated {new Date(row.created_at).toLocaleString()} &middot; {triggerLabel(row.generated_by)}
            </span>
            {freshness && (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${freshness.cls}`}>
                {freshness.label}
              </span>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-md bg-[#C83C3C] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-parchment hover:bg-[#A82E2E] transition-colors disabled:opacity-50"
            >
              {generating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Run Briefing Now
            </button>
          </div>
        </div>
        {toast && (
          <div className={`mt-2 font-mono text-[10px] ${toast.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {toast.message}
          </div>
        )}
      </div>

      {/* ── ROW 1: STAT CARDS ───────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Threats" metric={fmt(s.totalThreats)} metricLabel="total">
          <DotRow color="bg-red-400" label="Critical" count={s.bySeverity.critical ?? 0} />
          <DotRow color="bg-amber-400" label="High" count={s.bySeverity.high ?? 0} />
          <DotRow color="bg-yellow-400" label="Medium" count={s.bySeverity.medium ?? 0} />
          <DotRow color="bg-contrail" label="Low" count={s.bySeverity.low ?? 0} />
        </StatCard>

        <StatCard title="24H Ingest" metric={fmt(s.newLast24h)} metricLabel="new">
          <DotRow color="bg-green-400" label="Sources" count={s.activeSources} />
          <DotRow color="bg-orbital-teal" label="Resolved" count={s.resolved} />
        </StatCard>

        <StatCard title="Hourly Rate" metric={fmt(hourlyRate)} metricLabel="/hr">
          <div className="text-[11px] text-white/50">
            {briefing.period}
          </div>
        </StatCard>

        <StatCard
          title="Risk Level"
          metric={s.riskLevel}
          metricLabel="status"
        >
          <div className="text-[11px] text-white/50">
            {s.riskLevel === 'ELEVATED' ? 'Immediate action needed' : s.riskLevel === 'GUARDED' ? 'Elevated monitoring' : 'Normal operations'}
          </div>
        </StatCard>
      </div>

      {/* ── ROW 2: THREE COLUMNS ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* FEED HEALTH */}
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">Feed Health</div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-white/60">{briefing.feedHealth.healthyCount} healthy</span>
            {briefing.feedHealth.staleFeeds.length > 0 && (
              <>
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-white/60">{briefing.feedHealth.staleFeeds.length} failed</span>
              </>
            )}
          </div>
          <hr className="border-white/5" />
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 mb-1">Top Producers (24h)</div>
          <div className="space-y-1">
            {topSources.map((s) => (
              <div key={s.source} className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-parchment/80 truncate">{s.source}</span>
                <span className="text-contrail/60 ml-2">{fmt(s.cnt)}</span>
              </div>
            ))}
          </div>
          {briefing.feedHealth.staleFeeds.length > 0 && (
            <>
              <hr className="border-white/5" />
              <div className="font-mono text-[9px] uppercase tracking-widest text-amber-400/70 mb-1">Stale Feeds</div>
              {briefing.feedHealth.staleFeeds.map((f) => (
                <div key={f} className="font-mono text-[10px] text-amber-400/80">{f}</div>
              ))}
            </>
          )}
        </div>

        {/* ENRICHMENT / THREAT TYPES */}
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">Threat Types</div>
          <div className="space-y-1">
            {briefing.topThreatTypes.slice(0, 8).map((t) => (
              <div key={t.type} className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-parchment/80 truncate">{t.type}</span>
                <span className="text-contrail/60 ml-2">{fmt(t.cnt)}</span>
              </div>
            ))}
            {briefing.topThreatTypes.length === 0 && (
              <div className="font-mono text-[10px] text-contrail/30">No data</div>
            )}
          </div>
        </div>

        {/* CAMPAIGNS / TOP RISKS */}
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">Top Risks</div>
          {briefing.topRisks.length > 0 ? (
            <div className="space-y-3">
              {briefing.topRisks.slice(0, 4).map((r, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${r.priority === 'immediate' ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <span className="font-mono text-[11px] font-semibold text-parchment/90">{r.title}</span>
                  </div>
                  <div className="font-mono text-[10px] text-contrail/50 ml-3.5">{r.description}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="font-mono text-[10px] text-contrail/30">No active risks</div>
          )}
        </div>
      </div>

      {/* ── ROW 3: TWO COLUMNS ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* INTELLIGENCE */}
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">Intelligence</div>
          {briefing.campaigns.length > 0 ? (
            <div className="space-y-2">
              {briefing.campaigns.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center justify-between font-mono text-[11px]">
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-1.5 h-1.5 rounded-full ${severityDot(c.severity)}`} />
                    <span className="text-parchment/80 truncate">{c.name}</span>
                  </div>
                  <span className="text-contrail/60 ml-2 whitespace-nowrap">{c.domainCount} domains</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="font-mono text-[10px] text-contrail/30">No active campaigns detected</div>
          )}
          {briefing.trends.length > 0 && (
            <>
              <hr className="border-white/5" />
              <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 mb-1">Trends</div>
              {briefing.trends.slice(0, 3).map((t, i) => (
                <div key={i} className="font-mono text-[10px] text-contrail/50">
                  {t.direction === 'increasing' ? '\u25B2' : t.direction === 'decreasing' ? '\u25BC' : '\u2014'} {t.observation}
                </div>
              ))}
            </>
          )}
        </div>

        {/* TOP TARGETED BRANDS */}
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">Top Targeted Brands (24h)</div>
          {topBrands.length > 0 ? (
            <div className="space-y-1">
              {topBrands.map((b, i) => (
                <div key={b.brand} className="flex items-center justify-between font-mono text-[11px]">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-contrail/40 w-4 text-right">{i + 1}.</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${severityDot(b.severity)}`} />
                    <span className="text-parchment/80 truncate">{b.brand}</span>
                  </div>
                  <span className="text-contrail/60 ml-2">{fmt(b.threatCount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="font-mono text-[10px] text-contrail/30">No brand data</div>
          )}
        </div>
      </div>

      {/* ── ROW 4: ANOMALIES ────────────────────── */}
      {anomalies.length > 0 && (
        <div className={`rounded-xl border p-4 space-y-2 ${
          anomalies.some(a => a.level === 'warn')
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-green-500/20 bg-green-500/5'
        }`}>
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">System Status</div>
          {anomalies.map((a, i) => (
            <div key={i} className={`font-mono text-[11px] ${a.level === 'warn' ? 'text-amber-400' : 'text-green-400'}`}>
              {a.icon} {a.text}
            </div>
          ))}
        </div>
      )}

      {/* ── ROW 5: RECOMMENDATIONS ──────────────── */}
      {briefing.recommendations.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-2">
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">Recommendations</div>
          {briefing.recommendations.map((r, i) => (
            <div key={i} className="font-mono text-[10px] text-contrail/60">
              &bull; {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
