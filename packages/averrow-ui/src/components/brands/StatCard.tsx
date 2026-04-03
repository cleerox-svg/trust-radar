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
        'glass-stat relative p-4 flex flex-col',
        className,
      )}
    >
      <div className="mb-3 section-label">
        {title}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Left side — breakdown content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>

        {/* Right side — primary metric */}
        <div className="flex flex-col items-start sm:items-center gap-1 border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-3 flex-shrink-0">
          {metric}
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/40">
            {metricLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
