import { cn } from '@/lib/cn';

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('font-mono font-bold section-label', className)}>
      {children}
    </div>
  );
}
