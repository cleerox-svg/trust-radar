import { useNavigate } from 'react-router-dom';
import { useMobile } from '@/components/mobile';
import { MobileCommandCenter } from '@/components/mobile/MobileCommandCenter';
import { useObservatoryStats } from '@/hooks/useObservatory';
import { useAlertStats } from '@/hooks/useAlerts';
import { useAgents } from '@/hooks/useAgents';
import { useBrandStats } from '@/hooks/useBrands';
import { useNotifications } from '@/hooks/useNotifications';
import { StatCard } from '@/components/ui/StatCard';
import { Shield, AlertTriangle, Bell, Bot, Globe, Activity, Crosshair, Target } from 'lucide-react';

// ── Latest Intel Feed ──────────────────────────────────────────────────
function LatestIntelFeed() {
  const { data } = useNotifications(true);
  const navigate = useNavigate();
  const items = data?.notifications?.slice(0, 5) ?? [];

  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-white/30 font-mono text-xs">
        No recent intelligence events
      </div>
    );
  }

  const severityDot: Record<string, string> = {
    critical: 'bg-[#f87171]',
    high: 'bg-[#fb923c]',
    medium: 'bg-[#fbbf24]',
    low: 'bg-[#78A0C8]',
    info: 'bg-white/30',
  };

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => item.link ? navigate(item.link) : navigate('/alerts')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
            hover:bg-white/[0.03] transition-colors text-left group"
        >
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${severityDot[item.severity] ?? severityDot.info}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors">
              {item.title}
            </p>
            {item.message && (
              <p className="text-[10px] text-white/40 truncate mt-0.5">{item.message}</p>
            )}
          </div>
          <span className="text-[10px] text-white/30 font-mono flex-shrink-0">
            {formatTimeAgo(item.created_at)}
          </span>
        </button>
      ))}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Home Dashboard ─────────────────────────────────────────────────────
export function Home() {
  const isMobile = useMobile();

  if (isMobile) {
    return <MobileCommandCenter />;
  }

  return <HomeDashboard />;
}

function HomeDashboard() {
  const navigate = useNavigate();
  const { data: obsStats } = useObservatoryStats();
  const { data: alertStats } = useAlertStats();
  const { data: agents } = useAgents();
  const { data: brandStats } = useBrandStats();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const safeAgents = Array.isArray(agents) ? agents : [];
  const operationalCount = safeAgents.filter(a => a.status === 'active' || a.status === 'healthy').length;
  const errorCount = safeAgents.filter(a => a.error_count_24h > 0).length;
  const criticalAlerts = alertStats?.critical ?? 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {greeting}
        </h1>
        <p className="text-sm font-mono mt-1" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
        {criticalAlerts > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5
            bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-sm">
              {criticalAlerts} critical alert{criticalAlerts > 1 ? 's' : ''} require attention
            </span>
          </div>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => navigate('/brands')} className="text-left">
          <StatCard
            label="Brands Monitored"
            value={brandStats?.total_tracked ?? 0}
            sublabel={brandStats?.new_this_week ? `${brandStats.new_this_week} new this week` : undefined}
            accentColor="#E5A832"
          />
        </button>
        <button onClick={() => navigate('/threats')} className="text-left">
          <StatCard
            label="Threats Mapped"
            value={obsStats?.threats_mapped?.toLocaleString() ?? 0}
            sublabel={obsStats?.countries ? `${obsStats.countries} countries` : undefined}
            accentColor={criticalAlerts > 0 ? '#C83C3C' : '#FB923C'}
          />
        </button>
        <button onClick={() => navigate('/alerts')} className="text-left">
          <StatCard
            label="Alerts"
            value={alertStats?.total ?? 0}
            sublabel={criticalAlerts > 0 ? `${criticalAlerts} critical` : undefined}
            accentColor={criticalAlerts > 0 ? '#C83C3C' : undefined}
          />
        </button>
        <button onClick={() => navigate('/agents')} className="text-left">
          <StatCard
            label="Agents Running"
            value={`${operationalCount}/${safeAgents.length || 11}`}
            sublabel={errorCount > 0 ? `${errorCount} with errors` : 'All healthy'}
            accentColor={errorCount > 0 ? '#FB923C' : '#4ADE80'}
          />
        </button>
      </div>

      {/* Latest Intel feed */}
      <div className="p-5" style={{ background: 'rgba(22,30,48,0.50)', backdropFilter: 'blur(12px)', border: '1px solid rgba(229,168,50,0.15)', borderRadius: '0.75rem' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
            Latest Intelligence
          </h2>
          <span className="text-white/30 text-[10px] font-mono">
            Powered by Observer
          </span>
        </div>
        <LatestIntelFeed />
      </div>

      {/* Quick nav tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Observatory', icon: <Globe className="w-5 h-5" />, path: '/observatory', desc: 'Global threat map' },
          { label: 'Brands', icon: <Shield className="w-5 h-5" />, path: '/brands', desc: 'Brand health' },
          { label: 'Threat Actors', icon: <Crosshair className="w-5 h-5" />, path: '/threat-actors', desc: 'Adversary profiles' },
          { label: 'Campaigns', icon: <Target className="w-5 h-5" />, path: '/campaigns', desc: 'Active operations' },
        ] as const).map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-start p-4 rounded-xl
              bg-white/[0.03] border border-white/[0.06]
              hover:bg-amber-500/5 hover:border-amber-500/15
              transition-all text-left group"
          >
            <div className="group-hover:text-amber-400 transition-colors mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.4 }}>
              {item.icon}
            </div>
            <p className="font-medium text-sm" style={{ color: 'var(--text-primary)', opacity: 0.8 }}>
              {item.label}
            </p>
            <p className="text-white/30 text-xs mt-0.5">{item.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
