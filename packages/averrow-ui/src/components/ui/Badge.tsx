import { cn } from '@/lib/cn';

const variants = {
  critical: 'badge-glass badge-critical',
  high: 'badge-glass badge-high',
  medium: 'badge-glass badge-medium',
  low: 'badge-glass badge-low',
  success: 'badge-glass badge-active',
  info: 'badge-glass badge-pivot',
  default: 'badge-glass badge-dormant',
} as const;

interface BadgeProps {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center font-mono text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded border',
      variants[variant],
      className,
    )}>
      {children}
    </span>
  );
}
