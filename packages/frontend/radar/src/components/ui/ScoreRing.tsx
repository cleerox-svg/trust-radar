import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";

type ScoreHealth = "exceptional" | "protected" | "attention" | "vulnerable" | "critical";

function getScoreHealth(score: number): ScoreHealth {
  if (score >= 90) return "exceptional";
  if (score >= 70) return "protected";
  if (score >= 50) return "attention";
  if (score >= 30) return "vulnerable";
  return "critical";
}

const healthColors: Record<ScoreHealth, string> = {
  exceptional: "#22D3EE",  // cyan-400
  protected:   "#22C55E",  // green
  attention:   "#EAB308",  // amber
  vulnerable:  "#F97316",  // orange
  critical:    "#EF4444",  // red
};

const healthLabels: Record<ScoreHealth, string> = {
  exceptional: "Exceptional",
  protected:   "Protected",
  attention:   "Attention",
  vulnerable:  "Vulnerable",
  critical:    "Critical",
};

interface ScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  className?: string;
  animated?: boolean;
}

const sizes = {
  sm: { diameter: 40, stroke: 3, fontSize: "text-xs", labelSize: "text-[8px]" },
  md: { diameter: 80, stroke: 3, fontSize: "text-lg", labelSize: "text-[10px]" },
  lg: { diameter: 140, stroke: 4, fontSize: "text-3xl", labelSize: "text-xs" },
  xl: { diameter: 200, stroke: 4, fontSize: "text-5xl", labelSize: "text-sm" },
};

export function ScoreRing({ score, size = "md", label, className, animated = true }: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const { diameter, stroke, fontSize, labelSize } = sizes[size];
  const radius = (diameter - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const health = getScoreHealth(score);
  const color = healthColors[health];
  const offset = circumference - (score / 100) * circumference;

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }

    const duration = 900;
    const startValue = displayScore;

    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // cubic-bezier(0.34, 1.1, 0.64, 1) approximation - ease-out-back
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (score - startValue) * eased);
      setDisplayScore(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [score, animated]);

  const showLabel = size !== "sm";

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      <svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
        className="transform -rotate-90"
      >
        {/* Track */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={2}
        />
        {/* Progress arc */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={animated ? undefined : offset}
          strokeLinecap="round"
          style={animated ? {
            strokeDashoffset: offset,
            transition: "stroke-dashoffset 900ms cubic-bezier(0.34, 1.1, 0.64, 1)",
          } : undefined}
        />
      </svg>
      {/* Score numeral */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-mono font-bold", fontSize)} style={{ color }}>
          {displayScore}
        </span>
        {showLabel && (
          <>
            <span className={cn("font-mono uppercase tracking-wider", labelSize)} style={{ color: "var(--text-tertiary)" }}>
              {label || healthLabels[health]}
            </span>
            {/* Health indicator dot */}
            <span
              className="mt-1 h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
          </>
        )}
      </div>
    </div>
  );
}
