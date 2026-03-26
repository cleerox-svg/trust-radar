import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrands, useBrandStats } from '@/hooks/useBrands';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { CardGridLoader } from '@/components/ui/PageLoader';

const TIME_RANGES = ['7d', '30d', '90d', '1y'] as const;

function gradeVariant(grade: string | null): 'success' | 'info' | 'medium' | 'critical' | 'default' {
  if (!grade) return 'default';
  const g = grade.toUpperCase();
  if (g === 'A+' || g === 'A') return 'success';
  if (g === 'B+' || g === 'B') return 'info';
  if (g === 'C+' || g === 'C') return 'medium';
  return 'critical';
}

function threatColor(count: number) {
  if (count > 100) return 'text-accent';
  if (count > 20) return 'text-warning';
  return 'text-contrail';
}

export function Brands() {
  const navigate = useNavigate();
  const [view, setView] = useState('top');
  const [timeRange, setTimeRange] = useState<string>('7d');
  const { data: statsData } = useBrandStats();
  const { data: brandsRes, isLoading } = useBrands({ view, timeRange });

  if (isLoading) return <CardGridLoader count={12} />;

  const brands = brandsRes?.data || [];
  const total = brandsRes?.total || brands.length;

  const tabs = [
    { id: 'top', label: 'TOP TARGETED', count: total },
    { id: 'monitored', label: 'MONITORED' },
    { id: 'all', label: 'ALL BRANDS' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-display text-xl font-bold text-parchment">Brands</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tracked" value={statsData?.total_tracked ?? '—'} />
        <StatCard label="New This Week" value={statsData?.new_this_week ?? '—'} />
        <StatCard label="Fastest Rising" value={statsData?.fastest_rising ?? '—'} sublabel={statsData?.fastest_rising_pct ? `+${statsData.fastest_rising_pct}%` : undefined} />
        <StatCard label="Top Threat Type" value={statsData?.top_threat_type?.replace(/_/g, ' ') ?? '—'} sublabel={statsData?.top_threat_type_pct ? `${statsData.top_threat_type_pct}%` : undefined} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs tabs={tabs} activeTab={view} onChange={setView} />
        <div className="flex gap-1.5">
          {TIME_RANGES.map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`font-mono text-[11px] font-semibold px-3 py-1 rounded transition-all ${
                timeRange === r
                  ? 'bg-accent/10 text-accent border border-accent/25'
                  : 'text-contrail/40 hover:bg-white/5 hover:text-parchment border border-transparent'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {brands.map((brand, idx) => (
            <Card
              key={brand.id}
              className="cursor-pointer"
              hover
            >
              <div
                onClick={() => navigate(`/brands/${brand.id}`)}
                className="space-y-2"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[10px] text-contrail/30">#{idx + 1}</span>
                  {brand.email_security_grade && (
                    <Badge variant={gradeVariant(brand.email_security_grade)}>
                      {brand.email_security_grade}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=32`}
                    alt=""
                    className="w-6 h-6 rounded"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-parchment truncate">{brand.name}</div>
                    {brand.sector && <Badge variant="info" className="mt-0.5">{brand.sector}</Badge>}
                  </div>
                </div>

                <div>
                  <span className={`text-2xl font-extrabold ${threatColor(brand.threat_count)}`}>
                    {brand.threat_count}
                  </span>
                  <span className="font-mono text-xs text-contrail/50 ml-1.5">active threats</span>
                </div>

                <div className="font-mono text-xs text-contrail/40">{brand.canonical_domain}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
