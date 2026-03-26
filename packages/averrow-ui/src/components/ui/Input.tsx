import { cn } from '@/lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'bg-instrument border border-white/[0.08] rounded-md px-3 py-2 text-sm text-parchment',
        'placeholder:text-contrail/30 focus:outline-none focus:border-accent/30',
        className
      )}
      {...props}
    />
  );
}
