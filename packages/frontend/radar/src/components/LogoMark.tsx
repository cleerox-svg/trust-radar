/**
 * LogoMark — brand icon for Trust Radar
 *
 * Two variants:
 *   "radar"  — concentric scan rings with sweep arc + crosshair ticks — detection
 *   "pulse"  — target reticle with animated inner dot — live intelligence
 *
 * Usage:
 *   <LogoMark size={36} />
 *   <WordMark size={28} textSize="text-xl" />
 */

interface LogoMarkProps {
  variant?: "radar" | "pulse";
  size?: number;
  className?: string;
}

export function LogoMark({ variant = "radar", size = 36, className = "" }: LogoMarkProps) {
  const id = `tr-lm-${variant}-${size}`;

  if (variant === "pulse") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        className={className}
        aria-label="Trust Radar logo"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>
        </defs>
        {/* Outer dashed orbit */}
        <circle cx="20" cy="20" r="17" stroke={`url(#${id})`} strokeWidth="1" strokeDasharray="4 3" strokeLinecap="round" />
        {/* Mid ring */}
        <circle cx="20" cy="20" r="10" stroke={`url(#${id})`} strokeWidth="1.8" />
        {/* Inner ring */}
        <circle cx="20" cy="20" r="4.5" stroke={`url(#${id})`} strokeWidth="1.4" />
        {/* Center dot */}
        <circle cx="20" cy="20" r="2" fill={`url(#${id})`} />
        {/* Crosshair ticks */}
        <line x1="20" y1="1"  x2="20" y2="6.5"  stroke={`url(#${id})`} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="20" y1="33.5" x2="20" y2="39" stroke={`url(#${id})`} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="1"  y1="20" x2="6.5"  y2="20" stroke={`url(#${id})`} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="33.5" y1="20" x2="39" y2="20" stroke={`url(#${id})`} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  // variant === "radar" (default)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-label="Trust Radar logo"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id={`${id}-sweep`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Outer ring */}
      <circle cx="20" cy="20" r="16" stroke={`url(#${id})`} strokeWidth="1.5" />
      {/* Mid ring */}
      <circle cx="20" cy="20" r="9" stroke={`url(#${id})`} strokeWidth="1.5" />
      {/* Radar sweep arc — top-right quadrant */}
      <path
        d="M20 20 L20 4 A16 16 0 0 1 36 20 Z"
        fill={`url(#${id}-sweep)`}
      />
      {/* Center dot */}
      <circle cx="20" cy="20" r="2.5" fill={`url(#${id})`} />
      {/* Crosshair ticks */}
      <line x1="20" y1="2"  x2="20" y2="6"  stroke={`url(#${id})`} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="20" y1="34" x2="20" y2="38" stroke={`url(#${id})`} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2"  y1="20" x2="6"  y2="20" stroke={`url(#${id})`} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="34" y1="20" x2="38" y2="20" stroke={`url(#${id})`} strokeWidth="1.8" strokeLinecap="round" />
      {/* Blip — detected target on sweep edge */}
      <circle cx="32" cy="12" r="1.8" fill="#22D3EE" opacity="0.9" />
    </svg>
  );
}

/** Full wordmark: icon + "Trust Radar" text */
interface WordMarkProps extends LogoMarkProps {
  textSize?: string;
  hideIcon?: boolean;
}

export function WordMark({
  variant = "radar",
  size = 32,
  textSize = "text-xl",
  hideIcon = false,
  className = "",
}: WordMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {!hideIcon && <LogoMark variant={variant} size={size} />}
      <span
        className={`font-display font-bold tracking-tight text-[--text-primary] ${textSize}`}
        style={{ fontFamily: "var(--font-display, inherit)" }}
      >
        Trust <span style={{ color: "#22D3EE" }}>Radar</span>
      </span>
    </span>
  );
}
