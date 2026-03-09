import { Badge, type BadgeProps } from "./Badge";

type ThreatLevel = "critical" | "high" | "medium" | "low" | "none" | "info";

interface ThreatBadgeProps extends Omit<BadgeProps, "variant"> {
  level: ThreatLevel;
}

export function ThreatBadge({ level, children, ...props }: ThreatBadgeProps) {
  const variant = level === "none" ? "none" : level;
  return (
    <Badge variant={variant} {...props}>
      {children || level}
    </Badge>
  );
}
