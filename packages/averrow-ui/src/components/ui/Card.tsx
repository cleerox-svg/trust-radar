import { cn } from '@/lib/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = true }: CardProps) {
  return (
    <div className={cn(
      'bg-instrument border border-white/[0.06] rounded-xl p-4 transition-all duration-200',
      hover && 'hover:border-accent/15 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20',
      className,
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('font-mono text-xs font-bold text-accent uppercase tracking-wider mb-3', className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('', className)}>{children}</div>;
}
