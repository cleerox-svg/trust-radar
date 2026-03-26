import { cn } from '@/lib/cn';

const variants = {
  critical: 'bg-accent/10 text-accent border-accent/25',
  high: 'bg-warning/10 text-warning border-warning/25',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
  low: 'bg-contrail/10 text-contrail border-contrail/25',
  success: 'bg-positive/10 text-positive border-positive/25',
  info: 'bg-contrail/8 text-contrail border-contrail/15',
  default: 'bg-white/5 text-parchment/60 border-white/10',
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
