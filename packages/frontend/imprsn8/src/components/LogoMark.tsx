/**
 * LogoMark — brand icon for imprsn8
 *
 * Three variants to choose from:
 *   "rings"   — stacked double-ring (figure-8) — identity layers
 *   "radar"   — scanner reticle with crosshair ticks — detection / AI
 *   "shield"  — rounded shield with spark inside — protection
 *
 * Usage:
 *   <LogoMark variant="rings" size={36} />
 *   <WordMark variant="rings" size={36} textSize="text-xl" />
 */

interface LogoMarkProps {
  variant?: "rings" | "radar" | "shield";
  size?: number;
  className?: string;
}

export function LogoMark({ variant = "rings", size = 36, className = "" }: LogoMarkProps) {
  const id = `lm-${variant}-${size}`;

  if (variant === "rings") {
    return (
      <svg
        width={size} height={size}
        viewBox="0 0 40 40"
        fill="none"
        className={className}
        aria-label="imprsn8 logo"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        {/* Top ring */}
        <circle cx="20" cy="13" r="9.5" stroke={`url(#${id})`} strokeWidth="2.5" />
        {/* Bottom ring */}
        <circle cx="20" cy="27" r="9.5" stroke={`url(#${id})`} strokeWidth="2.5" />
        {/* Center connector pulse dot */}
        <circle cx="20" cy="20" r="2" fill={`url(#${id})`} />
      </svg>
    );
  }

  if (variant === "radar") {
    return (
      <svg
        width={size} height={size}
        viewBox="0 0 40 40"
        fill="none"
        className={className}
        aria-label="imprsn8 logo"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        {/* Outer dashed orbit */}
        <circle cx="20" cy="20" r="17" stroke={`url(#${id})`} strokeWidth="1.2" strokeDasharray="3.5 3" strokeLinecap="round" />
        {/* Mid ring */}
        <circle cx="20" cy="20" r="10" stroke={`url(#${id})`} strokeWidth="2" />
        {/* Inner filled dot */}
        <circle cx="20" cy="20" r="3" fill={`url(#${id})`} />
        {/* Crosshair ticks — top, bottom, left, right */}
        <line x1="20" y1="3"  x2="20" y2="8"  stroke={`url(#${id})`} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="20" y1="32" x2="20" y2="37" stroke={`url(#${id})`} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="3"  y1="20" x2="8"  y2="20" stroke={`url(#${id})`} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="32" y1="20" x2="37" y2="20" stroke={`url(#${id})`} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  // variant === "shield"
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-label="imprsn8 logo"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {/* Shield outline */}
      <path
        d="M20 3 L35 9.5 L35 22 C35 30.5 20 38 20 38 C20 38 5 30.5 5 22 L5 9.5 Z"
        stroke={`url(#${id})`}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Subtle fill */}
      <path
        d="M20 3 L35 9.5 L35 22 C35 30.5 20 38 20 38 C20 38 5 30.5 5 22 L5 9.5 Z"
        fill={`url(#${id})`}
        opacity="0.08"
      />
      {/* Inner spark / lightning bolt */}
      <path
        d="M22 12 L16 21.5 L20.5 21.5 L18 30 L26 18.5 L21 18.5 Z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}

/** Full wordmark: icon + "imprsn8" text */
interface WordMarkProps extends LogoMarkProps {
  textSize?: string;
  hideIcon?: boolean;
}

export function WordMark({
  variant = "rings",
  size = 32,
  textSize = "text-xl",
  hideIcon = false,
  className = "",
}: WordMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {!hideIcon && <LogoMark variant={variant} size={size} />}
      <span className={`syne font-extrabold tracking-tight text-slate-100 ${textSize}`}>
        imprsn<span className="text-gold">8</span>
      </span>
    </span>
  );
}
