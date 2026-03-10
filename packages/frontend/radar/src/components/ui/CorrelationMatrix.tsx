import { useState } from "react";

interface Props {
  labels: string[];
  /** Flat matrix[row][col] of correlation values from -1 to 1 */
  matrix: number[][];
  className?: string;
}

function getColor(value: number): string {
  if (value >= 0.7) return "rgba(34, 211, 238, 0.8)";   // strong positive — cyan
  if (value >= 0.4) return "rgba(34, 211, 238, 0.45)";  // moderate positive
  if (value >= 0.1) return "rgba(34, 211, 238, 0.15)";  // weak positive
  if (value > -0.1) return "rgba(255, 255, 255, 0.04)";  // neutral
  if (value > -0.4) return "rgba(239, 68, 68, 0.15)";   // weak negative
  if (value > -0.7) return "rgba(239, 68, 68, 0.45)";   // moderate negative
  return "rgba(239, 68, 68, 0.8)";                       // strong negative — red
}

/**
 * Square correlation matrix heatmap.
 * Hover a cell to see exact value.
 */
export function CorrelationMatrix({ labels, matrix, className }: Props) {
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);
  const size = labels.length;

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: `auto repeat(${size}, minmax(32px, 1fr))` }}>
          {/* Header row */}
          <div /> {/* empty corner */}
          {labels.map((l) => (
            <div key={`h-${l}`} className="text-[9px] font-mono text-center truncate px-1 py-1" style={{ color: "var(--text-tertiary)" }}>
              {l}
            </div>
          ))}

          {/* Matrix rows */}
          {matrix.map((row, ri) => (
            <>
              {/* Row label */}
              <div key={`rl-${ri}`} className="text-[9px] font-mono text-right pr-2 flex items-center justify-end" style={{ color: "var(--text-tertiary)" }}>
                {labels[ri]}
              </div>
              {/* Cells */}
              {row.map((val, ci) => {
                const isHovered = hovered?.row === ri && hovered?.col === ci;
                return (
                  <div
                    key={`c-${ri}-${ci}`}
                    className="aspect-square rounded-sm flex items-center justify-center text-[9px] font-mono transition-all relative"
                    style={{
                      background: getColor(val),
                      color: Math.abs(val) > 0.4 ? "var(--text-primary)" : "var(--text-tertiary)",
                      outline: isHovered ? "1px solid var(--cyan-400)" : "none",
                      cursor: "default",
                    }}
                    onMouseEnter={() => setHovered({ row: ri, col: ci })}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {(isHovered || size <= 6) && (
                      <span>{val.toFixed(2)}</span>
                    )}
                    {isHovered && (
                      <div
                        className="absolute -top-8 left-1/2 -translate-x-1/2 rounded px-2 py-1 text-[10px] font-mono whitespace-nowrap z-10"
                        style={{ background: "var(--surface-overlay)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                      >
                        {labels[ri]} × {labels[ci]}: {val.toFixed(3)}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3">
        {[
          { label: "Strong −", color: "rgba(239,68,68,0.8)" },
          { label: "Neutral", color: "rgba(255,255,255,0.04)" },
          { label: "Strong +", color: "rgba(34,211,238,0.8)" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
            <span className="text-[9px] font-mono" style={{ color: "var(--text-tertiary)" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
