import { useEffect, useRef, useState } from "react";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export type ScoreSize = "hero-xl" | "hero-lg" | "card-md" | "list-sm";

const SIZE_MAP: Record<ScoreSize, { diameter: number; strokeWidth: number; fontSize: number; labelSize: number }> = {
  "hero-xl": { diameter: 200, strokeWidth: 4,  fontSize: 54, labelSize: 11 },
  "hero-lg": { diameter: 140, strokeWidth: 3,  fontSize: 38, labelSize: 11 },
  "card-md": { diameter: 80,  strokeWidth: 3,  fontSize: 22, labelSize: 10 },
  "list-sm": { diameter: 40,  strokeWidth: 2,  fontSize: 12, labelSize: 0  },
};

function scoreColor(score: number): string {
  if (score >= 90) return "#F0A500"; // gold-400 "Exceptional"
  if (score >= 70) return "#16A34A"; // green-400 "Protected"
  if (score >= 50) return "#EF9F0A"; // amber-400 "Attention"
  if (score >= 30) return "#F97316"; // threat-high "Vulnerable"
  return "#E8163B";                  // red-400 "Critical"
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Exceptional";
  if (score >= 70) return "Protected";
  if (score >= 50) return "Attention";
  if (score >= 30) return "Vulnerable";
  return "Critical";
}

// Animates a number from prev → next over duration ms (requestAnimationFrame)
function useCountTo(target: number, duration = 800) {
  const reduced = usePrefersReducedMotion();
  const [current, setCurrent] = useState(target);
  const prev = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    if (from === target) return;
    // Skip animation if user prefers reduced motion
    if (reduced) { setCurrent(target); prev.current = target; return; }
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(from + (target - from) * ease));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else prev.current = target;
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, reduced]);

  return current;
}

interface ScoreRingProps {
  score: number;
  size?: ScoreSize;
  label?: string;
  showLabel?: boolean;
  showHealth?: boolean;
  className?: string;
}

export function ScoreRing({
  score,
  size = "card-md",
  label = "Brand Health Score",
  showLabel = true,
  showHealth = false,
  className = "",
}: ScoreRingProps) {
  const { diameter, strokeWidth, fontSize, labelSize } = SIZE_MAP[size];
  const radius = (diameter - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = diameter / 2;
  const cy = diameter / 2;

  const reduced = usePrefersReducedMotion();
  const animatedScore = useCountTo(score);

  // Arc draws in on mount (skip if reduced motion)
  const [mounted, setMounted] = useState(reduced);
  useEffect(() => { setMounted(true); }, []);
  const dashOffset = mounted
    ? circumference - (score / 100) * circumference
    : circumference;

  const color = scoreColor(score);
  const health = scoreLabel(score);

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: diameter, height: diameter }}>
        <svg
          width={diameter}
          height={diameter}
          viewBox={`0 0 ${diameter} ${diameter}`}
          className="-rotate-90"
          aria-label={`${label}: ${score} out of 100`}
          role="img"
        >
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc — draws in on mount, animates on change */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: mounted
                ? "stroke-dashoffset 600ms ease-in-out, stroke 400ms ease"
                : "stroke-dashoffset 900ms cubic-bezier(0.34, 1.1, 0.64, 1)",
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="font-display tabular font-bold leading-none"
            style={{ fontSize, color, fontVariantNumeric: "tabular-nums" }}
            aria-live="polite"
          >
            {animatedScore}
          </span>
          {showHealth && size === "hero-xl" && (
            <span className="status-dot mt-2" style={{ background: color }} />
          )}
        </div>
      </div>

      {showLabel && labelSize > 0 && (
        <div
          className="text-center uppercase tracking-widest font-semibold"
          style={{ fontSize: labelSize, color: "var(--text-tertiary)", letterSpacing: "0.06em" }}
        >
          {label}
        </div>
      )}

      {showHealth && size === "hero-xl" && (
        <div
          className="font-medium"
          style={{ fontSize: 12, color }}
        >
          {health}
        </div>
      )}
    </div>
  );
}
