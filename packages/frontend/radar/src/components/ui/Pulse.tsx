import { cn } from "../../lib/cn";

type PulseColor = "green" | "cyan" | "red" | "blue" | "gray" | "purple";
type PulseSize = "sm" | "md" | "lg";

const colorMap: Record<PulseColor, string> = {
  green:  "bg-green-500",
  cyan:   "bg-blue-500",
  red:    "bg-red-500",
  blue:   "bg-blue-400",
  gray:   "bg-gray-500",
  purple: "bg-purple-400",
};

const sizeMap: Record<PulseSize, string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
};

interface PulseProps {
  color?: PulseColor;
  size?: PulseSize;
  animate?: boolean;
  className?: string;
}

export function Pulse({ color = "green", size = "md", animate = true, className }: PulseProps) {
  return (
    <span className={cn("relative inline-flex", sizeMap[size], className)}>
      {animate && (
        <span className={cn(
          "absolute inset-0 rounded-full opacity-50 animate-ping",
          colorMap[color]
        )} />
      )}
      <span className={cn("relative rounded-full", colorMap[color], sizeMap[size])} />
    </span>
  );
}
