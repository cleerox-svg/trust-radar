import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { threats as threatsApi } from "../../lib/api";

type CorrelationView = "type" | "source" | "country";
type CorrelationWindow = "7d" | "30d" | "90d";

interface StaticProps {
  labels: string[];
  matrix: number[][];
  className?: string;
  /** If true, renders in standalone mode with live data + tabs */
  live?: false;
}

interface LiveProps {
  live: true;
  className?: string;
}

type Props = StaticProps | LiveProps;

function getColor(value: number): string {
  if (value >= 0.7) return "rgba(59, 130, 246, 0.85)";   // strong positive — blue
  if (value >= 0.4) return "rgba(59, 130, 246, 0.50)";   // moderate positive
  if (value >= 0.1) return "rgba(59, 130, 246, 0.18)";   // weak positive
  if (value > -0.1) return "rgba(255, 255, 255, 0.04)";  // neutral
  if (value > -0.4) return "rgba(239, 68, 68, 0.15)";    // weak negative
  if (value > -0.7) return "rgba(239, 68, 68, 0.45)";    // moderate negative
  return "rgba(239, 68, 68, 0.8)";                        // strong negative — red
}

const VIEW_TABS: { id: CorrelationView; label: string }[] = [
  { id: "type",    label: "Type × Type" },
  { id: "source",  label: "Source × Source" },
  { id: "country", label: "Country × Type" },
];

const WINDOW_OPTS: CorrelationWindow[] = ["7d", "30d", "90d"];

interface MatrixGridProps {
  labels: string[];
  rowLabels?: string[];
  matrix: number[][];
}

function MatrixGrid({ labels, rowLabels, matrix }: MatrixGridProps) {
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);
  const rows = rowLabels ?? labels;
  const cols = labels;
  const size = cols.length;

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-[2px]"
          style={{ gridTemplateColumns: `auto repeat(${size}, minmax(32px, 1fr))` }}
        >
          {/* Header row */}
          <div />
          {cols.map((l) => (
            <div
              key={`h-${l}`}
              className="text-[9px] font-mono text-center truncate px-1 py-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {l.length > 8 ? l.slice(0, 7) + "…" : l}
            </div>
          ))}

          {/* Matrix rows */}
          {matrix.map((row, ri) => (
            <>
              <div
                key={`rl-${ri}`}
                className="text-[9px] font-mono text-right pr-2 flex items-center justify-end"
                style={{ color: "var(--text-tertiary)" }}
              >
                {(rows[ri] ?? "").length > 10 ? rows[ri].slice(0, 9) + "…" : rows[ri]}
              </div>
              {row.map((val, ci) => {
                const isHovered = hovered?.row === ri && hovered?.col === ci;
                return (
                  <div
                    key={`c-${ri}-${ci}`}
                    className="aspect-square rounded-sm flex items-center justify-center text-[9px] font-mono transition-all relative"
                    style={{
                      background: getColor(val),
                      color: Math.abs(val) > 0.4 ? "var(--text-primary)" : "var(--text-tertiary)",
                      outline: isHovered ? "1px solid var(--primary)" : "none",
                      cursor: "default",
                    }}
                    onMouseEnter={() => setHovered({ row: ri, col: ci })}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {(isHovered || size <= 6) && <span>{val.toFixed(2)}</span>}
                    {isHovered && (
                      <div
                        className="absolute -top-8 left-1/2 -translate-x-1/2 rounded px-2 py-1 text-[10px] font-mono whitespace-nowrap z-10"
                        style={{
                          background: "var(--surface-overlay)",
                          border: "1px solid var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {rows[ri]} × {cols[ci]}: {val.toFixed(3)}
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
          { label: "Neutral",  color: "rgba(255,255,255,0.04)" },
          { label: "Strong +", color: "rgba(59,130,246,0.85)" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
            <span className="text-[9px] font-mono" style={{ color: "var(--text-tertiary)" }}>
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Live CorrelationMatrix — fetches data from /api/threats/correlations.
 * Shows tab switcher (type/source/country) and window selector (7d/30d/90d).
 */
function LiveCorrelationMatrix({ className }: { className?: string }) {
  const [view, setView] = useState<CorrelationView>("type");
  const [window, setWindow] = useState<CorrelationWindow>("30d");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["threats", "correlations", view, window],
    queryFn: () => threatsApi.correlations(view, window),
    staleTime: 5 * 60 * 1000, // 5 min — backend caches for 1h
  });

  const result = data?.data;

  return (
    <div className={className}>
      {/* Controls */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        {/* View tabs */}
        <div className="flex gap-1">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className="text-[11px] font-mono px-2.5 py-1 rounded transition-all"
              style={{
                background: view === tab.id ? "rgba(59,130,246,0.15)" : "transparent",
                color: view === tab.id ? "var(--primary)" : "var(--text-tertiary)",
                border: view === tab.id ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Window selector */}
        <div className="flex gap-1">
          {WINDOW_OPTS.map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className="text-[11px] font-mono px-2 py-1 rounded transition-all"
              style={{
                background: window === w ? "var(--surface-overlay)" : "transparent",
                color: window === w ? "var(--text-primary)" : "var(--text-tertiary)",
                border: `1px solid ${window === w ? "var(--border-strong)" : "transparent"}`,
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix */}
      {isLoading && (
        <div className="flex items-center justify-center h-32 text-sm" style={{ color: "var(--text-tertiary)" }}>
          Loading correlations…
        </div>
      )}
      {isError && (
        <div className="flex items-center justify-center h-32 text-sm" style={{ color: "var(--threat-critical)" }}>
          Failed to load correlations
        </div>
      )}
      {result && result.labels.length > 0 && (
        <MatrixGrid
          labels={result.labels}
          rowLabels={(result as { rowLabels?: string[] }).rowLabels}
          matrix={result.matrix}
        />
      )}
      {result && result.labels.length === 0 && (
        <div className="flex items-center justify-center h-32 text-sm" style={{ color: "var(--text-tertiary)" }}>
          No data for selected window
        </div>
      )}
    </div>
  );
}

/**
 * CorrelationMatrix — can be used in static mode (pass labels+matrix props)
 * or live mode (live={true}, fetches own data).
 */
export function CorrelationMatrix(props: Props) {
  if ("live" in props && props.live) {
    return <LiveCorrelationMatrix className={props.className} />;
  }

  const { labels, matrix, className } = props as StaticProps;
  return (
    <div className={className}>
      <MatrixGrid labels={labels} matrix={matrix} />
    </div>
  );
}
