import { cn } from '@/lib/cn';

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-transparent border border-white/10 text-parchment/70 hover:bg-white/5',
  ghost: 'bg-transparent text-contrail hover:bg-white/5',
  success: 'bg-positive text-white hover:bg-positive/80',
  danger: 'bg-accent text-white hover:bg-accent-hover',
} as const;

const sizes = {
  sm: 'px-3 py-1.5 text-[11px]',
  md: 'px-4 py-2 text-xs',
  lg: 'px-6 py-2.5 text-sm',
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-mono font-semibold uppercase tracking-wide rounded-md transition-all duration-150',
        'hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
