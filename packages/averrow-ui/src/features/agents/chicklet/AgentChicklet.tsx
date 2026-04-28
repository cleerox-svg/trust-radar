// AgentChicklet — visual primitive for the redesigned admin agents page.
//
// A button-shaped card with sharp 3D edges that calls back when clicked.
// Pure presentational — receives agent metadata + status props, owns no
// data fetching. Drill-down content is rendered by the parent based on
// the selection state, not by this component.
//
// Visual specs (per the design ask):
//   - Sharp 3D edges via stacked box-shadows (top-left highlight,
//     bottom-right inset shadow), accent-color side bar
//   - Themed accent comes from the agent group's accentVar
//   - Status dot pulses when the agent ran successfully recently
//   - Hover lifts the chicklet 1px and intensifies the 3D shadow
//   - Active (selected) state inverts the side bar to indicate the
//     drill-down is open for this chicklet
//
// React notes:
//   - Memoized so a parent re-render (e.g. selection change) doesn't
//     thrash all sibling chicklets
//   - forwardRef + button role so the drill-down panel can anchor
//     positioning to the clicked chicklet
//   - All interactive behaviour gated through a button — keyboard
//     activatable via Enter/Space natively, Esc handled by the panel

import { forwardRef, memo } from "react";
import { cn } from "@/lib/cn";

export type ChickletStatus = "healthy" | "running" | "degraded" | "stalled" | "tripped" | "unknown";

export interface AgentChickletProps {
  /** Stable id used by the parent for selection state. */
  agentId: string;
  /** Display name shown on the chicklet face. */
  displayName: string;
  /** One-line subtitle below the name (typically agent purpose). */
  subtitle: string;
  /** CSS color or var() string driving the 3D side bar + accents. */
  accentColor: string;
  /** Operational state — drives the status dot color + label. */
  status: ChickletStatus;
  /** Schedule text shown as a small badge (e.g. "every 5m"). */
  scheduleLabel?: string;
  /** True when this chicklet is the currently-selected drill-down. */
  isSelected?: boolean;
  /** Click handler — receives the agentId. */
  onSelect: (agentId: string) => void;
}

const STATUS_LABEL: Record<ChickletStatus, string> = {
  healthy: "Healthy",
  running: "Running",
  degraded: "Degraded",
  stalled: "Stalled",
  tripped: "Tripped",
  unknown: "Unknown",
};

const STATUS_DOT_COLOR: Record<ChickletStatus, string> = {
  healthy: "var(--green, #3CB878)",
  running: "var(--blue, #0A8AB5)",
  degraded: "var(--amber, #E5A832)",
  stalled: "var(--sev-high, #fb923c)",
  tripped: "var(--red, #C83C3C)",
  unknown: "var(--text-tertiary, rgba(255,255,255,0.40))",
};

const AgentChickletInner = forwardRef<HTMLButtonElement, AgentChickletProps>(
  function AgentChicklet(
    { agentId, displayName, subtitle, accentColor, status, scheduleLabel, isSelected, onSelect },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onSelect(agentId)}
        aria-pressed={isSelected}
        aria-label={`${displayName} — ${STATUS_LABEL[status]}. ${isSelected ? "Selected; press to close." : "Press to open details."}`}
        className={cn(
          // Reset native button look. Sharp corners (per the 3D-edges ask).
          "group relative block w-full text-left rounded-none",
          "bg-[var(--bg-card,rgba(22,30,48,0.85))]",
          "px-4 py-3",
          "transition-[transform,box-shadow,background-color] duration-150 ease-out",
          // Hover lift; selection inverts the lift so it sits flush with the panel
          isSelected
            ? "translate-y-px"
            : "hover:-translate-y-px focus-visible:-translate-y-px",
          // Outline only on keyboard focus — keep mouse interactions clean
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber,#E5A832)]",
        )}
        style={{
          // Sharp 3D edges via layered box-shadows. Top-left highlight (light
          // bevel), bottom-right inset (sunk shadow), plus the accent-colored
          // border on the left edge that doubles as the visual anchor for
          // group identity.
          // - inset 1px white at top-left → bevel
          // - inset -1px black at bottom-right → recess
          // - 0 0 0 1px white border, faint
          // - 4px solid accent on left = the group color tab
          // - 0 4px 0 darkAccent below = the "stacked" 3D foot
          boxShadow: isSelected
            ? `inset 1px 1px 0 0 rgba(255,255,255,0.08), inset -1px -1px 0 0 rgba(0,0,0,0.4), inset 4px 0 0 0 ${accentColor}, 0 1px 0 0 rgba(0,0,0,0.5)`
            : `inset 1px 1px 0 0 rgba(255,255,255,0.08), inset -1px -1px 0 0 rgba(0,0,0,0.4), inset 4px 0 0 0 ${accentColor}, 0 4px 0 0 rgba(0,0,0,0.45)`,
          paddingLeft: "calc(1rem + 4px)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "block w-2 h-2 rounded-full flex-shrink-0",
                  status === "running" || status === "healthy" ? "animate-pulse" : "",
                )}
                style={{ background: STATUS_DOT_COLOR[status], boxShadow: `0 0 6px ${STATUS_DOT_COLOR[status]}` }}
              />
              <span className="text-sm font-semibold text-[var(--text-primary,rgba(255,255,255,0.92))] truncate">
                {displayName}
              </span>
            </div>
            <div className="mt-1 text-[11px] leading-snug text-[var(--text-secondary,rgba(255,255,255,0.60))] line-clamp-2">
              {subtitle}
            </div>
          </div>
          {scheduleLabel ? (
            <span
              className="flex-shrink-0 text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-sm"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {scheduleLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: STATUS_DOT_COLOR[status] }}
          >
            {STATUS_LABEL[status]}
          </span>
          <span
            aria-hidden
            className={cn(
              "text-[10px] text-[var(--text-tertiary,rgba(255,255,255,0.40))]",
              "opacity-0 transition-opacity",
              isSelected ? "opacity-100" : "group-hover:opacity-80 group-focus-visible:opacity-80",
            )}
          >
            {isSelected ? "Open ▾" : "Details ▸"}
          </span>
        </div>
      </button>
    );
  },
);

/** Memoized export — siblings don't re-render on selection changes elsewhere. */
export const AgentChicklet = memo(AgentChickletInner);
