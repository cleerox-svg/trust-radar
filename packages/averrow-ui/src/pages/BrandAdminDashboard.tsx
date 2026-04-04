import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, Activity, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useBrandAdminDashboard } from '@/hooks/useBrandAdminDashboard';
import { StatCard } from '@/components/ui/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { severityColor } from '@/lib/severityColor';
import { relativeTime } from '@/lib/time';

function emailGrade(score: number | null): string {
  if (score === null) return '-';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function BrandAdminDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useBrandAdminDashboard();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const orgName = user?.organization?.name ?? 'Your Organization';
  const plan = user?.organization?.plan ?? 'standard';

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold text-parchment">
          Welcome, {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="font-mono text-[11px] text-contrail/60 mt-1">
          {orgName} &middot; {plan} plan
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Your Threats"
          value={data?.total_threats ?? 0}
          accentColor="#C83C3C"
        />
        <StatCard
          label="Active Now"
          value={data?.active_threats ?? 0}
          accentColor="#FB923C"
        />
        <StatCard
          label="Brands"
          value={data?.brand_count ?? 0}
          accentColor="#0A8AB5"
        />
        <StatCard
          label="Email Grade"
          value={emailGrade(data?.avg_email_score ?? null)}
          accentColor={data?.avg_email_score ? severityColor(data.avg_email_score) : '#78A0C8'}
        />
      </div>

      {/* Brand Health Cards */}
      {data?.brand_health && data.brand_health.length > 0 && (
        <section>
          <SectionLabel>Brand Health</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
            {data.brand_health.map((brand) => (
              <Link
                key={brand.id}
                to={`/brands/${brand.id}`}
                className="glass-stat p-4 rounded-xl border border-white/10 hover:border-afterburner/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-wing-blue" />
                  <span className="font-display text-sm font-semibold text-parchment truncate">{brand.name}</span>
                </div>
                <div className="font-mono text-[10px] text-contrail/50 mt-0.5">{brand.canonical_domain}</div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: severityColor(null, brand.threat_count) }}
                    />
                    <span className="font-mono text-[11px] text-parchment/80">{brand.threat_count} threats</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity size={10} className="text-contrail/50" />
                    <span className="font-mono text-[11px] text-parchment/80">{brand.active_threats} active</span>
                  </div>
                  {brand.email_security_grade && (
                    <div className="flex items-center gap-1.5">
                      <Mail size={10} className="text-contrail/50" />
                      <span
                        className="font-mono text-[11px] font-bold"
                        style={{ color: severityColor(brand.email_security_score) }}
                      >
                        {brand.email_security_grade}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Threats */}
      {data?.recent_threats && data.recent_threats.length > 0 && (
        <section>
          <SectionLabel>Recent Threats (24h)</SectionLabel>
          <div className="glass-card rounded-xl border border-white/10 overflow-hidden mt-3 overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">Type</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">Domain</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">Brand</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">Severity</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_threats.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-[11px] text-parchment/80">{t.threat_type}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-contrail truncate max-w-[200px]">{t.malicious_domain ?? '-'}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-parchment/70">{t.brand_name ?? '-'}</td>
                    <td className="px-4 py-2">
                      <span
                        className="font-mono text-[10px] font-bold uppercase"
                        style={{ color: severityColor(null, t.severity === 'critical' ? 200 : t.severity === 'high' ? 100 : t.severity === 'medium' ? 50 : 1) }}
                      >
                        {t.severity ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-contrail/50">{relativeTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Alert Feed & Takedown Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <section>
          <SectionLabel>Recent Alerts</SectionLabel>
          <div className="space-y-2 mt-3">
            {data?.recent_alerts && data.recent_alerts.length > 0 ? (
              data.recent_alerts.slice(0, 8).map((a) => (
                <div key={a.id} className="glass-stat p-3 rounded-lg border border-white/10 flex items-center gap-3">
                  <AlertTriangle
                    size={14}
                    style={{ color: severityColor(null, a.severity === 'CRITICAL' ? 200 : a.severity === 'HIGH' ? 100 : 20) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] text-parchment/90 truncate">{a.title}</div>
                    <div className="font-mono text-[9px] text-contrail/50">{a.brand_name} &middot; {relativeTime(a.created_at)}</div>
                  </div>
                  <span className="font-mono text-[9px] uppercase text-white/55">{a.status}</span>
                </div>
              ))
            ) : (
              <div className="font-mono text-[11px] text-white/40 py-4 text-center">No recent alerts</div>
            )}
          </div>
        </section>

        {/* Takedown Status */}
        <section>
          <SectionLabel>Takedown Status</SectionLabel>
          <div className="glass-stat p-5 rounded-xl border border-white/10 mt-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-display text-2xl font-bold text-parchment">{data?.takedown_summary?.total ?? 0}</div>
                <div className="font-mono text-[10px] text-contrail/60 uppercase tracking-wider">Total Requests</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-afterburner">{data?.takedown_summary?.pending ?? 0}</div>
                <div className="font-mono text-[10px] text-contrail/60 uppercase tracking-wider">Pending</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-positive">{data?.takedown_summary?.taken_down ?? 0}</div>
                <div className="font-mono text-[10px] text-contrail/60 uppercase tracking-wider">Taken Down</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-accent">{data?.takedown_summary?.failed ?? 0}</div>
                <div className="font-mono text-[10px] text-contrail/60 uppercase tracking-wider">Failed</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
