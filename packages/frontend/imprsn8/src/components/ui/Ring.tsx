/**
 * Ring — circular arc score display (replaces ASCII gauge)
 * Used for legitimacy/risk scores 0–100
 */

interface RingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#22C55E"; // green — legitimate
  if (score >= 50) return "#F5C518"; // yellow — caution
  if (score >= 25) return "#FF8C00"; // orange — suspicious
  return "#FF3B3B";                  // red — imposter
}

function scoreLabel(score: number): string {
  if (score >= 80) return "LEGITIMATE";
  if (score >= 50) return "CAUTION";
  if (score >= 25) return "SUSPICIOUS";
  return "IMPOSTER";
}

export function Ring({ score, size = 80, strokeWidth = 8, label, sublabel }: RingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        style={{ overflow: "visible" }}
      >
        {/* Track */}
        <circle
          cx={center} cy={center} r={r}
          fill="none"
          stroke="#1E1B54"
          strokeWidth={strokeWidth}
        />
        {/* Arc */}
        <circle
          cx={center} cy={center} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      {/* Score + label overlay */}
      <div className="text-center -mt-1" style={{ marginTop: `-${size * 0.7}px` }}>
        <div className="font-mono font-bold text-lg leading-none" style={{ color }}>
          {score}
        </div>
      </div>
      <div className="text-center" style={{ marginTop: `${size * 0.35}px` }}>
        <div className="text-[10px] font-semibold tracking-wider" style={{ color }}>
          {label ?? scoreLabel(score)}
        </div>
        {sublabel && (
          <div className="text-[9px] text-slate-500 mt-0.5">{sublabel}</div>
        )}
      </div>
    </div>
  );
}
