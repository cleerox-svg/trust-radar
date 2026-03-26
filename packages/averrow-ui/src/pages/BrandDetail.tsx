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
import { ThreatSummaryCards } from '@/components/brand/ThreatSummaryCards';
import { ProviderBars } from '@/components/brand/ProviderBars';
import { StatCard } from '@/components/brands/StatCard';
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

// ── Severity helpers ─────────────────────────────────────────────────
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;

const SEVERITY_TW: Record<string, { dot: string; text: string; textMuted: string }> = {
  critical: { dot: 'bg-severity-critical', text: 'text-severity-critical', textMuted: 'text-severity-critical/60' },
  high:     { dot: 'bg-severity-high',     text: 'text-severity-high',     textMuted: 'text-severity-high/60' },
  medium:   { dot: 'bg-severity-medium',   text: 'text-severity-medium',   textMuted: 'text-severity-medium/60' },
  low:      { dot: 'bg-severity-low',      text: 'text-severity-low',      textMuted: 'text-severity-low/60' },
  info:     { dot: 'bg-severity-low',      text: 'text-severity-low',      textMuted: 'text-severity-low/60' },
};

const THREAT_TYPE_COLORS: Record<string, { bar: string; text: string }> = {
  malware_distribution: { bar: 'bg-severity-high',     text: 'text-severity-high' },
  phishing:             { bar: 'bg-severity-low',      text: 'text-severity-low' },
  c2:                   { bar: 'bg-severity-critical',  text: 'text-severity-critical' },
  credential_harvesting:{ bar: 'bg-[#E87040]',         text: 'text-[#E87040]' },
  typosquatting:        { bar: 'bg-[#fbbf24]',         text: 'text-[#fbbf24]' },
  impersonation:        { bar: 'bg-severity-high',     text: 'text-severity-high' },
};

function getExposureTier(score: number) {
  if (score >= 80) return { color: 'text-severity-clear', stroke: '#28A050', label: 'LOW' };
  if (score >= 60) return { color: 'text-severity-high', stroke: '#E8923C', label: 'MEDIUM' };
  if (score >= 40) return { color: 'text-[#E87040]', stroke: '#E87040', label: 'HIGH' };
  return { color: 'text-severity-critical', stroke: '#C83C3C', label: 'CRITICAL' };
}

// ── Card 1: Exposure Index ──────────────────────────────────────────
function ExposureIndexCard({ score, threats }: { score: number | null; threats: any[] }) {
  const s = score ?? 0;
  const tier = getExposureTier(s);
  const circumference = 2 * Math.PI * 23;
  const offset = circumference * (1 - s / 100);

  // Aggregate top 3 threat types
  const typeCounts: Record<string, number> = {};
  threats.forEach(t => {
    const type = t.threat_type || 'unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const maxCount = topTypes.length > 0 ? topTypes[0][1] : 1;

  return (
    <StatCard
      title="Exposure Index"
      metricLabel={tier.label}
      metric={
        <div className="relative w-[52px] h-[52px]">
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="23" fill="none" stroke="#1e3048" strokeWidth="5" />
            <circle
              cx="26" cy="26" r="23" fill="none"
              stroke={tier.stroke} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 26 26)"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-mono text-[13px] font-bold text-parchment`}>
              {score ?? '\u2014'}
            </span>
          </div>
        </div>
      }
    >
      <div className="space-y-2">
        {topTypes.length === 0 && (
          <div className="font-mono text-[10px] text-contrail/30">No threats detected</div>
        )}
        {topTypes.map(([type, count]) => {
          const tc = THREAT_TYPE_COLORS[type] || { bar: 'bg-severity-low', text: 'text-severity-low' };
          const pct = Math.round((count / maxCount) * 100);
          return (
            <div key={type} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-contrail/50 truncate">
                  {type.replace(/_/g, ' ')}
                </span>
                <span className={`font-mono text-[10px] font-semibold ${tc.text}`}>
                  {count}
                </span>
              </div>
              <div className="w-full h-[2px] rounded-full bg-white/[0.04]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${tc.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </StatCard>
  );
}

// ── Card 2: Active Threats ──────────────────────────────────────────
function ActiveThreatsCard({ threats }: { threats: any[] }) {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  threats.forEach(t => {
    const sev = t.severity || 'low';
    if (sev in counts) counts[sev]++;
    else counts.low++;
  });

  const total = threats.length;
  const highestActive = SEVERITY_ORDER.find(s => counts[s] > 0) || 'low';
  const totalColor = SEVERITY_TW[highestActive]?.text || 'text-severity-low';

  return (
    <StatCard
      title="Active Threats"
      metricLabel="TOTAL"
      metric={
        <span className={`font-display text-[32px] font-extrabold leading-none ${totalColor}`}>
          {total}
        </span>
      }
    >
      <div className="space-y-1.5">
        {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
          const tw = SEVERITY_TW[sev];
          const c = counts[sev];
          return (
            <div key={sev} className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tw.dot}`} />
              <span className="font-mono text-[10px] text-contrail/50 flex-1 capitalize">{sev}</span>
              <span className={`font-mono text-[10px] font-semibold ${c > 0 ? tw.text : 'text-white/[0.15]'}`}>
                {c}
              </span>
            </div>
          );
        })}
        <div className="border-t border-contrail/[0.08] pt-1.5 mt-1">
          <span className="font-mono text-[9px] text-contrail/30">7-day window</span>
        </div>
      </div>
    </StatCard>
  );
}

// ── Card 3: Email Posture ───────────────────────────────────────────
const EMAIL_PROTOCOLS = ['SPF', 'DKIM', 'DMARC', 'MX'] as const;

function getEmailStatus(protocol: string, emailSec: any) {
  if (!emailSec) return { status: 'MISSING', hint: '' };
  const key = protocol.toLowerCase();
  const result = emailSec[`${key}_result`] || emailSec[key] || null;
  const record = emailSec[`${key}_record`] || emailSec[`${key}_value`] || '';

  if (protocol === 'MX') {
    const mx = emailSec.mx_records || emailSec.mx || null;
    if (mx && (Array.isArray(mx) ? mx.length > 0 : true)) {
      return { status: 'FOUND', hint: typeof mx === 'string' ? mx.split(' ')[0] : Array.isArray(mx) ? mx[0]?.exchange || mx[0] : '' };
    }
    return { status: 'MISSING', hint: 'risk' };
  }

  if (!result || result === 'none' || result === 'missing') {
    return { status: protocol === 'DMARC' ? 'NONE' : 'MISSING', hint: protocol === 'DMARC' ? 'p=none' : '' };
  }
  if (result === 'pass' || result === 'found') {
    let hint = '';
    if (protocol === 'SPF' && record) {
      const match = String(record).match(/[~+-]all/);
      hint = match ? match[0] : '';
    }
    if (protocol === 'DMARC' && record) {
      const match = String(record).match(/p=\w+/);
      hint = match ? match[0] : '';
    }
    if (protocol === 'DKIM') hint = 'valid';
    return { status: 'PASS', hint };
  }
  if (result === 'partial' || result === 'soft') {
    return { status: 'PARTIAL', hint: record ? String(record).slice(0, 12) : '' };
  }
  return { status: 'FAIL', hint: '' };
}

const EMAIL_STATUS_CLASSES: Record<string, string> = {
  PASS:    'bg-severity-clear/10 text-severity-clear border-severity-clear/30',
  FOUND:   'bg-severity-clear/10 text-severity-clear border-severity-clear/30',
  FAIL:    'bg-severity-critical/10 text-severity-critical border-severity-critical/30',
  MISSING: 'bg-severity-critical/10 text-severity-critical border-severity-critical/30',
  PARTIAL: 'bg-severity-high/10 text-severity-high border-severity-high/30',
  NONE:    'bg-severity-high/10 text-severity-high border-severity-high/30',
};

function getGradeColor(grade: string | null) {
  if (!grade) return 'text-contrail/40';
  const g = grade.toUpperCase();
  if (g === 'A+' || g === 'A') return 'text-severity-clear';
  if (g.startsWith('B')) return 'text-contrail';
  if (g.startsWith('C')) return 'text-severity-high';
  return 'text-severity-critical';
}

function EmailPostureCard({ emailSec, grade }: { emailSec: any; grade: string | null }) {
  return (
    <StatCard
      title="Email Posture"
      metricLabel="GRADE"
      metric={
        <span className={`font-display text-[32px] font-extrabold leading-none ${getGradeColor(grade)}`}>
          {grade || '\u2014'}
        </span>
      }
    >
      <div className="space-y-1">
        {EMAIL_PROTOCOLS.map(proto => {
          const { status, hint } = getEmailStatus(proto, emailSec);
          const cls = EMAIL_STATUS_CLASSES[status] || EMAIL_STATUS_CLASSES.MISSING;
          return (
            <div key={proto} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-contrail w-10 flex-shrink-0">{proto}</span>
              <span className={`font-mono text-[9px] font-semibold uppercase px-1.5 py-px rounded border leading-tight ${cls}`}>
                {status}
              </span>
              {hint && (
                <span className="font-mono text-[9px] text-contrail/30 truncate">{hint}</span>
              )}
            </div>
          );
        })}
      </div>
    </StatCard>
  );
}

// ── Card 4: Social Risk ─────────────────────────────────────────────
function SocialRiskCard({
  socialProfiles,
  lastScan,
  onScan,
  onDiscover,
  scanPending,
  discoverPending,
}: {
  socialProfiles: any[];
  lastScan: string | null;
  onScan: () => void;
  onDiscover: () => void;
  scanPending: boolean;
  discoverPending: boolean;
}) {
  const impersonation = socialProfiles.filter((p: any) => p.classification === 'impersonation').length;
  const suspicious = socialProfiles.filter((p: any) => p.classification === 'suspicious').length;
  const official = socialProfiles.filter((p: any) => p.classification === 'official' || p.classification === 'safe').length;
  const total = socialProfiles.length;

  const totalColor = impersonation > 0
    ? 'text-severity-critical'
    : suspicious > 0
      ? 'text-severity-high'
      : total > 0
        ? 'text-severity-clear'
        : 'text-contrail/40';

  const scanDaysAgo = lastScan
    ? Math.max(0, Math.round((Date.now() - new Date(lastScan).getTime()) / 86400000))
    : null;

  return (
    <StatCard
      title="Social Risk"
      metricLabel="PROFILES"
      metric={
        <span className={`font-display text-[32px] font-extrabold leading-none ${totalColor}`}>
          {total}
        </span>
      }
    >
      <div className="space-y-1.5">
        {([
          { label: 'Impersonation', count: impersonation, dot: 'bg-severity-critical', text: 'text-severity-critical' },
          { label: 'Suspicious', count: suspicious, dot: 'bg-severity-high', text: 'text-severity-high' },
          { label: 'Official', count: official, dot: 'bg-severity-clear', text: 'text-severity-clear' },
        ] as const).map(row => (
          <div key={row.label} className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.dot}`} />
            <span className="font-mono text-[10px] text-contrail/50 flex-1">{row.label}</span>
            <span className={`font-mono text-[10px] font-semibold ${row.count > 0 ? row.text : 'text-white/[0.15]'}`}>
              {row.count}
            </span>
          </div>
        ))}
        <div className="border-t border-contrail/[0.08] pt-1.5 mt-1 space-y-1">
          <span className="font-mono text-[9px] text-contrail/30 block">
            {total} profiles tracked{scanDaysAgo !== null ? ` \u00b7 scanned ${scanDaysAgo}d ago` : ''}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onScan}
              disabled={scanPending}
              className="font-mono text-[10px] text-contrail hover:text-parchment transition-colors disabled:opacity-40"
            >
              {scanPending ? 'SCANNING...' : 'SCAN'}
            </button>
            <button
              onClick={onDiscover}
              disabled={discoverPending}
              className="font-mono text-[10px] text-contrail hover:text-parchment transition-colors disabled:opacity-40"
            >
              {discoverPending ? 'DISCOVERING...' : 'DISCOVER NEW'}
            </button>
          </div>
        </div>
      </div>
    </StatCard>
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
           ROW 1 — Unified Stat Cards
           ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* ── Card 1: Exposure Index ── */}
        <ExposureIndexCard score={brand.exposure_score} threats={threats} />

        {/* ── Card 2: Active Threats ── */}
        <ActiveThreatsCard threats={threats} />

        {/* ── Card 3: Email Posture ── */}
        <EmailPostureCard emailSec={emailSec} grade={brand.email_security_grade} />

        {/* ── Card 4: Social Risk ── */}
        <SocialRiskCard
          socialProfiles={socialProfiles}
          lastScan={brand.last_social_scan}
          onScan={() => scanProfiles.mutate(id)}
          onDiscover={() => discoverProfiles.mutate(id)}
          scanPending={scanProfiles.isPending}
          discoverPending={discoverProfiles.isPending}
        />
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
