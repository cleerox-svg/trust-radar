/**
 * Pulse — animated status indicator
 * Used for "GUARDING / SOC ACTIVE" and live agent status
 */

type PulseColor = "green" | "gold" | "red" | "blue" | "gray";

const COLOR_MAP: Record<PulseColor, { dot: string; ring: string }> = {
  green: { dot: "bg-status-live",      ring: "bg-status-live" },
  gold:  { dot: "bg-gold",             ring: "bg-gold" },
  red:   { dot: "bg-threat-critical",  ring: "bg-threat-critical" },
  blue:  { dot: "bg-status-scheduled", ring: "bg-status-scheduled" },
  gray:  { dot: "bg-status-idle",      ring: "bg-status-idle" },
};

interface PulseProps {
  color?: PulseColor;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
}

const SIZE_MAP = { sm: "w-2 h-2", md: "w-2.5 h-2.5", lg: "w-3 h-3" };

export function Pulse({ color = "green", size = "md", animate = true, className = "" }: PulseProps) {
  const { dot, ring } = COLOR_MAP[color];
  const sz = SIZE_MAP[size];

  return (
    <span className={`relative inline-flex ${className}`}>
      {animate && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${ring} opacity-50`} />
      )}
      <span className={`relative inline-flex rounded-full ${sz} ${dot}`} />
    </span>
  );
}
