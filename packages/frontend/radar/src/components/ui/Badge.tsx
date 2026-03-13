import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default:  "border-[--border-default] bg-surface-overlay text-[--text-secondary]",
        critical: "border-threat-critical/25 bg-threat-critical/10 text-threat-critical",
        high:     "border-threat-high/25 bg-threat-high/10 text-threat-high",
        medium:   "border-threat-medium/25 bg-threat-medium/10 text-threat-medium",
        low:      "border-threat-low/25 bg-threat-low/10 text-threat-low",
        info:     "border-cyan-500/25 bg-cyan-500/10 text-blue-500",
        none:     "border-threat-none/25 bg-threat-none/10 text-threat-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
