import { cn } from "../../lib/cn";

type StatusDotVariant = "active" | "scanning" | "alert" | "idle" | "offline";

const dotStyles: Record<StatusDotVariant, string> = {
  active:   "bg-threat-low animate-pulse",
  scanning: "bg-purple-400 animate-pulse",
  alert:    "bg-threat-critical animate-pulse",
  idle:     "bg-surface-float",
  offline:  "bg-surface-float opacity-50",
};

interface StatusDotProps {
  variant?: StatusDotVariant;
  size?: "sm" | "md";
  className?: string;
}

export function StatusDot({ variant = "idle", size = "sm", className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full shrink-0",
        size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
        dotStyles[variant],
        className
      )}
    />
  );
}
