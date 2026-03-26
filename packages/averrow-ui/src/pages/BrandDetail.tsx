import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  useBrandFullDetail,
  useBrandTimeline,
  useTriggerAnalysis,
  useAddSafeDomain,
  useDeleteSafeDomain,
  useCleanFalsePositives,
  useClassifySocialProfile,
  useScanSocialProfiles,
  useDiscoverSocialProfiles,
} from '@/hooks/useBrandDetail';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Tabs } from '@/components/ui/Tabs';
import { PageLoader } from '@/components/ui/PageLoader';
import { ExposureGauge } from '@/components/brand/ExposureGauge';
import { SecurityShield } from '@/components/brand/SecurityShield';
import { ThreatSummaryCards } from '@/components/brand/ThreatSummaryCards';
import { ProviderBars } from '@/components/brand/ProviderBars';
import { relativeTime } from '@/lib/time';

// ── Constants ──────────────────────────────────────────────────────────
const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '\u266A', github: '<>', linkedin: 'in', twitter: '\uD835\uDD4F',
  instagram: '\uD83D\uDCF7', youtube: '\u25B6', facebook: 'f', reddit: 'r',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#C83C3C', high: '#E8923C', medium: '#DCAA32', low: '#78A0C8', info: '#5A80A8',
};

const TIMELINE_PERIODS = ['24h', '7d', '30d', '90d'] as const;

function classificationVariant(c: string): 'critical' | 'success' | 'high' | 'default' {
  if (c === 'impersonation') return 'critical';
  if (c === 'official') return 'success';
  if (c === 'suspicious') return 'high';
  return 'default';
}

// ── ASTRA Analysis Parser ─────────────────────────────────────────────
interface AstraAnalysis {
  summary: string | null;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | null;
  keyFindings: string[];
  attackTypes: string[];
  recommendation: string | null;
}

function parseAstraAnalysis(raw: string | object | null | undefined): AstraAnalysis | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      summary: parsed.analysis ?? null,
      riskLevel: parsed.risk_level ?? null,
      keyFindings: parsed.key_findings ?? [],
      attackTypes: parsed.attack_types ?? [],
      recommendation: parsed.recommendation ?? null,
    };
  } catch {
    return {
      summary: typeof raw === 'string' ? raw : null,
      riskLevel: null,
      keyFindings: [],
      attackTypes: [],
      recommendation: null,
    };
  }
}

const RISK_BADGE_VARIANT: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const RISK_BADGE_CLASSES: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  medium: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

function toTitleCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Timeline Tooltip ───────────────────────────────────────────────────
function TimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-cockpit/95 border border-white/10 rounded-lg px-3 py-2 text-xs backdrop-blur-sm">
      <div className="font-mono text-contrail/60 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-parchment">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export function BrandDetail() {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const id = brandId || '';

  // State
  const [socialFilter, setSocialFilter] = useState('all');
  const [timelinePeriod, setTimelinePeriod] = useState<string>('7d');
  const [threatSort, setThreatSort] = useState<{ key: string; asc: boolean }>({ key: 'severity', asc: false });
  const [safeDomainInput, setSafeDomainInput] = useState('');
  const [expandedThreats, setExpandedThreats] = useState(false);
  const [expandedSummary, setExpandedSummary] = useState(false);

  // Data
  const { data, isLoading } = useBrandFullDetail(id);
  const { data: timelineData } = useBrandTimeline(id, timelinePeriod);

  // Mutations
  const triggerAnalysis = useTriggerAnalysis();
  const addSafeDomain = useAddSafeDomain();
  const deleteSafeDomain = useDeleteSafeDomain();
  const cleanFP = useCleanFalsePositives();
  const classifyProfile = useClassifySocialProfile();
  const scanProfiles = useScanSocialProfiles();
  const discoverProfiles = useDiscoverSocialProfiles();

  // Derived
  const brand = data?.brand;
  const threats = data?.threats || [];
  const providers = data?.providers || [];
  const safeDomains = data?.safeDomains || [];
  const emailSec = data?.emailSecurity;
  const socialProfiles = data?.socialProfiles || [];
  const analysis = data?.analysis;

  const suspiciousCount = socialProfiles.filter(
    (p: any) => p.classification === 'suspicious' || p.classification === 'impersonation'
  ).length;

  const filteredProfiles = socialProfiles.filter((p: any) => {
    if (socialFilter === 'all') return true;
    if (socialFilter === 'official') return p.classification === 'official';
    if (socialFilter === 'suspicious') return p.classification === 'suspicious' || p.classification === 'impersonation';
    if (socialFilter === 'safe') return p.classification === 'safe' || p.classification === 'official';
    return true;
  });

  const socialTabs = [
    { id: 'all', label: 'All', count: socialProfiles.length },
    { id: 'official', label: 'Official' },
    { id: 'suspicious', label: 'Suspicious', count: suspiciousCount },
    { id: 'safe', label: 'Safe' },
  ];

  // Sort threats
  const sortedThreats = useMemo(() => {
    const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    return [...threats].sort((a: any, b: any) => {
      if (threatSort.key === 'severity') {
        const diff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        return threatSort.asc ? -diff : diff;
      }
      if (threatSort.key === 'date') {
        const diff = new Date(b.detected_at || 0).getTime() - new Date(a.detected_at || 0).getTime();
        return threatSort.asc ? -diff : diff;
      }
      return 0;
    });
  }, [threats, threatSort]);

  const visibleThreats = expandedThreats ? sortedThreats : sortedThreats.slice(0, 10);

  // Timeline chart data
  const chartData = useMemo(() => {
    if (!timelineData) return [];
    if (Array.isArray(timelineData)) return timelineData;
    if (timelineData.labels) {
      return timelineData.labels.map((label: string, i: number) => ({
        date: label,
        total: timelineData.values?.[i] ?? 0,
        high_sev: timelineData.high_sev?.[i] ?? 0,
        active: timelineData.active?.[i] ?? 0,
      }));
    }
    return [];
  }, [timelineData]);

  // ── Loading / Not Found ────────────────────────────────────────────
  if (isLoading) return <PageLoader />;

  if (!brand) {
    return (
      <div className="animate-fade-in">
        <button onClick={() => navigate('/brands')} className="font-mono text-xs text-contrail/50 hover:text-accent transition-colors mb-4">
          \u2190 Back to Brands
        </button>
        <Card hover={false}><p className="text-sm text-contrail/60">Brand not found</p></Card>
      </div>
    );
  }

  const socialRiskColor = (brand.social_risk_score ?? 0) >= 70 ? '#C83C3C'
    : (brand.social_risk_score ?? 0) >= 40 ? '#E8923C' : '#28A050';

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Nav ── */}
      <button onClick={() => navigate('/brands')} className="font-mono text-xs text-contrail/50 hover:text-accent transition-colors">
        \u2190 Back to Brands
      </button>

      {/* ── Brand Header ── */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <img
            src={`https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=48`}
            alt="" className="w-10 h-10 rounded-lg ring-2 ring-white/[0.06]"
          />
          {brand.monitoring_status === 'active' && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full ring-2 ring-cockpit">
              <span className="absolute inset-0 bg-accent rounded-full animate-ping opacity-50" />
            </span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-extrabold text-parchment tracking-tight">{brand.name}</h1>
            {brand.sector && <Badge variant="info">{brand.sector}</Badge>}
            <Badge variant={brand.monitoring_status === 'active' ? 'success' : 'default'}>
              {brand.monitoring_status}
            </Badge>
          </div>
          <div className="font-mono text-sm text-contrail/50">{brand.canonical_domain}</div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
           ROW 1 — Hero Metrics: Exposure Gauge | Active Threats | Email Shield | Social Risk
           ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Exposure Gauge */}
        <Card hover={false} className="flex flex-col items-center justify-center py-6">
          <SectionLabel className="mb-4">Exposure Index</SectionLabel>
          <ExposureGauge score={brand.exposure_score} size={140} />
        </Card>

        {/* Active Contacts Summary */}
        <Card hover={false} className="flex flex-col justify-between py-6">
          <SectionLabel className="mb-3">Active Contacts</SectionLabel>
          <div className="flex items-end gap-3">
            <span className="font-display text-5xl font-extrabold text-accent leading-none">{threats.length}</span>
            <span className="font-mono text-[10px] text-contrail/40 uppercase mb-1.5">in airspace</span>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            {Object.entries(
              threats.reduce((acc: Record<string, number>, t: any) => {
                acc[t.severity || 'info'] = (acc[t.severity || 'info'] || 0) + 1;
                return acc;
              }, {})
            ).sort((a, b) => {
              const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
              return (order[a[0]] ?? 5) - (order[b[0]] ?? 5);
            }).map(([sev, count]) => (
              <Badge key={sev} variant={RISK_BADGE_VARIANT[sev] ?? 'default'}>
                {count} {sev}
              </Badge>
            ))}
          </div>
        </Card>

        {/* Email Security Shield */}
        <Card hover={false} className="flex flex-col items-center justify-center py-6">
          <SectionLabel className="mb-3">Email Posture</SectionLabel>
          <SecurityShield
            spf={emailSec?.spf_result || emailSec?.spf || null}
            dkim={emailSec?.dkim_result || emailSec?.dkim || null}
            dmarc={emailSec?.dmarc_result || emailSec?.dmarc || null}
            grade={brand.email_security_grade}
          />
        </Card>

        {/* Social Risk */}
        <Card hover={false} className="flex flex-col justify-between py-6">
          <SectionLabel className="mb-3">Social Risk</SectionLabel>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
                <circle cx="32" cy="32" r="28" fill="none"
                  stroke={socialRiskColor} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 28}
                  strokeDashoffset={2 * Math.PI * 28 * (1 - (brand.social_risk_score ?? 0) / 100)}
                  transform="rotate(-90 32 32)"
                  className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-lg font-extrabold" style={{ color: socialRiskColor }}>
                  {brand.social_risk_score ?? '\u2014'}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="font-mono text-[10px] text-contrail/50">{socialProfiles.length} profiles tracked</div>
              <div className="font-mono text-[10px] text-contrail/50">{suspiciousCount} suspicious</div>
              {brand.last_social_scan && (
                <div className="font-mono text-[10px] text-contrail/30">Scanned {relativeTime(brand.last_social_scan)}</div>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => scanProfiles.mutate(id)}
              disabled={scanProfiles.isPending}>
              {scanProfiles.isPending ? 'SCANNING...' : 'SCAN'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => discoverProfiles.mutate(id)}
              disabled={discoverProfiles.isPending}>
              DISCOVER
            </Button>
          </div>
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════════
           ROW 2 — Threat Breakdown + AI Analysis + Providers
           ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Threat Type Summary Cards */}
        <div className="lg:col-span-2 space-y-4">
          <SectionLabel>Threat Breakdown</SectionLabel>
          <ThreatSummaryCards threats={threats} />

          {/* AI Threat Analysis — Executive Briefing */}
          {(brand.threat_analysis || analysis) && (() => {
            const astra = parseAstraAnalysis(analysis?.summary || analysis || brand.threat_analysis);
            if (!astra) return null;
            const summaryText = astra.summary || '';
            const needsTruncation = summaryText.length > 300;
            const displaySummary = needsTruncation && !expandedSummary
              ? summaryText.slice(0, 300) + '...'
              : summaryText;
            return (
              <Card hover={false} className="border-l-[3px] border-accent">
                <div className="space-y-4">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <SectionLabel>ASTRA Analysis</SectionLabel>
                    <div className="flex items-center gap-2">
                      <Badge variant="critical">CURRENT</Badge>
                      {astra.riskLevel && (
                        <span className={`inline-flex items-center font-mono text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded border ${RISK_BADGE_CLASSES[astra.riskLevel] || 'bg-white/5 text-white/60 border-white/10'}`}>
                          {astra.riskLevel} &#9650;
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  {summaryText && (
                    <div>
                      <h4 className="font-mono text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">
                        Summary
                      </h4>
                      <p className="text-sm text-white/80 leading-relaxed">
                        {displaySummary}
                        {needsTruncation && (
                          <button
                            onClick={() => setExpandedSummary(!expandedSummary)}
                            className="ml-1.5 font-mono text-[10px] font-semibold text-contrail hover:text-white transition-colors"
                          >
                            {expandedSummary ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Key Findings */}
                  {astra.keyFindings.length > 0 && (
                    <div>
                      <h4 className="font-mono text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">
                        Key Findings
                      </h4>
                      <ul className="space-y-1.5">
                        {astra.keyFindings.map((finding, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                            <span className="mt-[5px] text-accent text-[8px] flex-shrink-0">&#9670;</span>
                            {finding}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions + Timestamp */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm"
                        onClick={() => triggerAnalysis.mutate(id)}
                        disabled={triggerAnalysis.isPending}>
                        {triggerAnalysis.isPending ? 'ANALYZING...' : 'AI DEEP SCAN'}
                      </Button>
                      <Button variant="ghost" size="sm"
                        onClick={() => cleanFP.mutate(id)}
                        disabled={cleanFP.isPending}>
                        CLEAN FALSE POSITIVES
                      </Button>
                    </div>
                    {(brand.analysis_updated_at || analysis?.updated_at) && (
                      <span className="font-mono text-xs text-white/40">
                        Updated {relativeTime(brand.analysis_updated_at || analysis?.updated_at)}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* No analysis fallback — trigger button */}
          {!brand.threat_analysis && !analysis && (
            <Card hover={false} className="border border-dashed border-white/10 flex items-center justify-between">
              <div>
                <div className="text-sm text-parchment/60">No ASTRA analysis available</div>
                <div className="font-mono text-[10px] text-contrail/30 mt-1">Run an AI deep scan to generate threat intelligence</div>
              </div>
              <Button variant="primary" size="sm"
                onClick={() => triggerAnalysis.mutate(id)}
                disabled={triggerAnalysis.isPending}>
                {triggerAnalysis.isPending ? 'ANALYZING...' : 'INITIATE SCAN'}
              </Button>
            </Card>
          )}
        </div>

        {/* Hosting Providers */}
        <Card hover={false}>
          <SectionLabel className="mb-4">Hosting Providers</SectionLabel>
          <ProviderBars providers={providers} />
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════════
           ROW 3 — Threat Timeline Chart
           ════════════════════════════════════════════════════════════════ */}
      <Card hover={false}>
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Threat Timeline</SectionLabel>
          <div className="flex gap-1.5">
            {TIMELINE_PERIODS.map(p => (
              <button key={p} onClick={() => setTimelinePeriod(p)}
                className={`font-mono text-[11px] font-semibold px-3 py-1 rounded transition-all ${
                  timelinePeriod === p
                    ? 'bg-accent/10 text-accent border border-accent/25'
                    : 'text-contrail/40 hover:bg-white/5 hover:text-parchment border border-transparent'
                }`}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C83C3C" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#C83C3C" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradHighSev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8923C" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#E8923C" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#28A050" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#28A050" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date"
                tick={{ fill: '#78A0C8', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
              <YAxis tick={{ fill: '#78A0C8', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                axisLine={false} tickLine={false} />
              <Tooltip content={<TimelineTooltip />} />
              <Area type="monotone" dataKey="total" stroke="#C83C3C" fill="url(#gradTotal)" strokeWidth={2} name="Total" />
              <Area type="monotone" dataKey="high_sev" stroke="#E8923C" fill="url(#gradHighSev)" strokeWidth={1.5} name="High Severity" />
              <Area type="monotone" dataKey="active" stroke="#28A050" fill="url(#gradActive)" strokeWidth={1.5} name="Active" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-60 flex items-center justify-center text-contrail/30 font-mono text-xs">
            No timeline data available
          </div>
        )}
      </Card>

      {/* ════════════════════════════════════════════════════════════════
           ROW 4 — Threats Table + Safe Domains
           ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sortable Threats Table */}
        <div className="lg:col-span-2">
          <Card hover={false}>
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Active Threats</SectionLabel>
              <span className="font-mono text-[10px] text-white/40">{threats.length} total</span>
            </div>

            {threats.length === 0 ? (
              <div className="py-8 text-center text-contrail/30 font-mono text-xs">
                No active threats detected — airspace clear
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[3px_minmax(0,1fr)_minmax(0,1fr)_80px_80px] gap-3 items-center
                  pb-2 border-b border-white/[0.06] mb-2">
                  <div />
                  <button onClick={() => setThreatSort({ key: 'severity', asc: threatSort.key === 'severity' ? !threatSort.asc : false })}
                    className="font-mono text-[9px] text-contrail/50 uppercase tracking-wider text-left hover:text-parchment transition-colors">
                    Type / Severity {threatSort.key === 'severity' && (threatSort.asc ? '\u25B2' : '\u25BC')}
                  </button>
                  <div className="font-mono text-[9px] text-contrail/50 uppercase tracking-wider">Target</div>
                  <div className="font-mono text-[9px] text-contrail/50 uppercase tracking-wider">Vector</div>
                  <button onClick={() => setThreatSort({ key: 'date', asc: threatSort.key === 'date' ? !threatSort.asc : false })}
                    className="font-mono text-[9px] text-contrail/50 uppercase tracking-wider text-right hover:text-parchment transition-colors">
                    Age {threatSort.key === 'date' && (threatSort.asc ? '\u25B2' : '\u25BC')}
                  </button>
                </div>

                {/* Threat rows */}
                {visibleThreats.map((t: any) => {
                  const secondaryLabel = t.url || t.domain || t.target_url || t.source || null;
                  return (
                    <div key={t.id}
                      className="grid grid-cols-[3px_minmax(0,1fr)_minmax(0,1fr)_80px_100px] gap-3 items-center py-2.5
                      border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                      {/* Severity bar */}
                      <div className="h-full rounded-full" style={{ backgroundColor: SEVERITY_COLORS[t.severity] || '#5A80A8' }} />

                      {/* Type + URL/domain */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: SEVERITY_COLORS[t.severity] || '#5A80A8',
                            boxShadow: t.severity === 'critical' ? `0 0 8px ${SEVERITY_COLORS.critical}` : 'none',
                          }} />
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-semibold text-white/90 truncate">
                            {toTitleCase(t.threat_type || 'unknown')}
                          </div>
                          {secondaryLabel && (
                            <div className="font-mono text-[9px] text-white/55 truncate">{secondaryLabel}</div>
                          )}
                        </div>
                      </div>

                      {/* Target */}
                      <div className="font-display text-xs font-semibold text-white/80 truncate">
                        {t.target_url || t.domain || '\u2014'}
                      </div>

                      {/* Vector */}
                      {t.vector ? (
                        <Badge variant="info" className="text-[8px] justify-center">{t.vector}</Badge>
                      ) : (
                        <span className="text-white/20 text-[10px]">\u2014</span>
                      )}

                      {/* Age + Score */}
                      <div className="flex items-center justify-end gap-2 min-w-0">
                        <span className="font-mono text-[10px] text-white/40">
                          {relativeTime(t.detected_at || t.created_at)}
                        </span>
                        {t.score != null && (
                          <span className="font-mono text-[9px] text-white/30">{t.score}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {sortedThreats.length > 10 && (
                  <button onClick={() => setExpandedThreats(!expandedThreats)}
                    className="w-full mt-3 py-2 font-mono text-[10px] text-contrail hover:text-white
                    border border-white/[0.04] rounded-lg hover:border-accent/20 transition-all">
                    {expandedThreats ? 'SHOW LESS' : `SHOW ALL ${sortedThreats.length} THREATS`}
                  </button>
                )}
              </>
            )}
          </Card>
        </div>

        {/* Safe Domains Panel */}
        <Card hover={false}>
          <SectionLabel className="mb-4">Safe Domains</SectionLabel>
          <div className="space-y-2 mb-4">
            {safeDomains.length === 0 ? (
              <div className="text-contrail/30 font-mono text-xs py-2">No safe domains configured</div>
            ) : (
              safeDomains.map((d: any) => (
                <div key={d.id || d.domain} className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
                  <span className="font-mono text-xs text-parchment/80">{d.domain}</span>
                  <button onClick={() => deleteSafeDomain.mutate({ brandId: id, domainId: d.id })}
                    className="font-mono text-[9px] text-contrail/30 hover:text-accent transition-colors">
                    REMOVE
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={safeDomainInput}
              onChange={e => setSafeDomainInput(e.target.value)}
              placeholder="Add domain..."
              className="flex-1 bg-cockpit border border-white/[0.06] rounded-md px-3 py-1.5 font-mono text-xs text-parchment
                placeholder:text-contrail/20 focus:border-accent/30 focus:outline-none transition-colors"
              onKeyDown={e => {
                if (e.key === 'Enter' && safeDomainInput.trim()) {
                  addSafeDomain.mutate({ brandId: id, domain: safeDomainInput.trim() });
                  setSafeDomainInput('');
                }
              }}
            />
            <Button variant="secondary" size="sm"
              onClick={() => { if (safeDomainInput.trim()) { addSafeDomain.mutate({ brandId: id, domain: safeDomainInput.trim() }); setSafeDomainInput(''); } }}
              disabled={!safeDomainInput.trim() || addSafeDomain.isPending}>
              ADD
            </Button>
          </div>
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════════
           ROW 5 — Social Profiles Grid
           ════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SectionLabel>Social Profiles</SectionLabel>
            <Badge variant="info">{socialProfiles.length}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => scanProfiles.mutate(id)} disabled={scanProfiles.isPending}>
              RESCAN
            </Button>
            <Button variant="ghost" size="sm" onClick={() => discoverProfiles.mutate(id)} disabled={discoverProfiles.isPending}>
              DISCOVER NEW
            </Button>
          </div>
        </div>
        <Tabs tabs={socialTabs} activeTab={socialFilter} onChange={setSocialFilter} />

        {filteredProfiles.length === 0 ? (
          <Card hover={false}>
            <div className="py-6 text-center text-contrail/30 font-mono text-xs">No profiles match this filter</div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProfiles.map((profile: any) => (
              <Card key={profile.id} hover={false} className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    {/* Platform icon circle */}
                    <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06]
                      flex items-center justify-center font-mono text-xs text-contrail/60 font-bold">
                      {PLATFORM_ICONS[(profile.platform ?? '').toLowerCase()] ?? '\u25CF'}
                    </div>
                    <div>
                      <div className="font-mono font-semibold text-sm text-parchment">@{profile.handle}</div>
                      {profile.display_name && (
                        <div className="text-[10px] text-contrail/40">{profile.display_name}</div>
                      )}
                    </div>
                  </div>
                  <Badge variant={classificationVariant(profile.classification)}>
                    {profile.classification}
                  </Badge>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 font-mono text-[10px] text-contrail/40">
                  {profile.followers_count != null && (
                    <span>{Number(profile.followers_count).toLocaleString()} followers</span>
                  )}
                  {profile.verified === 1 && (
                    <span className="text-positive font-bold uppercase">Verified</span>
                  )}
                  {profile.platform && (
                    <span className="uppercase">{profile.platform}</span>
                  )}
                </div>

                {/* Impersonation Score */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-contrail/50">Impersonation Score</span>
                    <span className="font-mono text-xs font-bold" style={{
                      color: profile.impersonation_score >= 70 ? '#C83C3C' : profile.impersonation_score >= 40 ? '#E8923C' : '#28A050'
                    }}>{profile.impersonation_score}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded overflow-hidden">
                    <div className="h-full rounded transition-all duration-500" style={{
                      width: `${Math.min(profile.impersonation_score, 100)}%`,
                      background: profile.impersonation_score >= 70 ? '#C83C3C' : profile.impersonation_score >= 40 ? '#E8923C' : '#28A050',
                    }} />
                  </div>
                </div>

                {/* AI Assessment */}
                {profile.ai_assessment && (
                  <p className="text-xs text-contrail/60 line-clamp-3 leading-relaxed">{profile.ai_assessment}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="ghost" size="sm"
                    onClick={() => classifyProfile.mutate({ brandId: id, profileId: profile.id, classification: 'official' })}>
                    Confirm Safe
                  </Button>
                  <Button variant="danger" size="sm"
                    onClick={() => classifyProfile.mutate({ brandId: id, profileId: profile.id, classification: 'impersonation' })}>
                    Impersonation
                  </Button>
                  <Button variant="ghost" size="sm"
                    onClick={() => classifyProfile.mutate({ brandId: id, profileId: profile.id, classification: 'safe' })}>
                    False Positive
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
