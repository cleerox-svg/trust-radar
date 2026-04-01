import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

// ─── Types (mirrors ComprehensiveBriefing from backend) ────────

interface PlatformOverview {
  totalThreats: number;
  last24h: number;
  last12h: number;
  avgPerHour: number;
  brandsMonitored: number;
  brandsClassified: number;
  todayCount: number;
  yesterdayCount: number;
}

interface BriefingBody {
  platformOverview: PlatformOverview;
  newThreats: {
    bySeverity: Array<{ severity: string; count: number }>;
    bySource: Array<{ source_feed: string; count: number }>;
    notable: Array<{
      malicious_domain: string;
      type: string;
      severity: string;
      source_feed: string;
      first_seen: string;
    }>;
  };
  feedProduction: Array<{ feed_name: string; runs: number; ingested: number }>;
  feedHealth: {
    feeds: Array<{
      feed_name: string;
      health_status: string;
      last_successful_pull: string | null;
      last_error: string | null;
    }>;
    summary: Array<{ health_status: string; count: number }>;
    staleFeeds: Array<{ feed_name: string; last_successful_pull: string | null }>;
    degradedFeeds: Array<{ feed_name: string; last_error: string | null }>;
  };
  enrichment: {
    surbl_checked: number; surbl_hits: number;
    vt_checked: number; vt_hits: number;
    gsb_checked: number; gsb_hits: number;
    dbl_checked: number; dbl_hits: number;
    abuse_checked: number; abuse_hits: number;
    gn_checked: number; sec_checked: number;
  };
  flightController: { summary: string | null; created_at: string | null };
  agentActivity: Array<{ agent_id: string; runs: number; last_run: string }>;
  newCapabilities: {
    typosquat_total: number; typosquat_new: number;
    social_total: number; social_new: number;
    certstream: number;
  };
  spamTrap: {
    totalSeeds: number;
    totalCaptures: number;
    captures12h: number;
    latestCaptures: Array<{
      trap_address: string; from_address: string;
      subject: string; category: string;
      severity: string; captured_at: string;
    }>;
    seedingSources: Array<{ seeded_location: string; seeds: number; catches: number }>;
  };
  honeypot: {
    totalVisits: number; botVisits: number; humanVisits: number;
    visits12h: number;
    pageBreakdown: Array<{ page: string; visits: number; bots: number }>;
    recentBots: Array<{ page: string; bot_name: string; country: string; visited_at: string }>;
    suspiciousHumans: Array<{ page: string; country: string; visited_at: string }>;
  };
  topTargetedBrands: Array<{ name: string; threats_24h: number }>;
  brandCoverage: Array<{ sector: string; brands: number }>;
  generatedAt: string;
  statusBadge: 'OPERATIONAL' | 'DEGRADED';
}

interface BriefingRow {
  id: number;
  type: string;
  report_date: string;
  report_data: string;
  generated_at: string;
  trigger: string;
  emailed: number;
}

// ─── Helpers ────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString();
}

function pct(hits: number, checked: number): string {
  if (checked === 0) return '—';
  return ((hits / checked) * 100).toFixed(1) + '%';
}

function freshnessInfo(createdAt: string): { label: string; cls: string } {
  const age = Date.now() - new Date(createdAt).getTime();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  if (age < oneHour) return { label: 'FRESH', cls: 'bg-green-500/20 text-green-400 border-green-500/30' };
  if (age < oneDay) return { label: 'TODAY', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  return { label: 'STALE', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
}

function triggerLabel(trigger: string): string {
  if (trigger.startsWith('cron')) return 'scheduled';
  return 'manual';
}

function severityDotClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-400';
    case 'high': return 'bg-amber-400';
    case 'medium': return 'bg-yellow-400';
    case 'low': return 'bg-contrail';
    default: return 'bg-green-400';
  }
}

function dodPct(today: number, yesterday: number): string {
  if (yesterday === 0) return today > 0 ? '+100%' : '0%';
  const change = ((today - yesterday) / yesterday) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(0)}%`;
}

// ─── Sub-components ─────────────────────────────────────────────

function OverviewCard({ title, metric, metricLabel, metricColor, children }: {
  title: string;
  metric: string;
  metricLabel: string;
  metricColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-cockpit p-4">
      <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3">{title}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        <div className="border-l border-white/10 pl-3 flex flex-col items-center gap-1">
          <div className={`text-[28px] font-bold leading-none ${metricColor ?? 'text-parchment'}`}>{metric}</div>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">{children}</div>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="border-b border-white/5">
            {headers.map((h) => (
              <th key={h} className="text-left text-[9px] uppercase tracking-widest text-contrail/50 pb-2 pr-4 font-medium last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
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

  // Parse briefing from report_data
  let briefing: BriefingBody | null = null;
  if (row?.report_data) {
    try {
      briefing = typeof row.report_data === 'string'
        ? JSON.parse(row.report_data)
        : row.report_data as unknown as BriefingBody;
    } catch { /* noop */ }
  }

  const freshness = row ? freshnessInfo(row.generated_at) : null;

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
        <SectionTitle>Daily Platform Briefing</SectionTitle>
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
  const p = briefing.platformOverview ?? {} as PlatformOverview;
  const total12h = briefing.newThreats?.bySeverity?.reduce((s, r) => s + Number(r.count), 0) ?? 0;
  const dodStr = dodPct(p.todayCount ?? 0, p.yesterdayCount ?? 0);
  const dodUp = (p.todayCount ?? 0) >= (p.yesterdayCount ?? 0);

  // Feed health summary
  const healthCounts: Record<string, number> = {};
  for (const h of (briefing.feedHealth?.summary ?? [])) {
    healthCounts[h.health_status] = Number(h.count);
  }

  // Feed production totals
  const totalIngested = (briefing.feedProduction ?? []).reduce((s, f) => s + Number(f.ingested), 0);
  const totalFeedRuns = (briefing.feedProduction ?? []).reduce((s, f) => s + Number(f.runs), 0);

  // Enrichment engines
  const enrichmentEngines = briefing.enrichment ? [
    { name: 'SURBL', checked: briefing.enrichment.surbl_checked, hits: briefing.enrichment.surbl_hits },
    { name: 'VirusTotal', checked: briefing.enrichment.vt_checked, hits: briefing.enrichment.vt_hits },
    { name: 'Google SB', checked: briefing.enrichment.gsb_checked, hits: briefing.enrichment.gsb_hits },
    { name: 'Spamhaus DBL', checked: briefing.enrichment.dbl_checked, hits: briefing.enrichment.dbl_hits },
    { name: 'AbuseIPDB', checked: briefing.enrichment.abuse_checked, hits: briefing.enrichment.abuse_hits },
    { name: 'GreyNoise', checked: briefing.enrichment.gn_checked, hits: 0 },
    { name: 'SecLookup', checked: briefing.enrichment.sec_checked, hits: 0 },
  ] : [];

  // Anomalies
  const anomalies: Array<{ icon: string; text: string; level: 'warn' | 'ok' }> = [];
  if (briefing.enrichment) {
    if (briefing.enrichment.gn_checked === 0) {
      anomalies.push({ icon: '\u26A0', text: 'GreyNoise: 0 enrichments — API may not be returning data', level: 'warn' });
    }
    if (briefing.enrichment.sec_checked === 0) {
      anomalies.push({ icon: '\u26A0', text: 'SecLookup: 0 enrichments — API may not be returning data', level: 'warn' });
    }
  }
  if (briefing.newCapabilities?.certstream === 0) {
    anomalies.push({ icon: '\u26A0', text: 'CertStream: alive but 0 captures', level: 'warn' });
  }
  for (const f of (briefing.feedHealth?.degradedFeeds ?? [])) {
    anomalies.push({ icon: '\u26A0', text: `${f.feed_name}: degraded — ${f.last_error ?? 'unknown'}`, level: 'warn' });
  }
  if ((briefing.agentActivity ?? []).length > 0) {
    anomalies.push({ icon: '\u2705', text: `All ${briefing.agentActivity.length} agents running normally`, level: 'ok' });
  }
  const producingEngines = enrichmentEngines.filter((e) => e.checked > 0).length;
  anomalies.push({ icon: '\u2705', text: `Enrichment pipeline operational (${producingEngines} of 7 engines producing)`, level: 'ok' });
  if ((briefing.newCapabilities?.typosquat_new ?? 0) > 0) {
    anomalies.push({ icon: '\u2705', text: `Typosquat scanner active — ${fmt(briefing.newCapabilities.typosquat_new)} domains discovered`, level: 'ok' });
  }

  return (
    <div className="space-y-4">
      {/* ── HEADER BAR ──────────────────────────── */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <SectionTitle>Platform Operations Briefing</SectionTitle>
            <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
              briefing.statusBadge === 'DEGRADED'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-green-500/20 text-green-400 border-green-500/30'
            }`}>
              {briefing.statusBadge ?? 'OPERATIONAL'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] text-contrail/50">
              Generated {new Date(row.generated_at).toLocaleString()} &middot; {triggerLabel(row.trigger)}
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

      {/* ── SECTION 1: PLATFORM OVERVIEW ─────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <OverviewCard title="Total Threats" metric={fmt(p.totalThreats)} metricLabel="total" metricColor="text-afterburner">
          <DotRow color="bg-red-400" label="New 24h" count={p.last24h ?? 0} />
          <DotRow color="bg-afterburner" label="New 12h" count={p.last12h ?? 0} />
        </OverviewCard>

        <OverviewCard title="24H Ingest" metric={fmt(p.last24h)} metricLabel="new" metricColor="text-afterburner">
          <DotRow color="bg-green-400" label="Brands" count={p.brandsMonitored ?? 0} />
          <DotRow color="bg-contrail" label="Classified" count={p.brandsClassified ?? 0} />
        </OverviewCard>

        <OverviewCard title="Hourly Rate" metric={`${fmt(p.avgPerHour)}`} metricLabel="/hr" metricColor="text-afterburner">
          <div className="text-[11px] text-white/50">Last 24h average</div>
        </OverviewCard>

        <OverviewCard
          title="Day over Day"
          metric={dodStr}
          metricLabel="change"
          metricColor={dodUp ? 'text-red-400' : 'text-green-400'}
        >
          <div className="text-[11px] text-white/50">
            {dodUp ? '\u25B2 Threats increasing' : '\u25BC Threats decreasing'}
          </div>
        </OverviewCard>
      </div>

      {/* ── SECTION 2: NEW THREATS (12H) ──────────── */}
      {briefing.newThreats && (
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>New Threats (12h)</SectionTitle>
            <span className="font-mono text-[14px] font-bold text-afterburner">{fmt(total12h)}</span>
          </div>
          <div className="flex flex-wrap gap-3 font-mono text-[11px]">
            {briefing.newThreats.bySeverity.map((s) => (
              <span key={s.severity} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${severityDotClass(s.severity)}`} />
                <span className="text-white/60 capitalize">{s.severity}:</span>
                <span className="text-parchment/90">{fmt(s.count)}</span>
              </span>
            ))}
          </div>
          {briefing.newThreats.bySource.length > 0 && (
            <>
              <hr className="border-white/5" />
              <DataTable headers={['Source', 'Count']}>
                {briefing.newThreats.bySource.map((s) => (
                  <tr key={s.source_feed} className="border-b border-white/5">
                    <td className="py-1 text-parchment/80 pr-4">{s.source_feed}</td>
                    <td className="py-1 text-right text-contrail/60">{fmt(s.count)}</td>
                  </tr>
                ))}
              </DataTable>
            </>
          )}
          {briefing.newThreats.notable.length > 0 && (
            <>
              <hr className="border-white/5" />
              <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 mb-1">Notable Critical/High</div>
              <div className="space-y-1.5">
                {briefing.newThreats.notable.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex items-start gap-2 font-mono text-[11px]">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${severityDotClass(t.severity)}`} />
                    <span className="text-parchment/90 font-semibold">{t.malicious_domain}</span>
                    <span className="text-contrail/50">{t.type} &middot; {t.severity} &middot; {t.source_feed}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SECTION 3 & 4: FEED PRODUCTION + HEALTH ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FEED PRODUCTION */}
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <SectionTitle>Feed Production (12h)</SectionTitle>
          <div className="font-mono text-[10px] text-contrail/50">
            {(briefing.feedProduction ?? []).length} feeds &middot; {fmt(totalFeedRuns)} runs &middot; {fmt(totalIngested)} ingested
          </div>
          {(briefing.feedProduction ?? []).length > 0 && (
            <DataTable headers={['Feed', 'Runs', 'Ingested']}>
              {briefing.feedProduction.map((f) => (
                <tr key={f.feed_name} className="border-b border-white/5">
                  <td className="py-1 text-parchment/80 pr-4 truncate max-w-[140px]">{f.feed_name}</td>
                  <td className="py-1 text-right text-contrail/60 pr-4">{fmt(f.runs)}</td>
                  <td className="py-1 text-right text-afterburner">{fmt(f.ingested)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>

        {/* FEED HEALTH */}
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <SectionTitle>Feed Health</SectionTitle>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            {healthCounts['healthy'] != null && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-white/60">{healthCounts['healthy']} healthy</span>
              </span>
            )}
            {healthCounts['degraded'] != null && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-white/60">{healthCounts['degraded']} degraded</span>
              </span>
            )}
            {healthCounts['failed'] != null && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-white/60">{healthCounts['failed']} failed</span>
              </span>
            )}
          </div>
          {(briefing.feedHealth?.degradedFeeds ?? []).length > 0 && (
            <>
              <hr className="border-white/5" />
              {briefing.feedHealth.degradedFeeds.map((f) => (
                <div key={f.feed_name} className="font-mono text-[10px] text-amber-400">
                  {'\u26A0'} {f.feed_name} — {f.last_error ?? 'unknown error'}
                </div>
              ))}
            </>
          )}
          {(briefing.feedHealth?.staleFeeds ?? []).length > 0 && (
            <>
              <hr className="border-white/5" />
              {briefing.feedHealth.staleFeeds.map((f) => (
                <div key={f.feed_name} className="font-mono text-[10px] text-amber-400">
                  {'\u26A0'} {f.feed_name} — last run {f.last_successful_pull ?? 'never'} (stale)
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── SECTION 5: ENRICHMENT PIPELINE ────────── */}
      {enrichmentEngines.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <SectionTitle>Enrichment Pipeline</SectionTitle>
          <DataTable headers={['Engine', 'Checked', 'Hits', 'Hit Rate', 'Status']}>
            {enrichmentEngines.map((e) => (
              <tr key={e.name} className="border-b border-white/5">
                <td className="py-1 text-parchment/80 pr-4">{e.name}</td>
                <td className="py-1 text-right text-contrail/60 pr-4">{fmt(e.checked)}</td>
                <td className="py-1 text-right text-afterburner pr-4">{fmt(e.hits)}</td>
                <td className="py-1 text-right text-contrail/60 pr-4">{pct(e.hits, e.checked)}</td>
                <td className="py-1 text-right">{e.checked > 0 ? '\u2705' : '\u26A0\uFE0F'}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {/* ── SECTION 6 & 7: FLIGHT CONTROLLER + AGENTS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FLIGHT CONTROLLER */}
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <SectionTitle>Flight Controller</SectionTitle>
          {briefing.flightController?.summary ? (
            <div className="font-mono text-[11px] text-contrail/70 whitespace-pre-wrap break-words">
              {briefing.flightController.summary}
            </div>
          ) : (
            <div className="font-mono text-[10px] text-contrail/30">No diagnostic available</div>
          )}
        </div>

        {/* AGENT STATUS */}
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <SectionTitle>Agent Status (12h)</SectionTitle>
          {(briefing.agentActivity ?? []).length > 0 ? (
            <DataTable headers={['Agent', 'Runs', 'Last Run']}>
              {briefing.agentActivity.map((a) => (
                <tr key={a.agent_id} className="border-b border-white/5">
                  <td className="py-1 text-parchment/80 pr-4">{a.agent_id}</td>
                  <td className="py-1 text-right text-contrail/60 pr-4">{fmt(a.runs)}</td>
                  <td className="py-1 text-right text-contrail/50">
                    {a.last_run ? new Date(a.last_run).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC' : '—'}
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <div className="font-mono text-[10px] text-contrail/30">No agent activity</div>
          )}
        </div>
      </div>

      {/* ── SECTION 8: SPAM TRAP INTELLIGENCE ──────── */}
      {briefing.spamTrap && (
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <SectionTitle>Spam Trap Intelligence</SectionTitle>
          <div className="flex flex-wrap gap-4 font-mono text-[11px]">
            <span className="text-white/60">Seeds: <span className="text-afterburner">{fmt(briefing.spamTrap.totalSeeds)}</span></span>
            <span className="text-white/60">Captures: <span className="text-afterburner">{fmt(briefing.spamTrap.totalCaptures)}</span></span>
            <span className="text-white/60">New (12h): <span className="text-afterburner">{fmt(briefing.spamTrap.captures12h)}</span></span>
          </div>
          {briefing.spamTrap.seedingSources.length > 0 && (
            <>
              <hr className="border-white/5" />
              <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 mb-1">Seeding Sources</div>
              <DataTable headers={['Source', 'Seeds', 'Catches']}>
                {briefing.spamTrap.seedingSources.map((s) => (
                  <tr key={s.seeded_location} className="border-b border-white/5">
                    <td className="py-1 text-parchment/80 pr-4 truncate max-w-[160px]">{s.seeded_location}</td>
                    <td className="py-1 text-right text-contrail/60 pr-4">{fmt(s.seeds)}</td>
                    <td className="py-1 text-right text-afterburner">{fmt(s.catches)}</td>
                  </tr>
                ))}
              </DataTable>
            </>
          )}
          {briefing.spamTrap.latestCaptures.length > 0 && (
            <>
              <hr className="border-white/5" />
              <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 mb-1">Latest Captures</div>
              <div className="space-y-2">
                {briefing.spamTrap.latestCaptures.map((c, i) => (
                  <div key={i} className="rounded-lg border border-white/5 p-2.5">
                    <div className="font-mono text-[11px] text-parchment/80">
                      From: <span className="text-contrail/60">{c.from_address}</span> &rarr; <span className="text-contrail/60">{c.trap_address}</span>
                    </div>
                    <div className="font-mono text-[11px] text-parchment/70 mt-0.5">Subject: &ldquo;{c.subject}&rdquo;</div>
                    <div className="font-mono text-[10px] text-contrail/40 mt-0.5">{c.category} &middot; {c.severity} &middot; {c.captured_at}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SECTION 9: HONEYPOT ACTIVITY ──────────── */}
      {briefing.honeypot && (
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <SectionTitle>Honeypot Activity</SectionTitle>
          <div className="flex flex-wrap gap-4 font-mono text-[11px]">
            <span className="text-white/60">Total: <span className="text-afterburner">{fmt(briefing.honeypot.totalVisits)}</span></span>
            <span className="text-white/60">Bots: <span className="text-contrail/60">{fmt(briefing.honeypot.botVisits)}</span></span>
            <span className="text-white/60">Humans: <span className="text-contrail/60">{fmt(briefing.honeypot.humanVisits)}</span></span>
            <span className="text-white/60">Last 12h: <span className="text-afterburner">{fmt(briefing.honeypot.visits12h)}</span></span>
          </div>
          {briefing.honeypot.pageBreakdown.length > 0 && (
            <>
              <hr className="border-white/5" />
              <DataTable headers={['Page', 'Visits', 'Bots']}>
                {briefing.honeypot.pageBreakdown.map((p) => (
                  <tr key={p.page} className="border-b border-white/5">
                    <td className="py-1 text-parchment/80 pr-4 truncate max-w-[160px]">{p.page}</td>
                    <td className="py-1 text-right text-contrail/60 pr-4">{fmt(p.visits)}</td>
                    <td className="py-1 text-right text-contrail/60">{fmt(p.bots)}</td>
                  </tr>
                ))}
              </DataTable>
            </>
          )}
          {briefing.honeypot.recentBots.length > 0 && (
            <>
              <hr className="border-white/5" />
              <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 mb-1">Recent Crawlers</div>
              {briefing.honeypot.recentBots.map((b, i) => (
                <div key={i} className="font-mono text-[11px] text-contrail/60">
                  &#9679; {b.bot_name || 'Unknown bot'} &middot; {b.country || '?'} &middot; {b.visited_at ? new Date(b.visited_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC' : '—'}
                </div>
              ))}
            </>
          )}
          {briefing.honeypot.suspiciousHumans.length > 0 && (
            <>
              <hr className="border-white/5" />
              {briefing.honeypot.suspiciousHumans.map((h, i) => (
                <div key={i} className="font-mono text-[11px] text-amber-400">
                  {'\u26A0'} Suspicious: Human from {h.country || 'unknown'} probed {h.page} at {h.visited_at ? new Date(h.visited_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC' : '—'}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── SECTION 10: TOP TARGETED BRANDS ────────── */}
      {(briefing.topTargetedBrands ?? []).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-3">
          <SectionTitle>Top Targeted Brands (24h)</SectionTitle>
          <div className="space-y-1">
            {briefing.topTargetedBrands.map((b, i) => (
              <div key={b.name} className="flex items-center justify-between font-mono text-[11px]">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-contrail/40 w-5 text-right">{i + 1}.</span>
                  <span className="text-parchment/80 truncate">{b.name}</span>
                </div>
                <span className="text-afterburner ml-2">{fmt(b.threats_24h)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 11: ANOMALIES & ALERTS ─────────── */}
      {anomalies.length > 0 && (
        <div className={`rounded-xl border p-4 space-y-2 ${
          anomalies.some(a => a.level === 'warn')
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-green-500/20 bg-green-500/5'
        }`}>
          <SectionTitle>Anomalies & Alerts</SectionTitle>
          {anomalies.map((a, i) => (
            <div key={i} className={`font-mono text-[11px] ${a.level === 'warn' ? 'text-amber-400' : 'text-green-400'}`}>
              {a.icon} {a.text}
            </div>
          ))}
        </div>
      )}

      {/* ── SECTION 12: BRAND COVERAGE ──────────────── */}
      {(briefing.brandCoverage ?? []).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-cockpit p-4 space-y-2">
          <SectionTitle>Brand Coverage</SectionTitle>
          <div className="font-mono text-[11px] text-white/60">
            {fmt(p.brandsMonitored)} monitored &middot; {fmt(p.brandsClassified)} classified
          </div>
          <div className="font-mono text-[11px] text-contrail/60">
            Top: {briefing.brandCoverage.slice(0, 5).map((c) => `${c.sector} (${c.brands})`).join(' \u00B7 ')}
          </div>
        </div>
      )}
    </div>
  );
}
