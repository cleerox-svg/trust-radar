// AgentDrillDownPanel — fly-out detail view for a selected agent.
//
// Two presentations driven by the `variant` prop:
//   "inline"  — desktop, sits below the chicklet grid as an expanded
//               row. No backdrop, takes full container width.
//   "modal"   — mobile, full-screen sheet with backdrop dismissal.
//               Locks scroll on the body while open. Slides up from
//               the bottom with the safe-area inset respected.
//
// Content is identical across variants; only the chrome differs. That
// keeps the data layer (useAgentDetail) tied to one component instead
// of duplicating across breakpoints.
//
// Owns no selection state — just renders for the agent it's told to
// render and calls onClose when dismissed (Esc, backdrop click,
// close button, or selecting "deselect" via toggling the same chicklet).

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAgentDetail } from "@/hooks/useAgents";
import { relativeTime, formatDuration } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { AgentMetadata } from "@/lib/agent-metadata";

export interface AgentDrillDownPanelProps {
  /** Agent currently being inspected. Renders skeleton until loaded. */
  metadata: AgentMetadata;
  /** Color sourced from the parent group — drives the panel's accent border. */
  accentColor: string;
  /** Layout variant. Parent picks via media query / breakpoint hook. */
  variant: "inline" | "modal";
  onClose: () => void;
}

export function AgentDrillDownPanel({ metadata, accentColor, variant, onClose }: AgentDrillDownPanelProps) {
  const { data, isLoading } = useAgentDetail(metadata.id);
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc-to-close + body-scroll-lock for the modal variant. Inline
  // variant doesn't lock scroll because it doesn't cover the page.
  useEffect(() => {
    if (variant !== "modal") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    // Auto-focus the panel for screen readers
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [variant, onClose]);

  const body = (
    <div
      ref={panelRef}
      tabIndex={-1}
      role={variant === "modal" ? "dialog" : "region"}
      aria-modal={variant === "modal"}
      aria-labelledby={`agent-drill-${metadata.id}-title`}
      className={cn(
        "bg-[var(--bg-card,rgba(22,30,48,0.95))]",
        "outline-none",
        // 3D edge shape — wider top-left bevel + heavy bottom inset to
        // visually anchor the panel to whichever chicklet opened it.
        // Sharp corners (rounded-none) per the design ask.
        "rounded-none",
      )}
      style={{
        boxShadow: `inset 1px 1px 0 0 rgba(255,255,255,0.10), inset -1px -1px 0 0 rgba(0,0,0,0.5), inset 0 4px 0 0 ${accentColor}, 0 8px 24px rgba(0,0,0,0.4)`,
      }}
    >
      <div className="flex items-start justify-between gap-3 p-4 border-b border-white/5">
        <div className="min-w-0">
          <div
            id={`agent-drill-${metadata.id}-title`}
            className="text-sm font-semibold text-[var(--text-primary,rgba(255,255,255,0.92))]"
          >
            {metadata.displayName}
          </div>
          <div className="text-[11px] text-[var(--text-secondary,rgba(255,255,255,0.60))] mt-0.5">
            {metadata.subtitle}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close agent details"
          className="flex-shrink-0 px-2 py-1 text-xs text-[var(--text-secondary,rgba(255,255,255,0.60))] hover:text-[var(--text-primary,rgba(255,255,255,0.92))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber,#E5A832)]"
        >
          {variant === "modal" ? "Close ✕" : "Close ▲"}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {isLoading || !data ? (
          <DrillDownSkeleton />
        ) : (
          <>
            {/* Stat row — total runs, success rate, avg duration */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Stat label="Runs" value={data.stats?.total_runs ?? 0} />
              <Stat
                label="Success"
                value={
                  data.stats && data.stats.total_runs > 0
                    ? `${Math.round((data.stats.successes / data.stats.total_runs) * 100)}%`
                    : "—"
                }
              />
              <Stat
                label="Avg dur"
                value={
                  data.stats?.avg_duration_ms != null
                    ? formatDuration(data.stats.avg_duration_ms)
                    : "—"
                }
              />
            </div>

            {/* Recent runs */}
            <section>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary,rgba(255,255,255,0.40))] mb-2">
                Recent Runs
              </div>
              {data.runs.length === 0 ? (
                <div className="text-xs text-[var(--text-secondary,rgba(255,255,255,0.60))]">No runs in window.</div>
              ) : (
                <ul className="space-y-1.5">
                  {data.runs.slice(0, 5).map((run) => (
                    <li
                      key={run.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <RunStatusDot status={run.status} />
                        <span className="text-[var(--text-secondary,rgba(255,255,255,0.60))]">
                          {relativeTime(run.started_at)}
                        </span>
                        {run.error_message ? (
                          <span className="text-[var(--red,#C83C3C)] truncate" title={run.error_message}>
                            {run.error_message}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[var(--text-tertiary,rgba(255,255,255,0.40))] flex-shrink-0">
                        {run.duration_ms != null ? formatDuration(run.duration_ms) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Latest output (if any) */}
            {data.outputs.length > 0 ? (
              <section>
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary,rgba(255,255,255,0.40))] mb-2">
                  Latest Output
                </div>
                <div
                  className="text-xs text-[var(--text-primary,rgba(255,255,255,0.92))] bg-white/[0.02] border border-white/5 p-2"
                  style={{ borderLeft: `2px solid ${accentColor}` }}
                >
                  {data.outputs[0]?.summary ?? ""}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  if (variant === "inline") {
    return body;
  }

  // Modal variant — portal'd to body, full-screen on mobile with safe
  // area inset. Backdrop click dismisses.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-2">
      <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-tertiary,rgba(255,255,255,0.40))]">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold text-[var(--text-primary,rgba(255,255,255,0.92))]">
        {value}
      </div>
    </div>
  );
}

function RunStatusDot({ status }: { status: string }) {
  const color =
    status === "success" || status === "completed"
      ? "var(--green,#3CB878)"
      : status === "failed" || status === "error"
      ? "var(--red,#C83C3C)"
      : status === "partial" || status === "running"
      ? "var(--amber,#E5A832)"
      : "var(--text-tertiary,rgba(255,255,255,0.40))";
  return (
    <span
      aria-label={status}
      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ background: color }}
    />
  );
}

function DrillDownSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-busy>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 bg-white/5" />
        ))}
      </div>
      <div className="h-4 w-24 bg-white/5" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-3 w-full bg-white/5" />
      ))}
    </div>
  );
}
