import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBrandDetail, useBrandThreats, useBrandSocialProfiles, useBrandEmailSecurity } from '@/hooks/useBrands';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageLoader } from '@/components/ui/PageLoader';
import { relativeTime } from '@/lib/time';

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '♪',
  github: '<>',
  linkedin: 'in',
  twitter: '𝕏',
  instagram: '📷',
  youtube: '▶',
};

function classificationVariant(c: string): 'critical' | 'success' | 'high' | 'default' {
  if (c === 'impersonation') return 'critical';
  if (c === 'official') return 'success';
  if (c === 'suspicious') return 'high';
  return 'default';
}

export function BrandDetail() {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const [socialFilter, setSocialFilter] = useState('all');

  const { data: brand, isLoading } = useBrandDetail(brandId || '');
  const { data: threatsRes } = useBrandThreats(brandId || '');
  const { data: profiles } = useBrandSocialProfiles(brandId || '');
  const { data: emailSec } = useBrandEmailSecurity(brandId || '');

  const threats = threatsRes?.data;
  const threatTotal = threatsRes?.total ?? (Array.isArray(threats) ? threats.length : 0);

  const suspiciousCount = profiles?.filter(p => p.classification === 'suspicious' || p.classification === 'impersonation').length ?? 0;

  const filteredProfiles = profiles?.filter(p => {
    if (socialFilter === 'all') return true;
    if (socialFilter === 'official') return p.classification === 'official';
    if (socialFilter === 'suspicious') return p.classification === 'suspicious' || p.classification === 'impersonation';
    if (socialFilter === 'safe') return p.classification === 'safe' || p.classification === 'official';
    return true;
  }) ?? [];

  const socialTabs = [
    { id: 'all', label: 'All Profiles', count: profiles?.length },
    { id: 'official', label: 'Official' },
    { id: 'suspicious', label: 'Suspicious', count: suspiciousCount },
    { id: 'safe', label: 'Safe' },
  ];

  if (isLoading) return <PageLoader />;

  if (!brand) {
    return (
      <div className="animate-fade-in">
        <button onClick={() => navigate('/brands')} className="font-mono text-xs text-contrail/50 hover:text-accent transition-colors mb-4">
          ← Back to Brands
        </button>
        <Card hover={false}><p className="text-sm text-contrail/60">Brand not found</p></Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={() => navigate('/brands')} className="font-mono text-xs text-contrail/50 hover:text-accent transition-colors">
        ← Back to Brands
      </button>

      <div className="flex items-center gap-4">
        <img
          src={`https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=32`}
          alt=""
          className="w-8 h-8 rounded"
        />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold text-parchment">{brand.name}</h1>
            {brand.sector && <Badge variant="info">{brand.sector}</Badge>}
            <Badge variant={brand.monitoring_status === 'active' ? 'success' : 'default'}>
              {brand.monitoring_status}
            </Badge>
          </div>
          <div className="font-mono text-sm text-contrail/50">{brand.canonical_domain}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Active Threats" value={threatTotal} />
        <StatCard label="Exposure Score" value={brand.exposure_score ?? '—'} />
        <StatCard label="Email Grade" value={brand.email_security_grade ?? '—'} />
        <StatCard label="Social Risk" value={brand.social_risk_score ?? '—'} />
        <StatCard label="Last Social Scan" value={relativeTime(brand.last_social_scan)} />
      </div>

      {brand.threat_analysis && (
        <Card hover={false} className="border-l-[3px] border-accent">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <SectionLabel>AI Threat Analysis</SectionLabel>
              <Badge variant="critical">CURRENT</Badge>
            </div>
            <p className="text-sm text-parchment/80 whitespace-pre-line leading-relaxed">
              {brand.threat_analysis}
            </p>
            {brand.analysis_updated_at && (
              <div className="font-mono text-xs text-contrail/40">
                Updated {relativeTime(brand.analysis_updated_at)}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="primary" size="sm">AI DEEP SCAN</Button>
              <Button variant="ghost" size="sm">REFRESH</Button>
            </div>
          </div>
        </Card>
      )}

      {emailSec && (
        <Card hover={false}>
          <SectionLabel className="mb-3">Email Security</SectionLabel>
          <p className="text-sm text-contrail/60">Email security data loaded. Grade: {brand.email_security_grade ?? 'N/A'}</p>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <SectionLabel>Social Profiles</SectionLabel>
          <Badge variant="info">{profiles?.length ?? 0}</Badge>
        </div>
        <Tabs tabs={socialTabs} activeTab={socialFilter} onChange={setSocialFilter} />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProfiles.map(profile => (
            <Card key={profile.id} hover={false} className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg w-7 text-center">
                    {PLATFORM_ICONS[(profile.platform ?? '').toLowerCase()] ?? '●'}
                  </span>
                  <span className="font-mono font-semibold text-sm text-parchment">@{profile.handle}</span>
                </div>
                <Badge variant={classificationVariant(profile.classification)}>
                  {profile.classification}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-contrail/50">Impersonation Score</span>
                  <span className="font-mono text-xs text-parchment">{profile.impersonation_score}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full bg-accent rounded transition-all"
                    style={{ width: `${Math.min(profile.impersonation_score, 100)}%` }}
                  />
                </div>
              </div>

              {profile.ai_assessment && (
                <p className="text-xs text-contrail/60 line-clamp-3">{profile.ai_assessment}</p>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="ghost" size="sm">Confirm Safe</Button>
                <Button variant="danger" size="sm">Impersonation</Button>
                <Button variant="ghost" size="sm">False Positive</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
