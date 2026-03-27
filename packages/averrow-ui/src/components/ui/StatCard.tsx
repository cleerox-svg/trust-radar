import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  accentColor?: string;
  className?: string;
}

export function StatCard({ label, value, sublabel, trend, trendDirection, accentColor, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'glass-card card-accent-top rounded-xl p-5 transition-all',
        accentColor && 'border-l-[3px]',
        className,
      )}
      style={accentColor ? { borderLeftColor: accentColor } : undefined}
    >
      <div className={cn(
        'font-display text-2xl font-extrabold text-parchment',
        accentColor === '#C83C3C' && 'glow-red',
        accentColor === '#FB923C' && 'glow-amber',
        accentColor === '#4ADE80' && 'glow-green',
        !accentColor && 'glow-teal',
      )}>{value}</div>
      <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-contrail/60 mt-1">{label}</div>
      {sublabel && <div className="font-mono text-[9px] text-parchment/30 mt-0.5">{sublabel}</div>}
      {trend && (
        <div className={cn(
          'font-mono text-[10px] mt-1',
          trendDirection === 'up' ? 'text-positive' : trendDirection === 'down' ? 'text-accent' : 'text-contrail/40',
        )}>
          {trend}
        </div>
      )}
    </div>
  );
}
