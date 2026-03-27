import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  title: string;
  children: ReactNode;
  metric: ReactNode;
  metricLabel: ReactNode;
  className?: string;
}

export function StatCard({ title, children, metric, metricLabel, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'glass-card card-accent-top rounded-xl p-4 flex flex-col',
        className,
      )}
    >
      <div className="mb-3 font-mono text-[9px] uppercase tracking-widest text-contrail/70">
        {title}
      </div>
      <div className="flex items-center gap-3">
        {/* Left side — breakdown content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>

        {/* Right side — primary metric */}
        <div className="flex flex-col items-center gap-1 border-l border-white/10 pl-3 flex-shrink-0">
          {metric}
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/40">
            {metricLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
