import { cn } from '@/lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'glass-input rounded-md px-3 py-2 text-sm',
        'placeholder:text-white/40',
        className
      )}
      {...props}
    />
  );
}
