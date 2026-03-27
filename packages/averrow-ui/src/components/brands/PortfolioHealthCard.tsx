import { useMemo } from 'react';

interface Brand {
  exposure_score: number | null;
  threat_count: number;
}

interface Props {
  brands: Brand[];
}

const SEGMENTS = [
  { key: 'critical', label: 'Critical', color: '#f87171' },
  { key: 'high', label: 'High', color: '#fb923c' },
  { key: 'medium', label: 'Medium', color: '#fbbf24' },
  { key: 'clean', label: 'Clean', color: '#4ade80' },
] as const;

const CIRCUMFERENCE = 2 * Math.PI * 30; // ≈ 188.5
const GAP = 2;

export function PortfolioHealthCard({ brands }: Props) {
  const buckets = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let clean = 0;

    for (const b of brands) {
      const s = b.exposure_score;
      const t = b.threat_count;
      if ((s !== null && s < 40) || t >= 200) critical++;
      else if ((s !== null && s < 60) || t >= 100) high++;
      else if ((s !== null && s < 80) || t >= 50) medium++;
      else clean++;
    }
    return { critical, high, medium, clean };
  }, [brands]);

  const total = brands.length;
  const counts = [buckets.critical, buckets.high, buckets.medium, buckets.clean];
  const nonZero = counts.filter((c) => c > 0);

  // Build SVG donut segments
  const segments: { color: string; dashArray: string; dashOffset: number }[] = [];
  let offset = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 0) continue;
    const segLen = (counts[i] / total) * CIRCUMFERENCE - (nonZero.length > 1 ? GAP : 0);
    segments.push({
      color: SEGMENTS[i].color,
      dashArray: `${Math.max(segLen, 0)} ${CIRCUMFERENCE}`,
      dashOffset: -offset,
    });
    offset += (counts[i] / total) * CIRCUMFERENCE;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-cockpit p-3">
      <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-contrail/70 mb-3 block">
        Portfolio Health
      </span>

      <div className="flex justify-center mb-3">
        <svg viewBox="0 0 80 80" className="w-20 h-20">
          {/* Background ring */}
          <circle
            cx={40}
            cy={40}
            r={30}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={10}
          />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={40}
              cy={40}
              r={30}
              fill="none"
              stroke={seg.color}
              strokeWidth={10}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="butt"
              transform="rotate(-90 40 40)"
            />
          ))}
          <text
            x={40}
            y={40}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-white/90 font-bold text-[18px]"
          >
            {total}
          </text>
        </svg>
      </div>

      <div className="space-y-1.5">
        {SEGMENTS.map((seg) => {
          const count = buckets[seg.key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={seg.key} className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: seg.color }}
              />
              <span className="text-[11px] text-white/60 flex-1">{seg.label}</span>
              <span className="text-[11px] font-mono text-white/80">{count}</span>
              <span className="text-[10px] font-mono text-white/30 w-8 text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
