import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  title: string;
  children: ReactNode;
  metric: ReactNode;
  metricLabel: string;
  className?: string;
}

export function StatCard({ title, children, metric, metricLabel, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-console border border-contrail/[0.08] rounded-xl p-4 flex flex-col',
        className,
      )}
    >
      <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-accent mb-3">
        {title}
      </div>
      <div className="flex flex-1 items-stretch gap-0">
        {/* Left side — breakdown content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center pr-3">
          {children}
        </div>

        {/* Vertical divider */}
        <div className="w-px bg-contrail/[0.08] mx-1 self-stretch" />

        {/* Right side — primary metric */}
        <div className="flex flex-col items-center justify-center pl-3 min-w-[72px]">
          <div className="flex flex-col items-center">
            {metric}
          </div>
          <div className="font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-contrail/40 mt-1.5">
            {metricLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
