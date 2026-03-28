import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useSpamTrapAddresses } from '@/hooks/useSpamTrap';
import { StatCard } from '@/components/ui/StatCard';
import { HoneypotNetworkPanel } from '@/components/spam-trap/HoneypotNetworkPanel';
import { PageLoader } from '@/components/ui/PageLoader';

export function SpamTrap() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const { data: addresses } = useSpamTrapAddresses();

  if (authLoading) return <PageLoader />;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const seedCount = addresses?.length ?? 0;
  const domainCount = addresses
    ? new Set(addresses.map((a) => a.domain)).size
    : 0;
  const captureCount = addresses
    ? addresses.reduce((sum, a) => sum + a.total_catches, 0)
    : 0;
  const catchRate =
    seedCount > 0 ? ((captureCount / seedCount) * 100).toFixed(1) + '%' : '—';

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Spam Trap</h1>
          <p className="text-white/50 text-sm font-mono mt-1">
            THREAT ACTOR INTELLIGENCE · HONEYPOT NETWORK
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="dot-pulse dot-pulse-green" />
          <span className="text-xs font-mono text-white/50">HONEYPOT ACTIVE</span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="SEEDS DEPLOYED" value={seedCount} accentColor="#00D4FF" />
        <StatCard label="DOMAINS" value={domainCount} accentColor="#00D4FF" />
        <StatCard label="CAPTURES" value={captureCount} accentColor="#fb923c" />
        <StatCard label="CATCH RATE" value={catchRate} accentColor="#4ADE80" />
      </div>

      {/* 2x2 panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HoneypotNetworkPanel />
        <div className="glass-card rounded-xl p-4 min-h-[400px] flex items-center justify-center">
          <span className="text-white/20 text-sm font-mono">
            CAPTURE FORENSICS — COMING NEXT
          </span>
        </div>
        <div className="glass-card rounded-xl p-4 min-h-[400px] flex items-center justify-center">
          <span className="text-white/20 text-sm font-mono">
            CAMPAIGN INTELLIGENCE — COMING NEXT
          </span>
        </div>
        <div className="glass-card rounded-xl p-4 min-h-[400px] flex items-center justify-center">
          <span className="text-white/20 text-sm font-mono">
            THREAT ACTOR PROFILING — COMING NEXT
          </span>
        </div>
      </div>
    </div>
  );
}
