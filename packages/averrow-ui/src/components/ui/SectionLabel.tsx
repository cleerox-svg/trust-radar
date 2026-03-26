import { cn } from '@/lib/cn';

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('font-mono text-xs font-bold text-accent uppercase tracking-wider', className)}>
      {children}
    </div>
  );
}
