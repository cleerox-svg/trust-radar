import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[--border-default] bg-surface-base px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-tertiary] transition-all duration-150",
          "focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
