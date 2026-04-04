import type { ReactNode } from 'react';
import Tilt from 'react-parallax-tilt';
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
    <Tilt
      tiltMaxAngleX={5}
      tiltMaxAngleY={5}
      perspective={1200}
      scale={1.015}
      transitionSpeed={500}
      glareEnable={true}
      glareMaxOpacity={0.06}
      glareColor="#E5A832"
      glarePosition="top"
    >
      <div
        className={cn(
          'glass-stat relative p-4 flex flex-col',
          className,
        )}
      >
        {/* Top inner highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent rounded-t-[inherit] pointer-events-none" />

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
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/55">
              {metricLabel}
            </div>
          </div>
        </div>
      </div>
    </Tilt>
  );
}
