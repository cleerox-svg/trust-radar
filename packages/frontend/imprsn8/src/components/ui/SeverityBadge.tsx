/**
 * SeverityBadge — visual severity chips for threats
 * StatusBadge — takedown/threat workflow status chips
 */
import type { ThreatSeverity, ThreatStatus, TakedownStatus, RiskCategory } from "../../lib/types";

export function SeverityBadge({ severity }: { severity: ThreatSeverity }) {
  const map: Record<ThreatSeverity, { cls: string; label: string; icon: string }> = {
    critical: { cls: "badge-critical", label: "CRITICAL", icon: "●" },
    high:     { cls: "badge-high",     label: "HIGH",     icon: "▲" },
    medium:   { cls: "badge-medium",   label: "MEDIUM",   icon: "◆" },
    low:      { cls: "badge-low",      label: "LOW",      icon: "○" },
  };
  const { cls, label, icon } = map[severity] ?? map.low;
  return <span className={cls}>{icon} {label}</span>;
}

export function ThreatStatusBadge({ status }: { status: ThreatStatus }) {
  const map: Record<ThreatStatus, string> = {
    new:           "badge-new",
    investigating: "badge-submitted",
    confirmed:     "badge-high",
    actioning:     "badge-critical",
    resolved:      "badge-resolved",
    dismissed:     "badge-dismissed",
  };
  return (
    <span className={map[status] ?? "badge-draft"}>
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
}

export function TakedownStatusBadge({ status }: { status: TakedownStatus }) {
  const map: Record<TakedownStatus, { cls: string; label: string }> = {
    draft:        { cls: "badge-draft",      label: "DRAFT" },
    submitted:    { cls: "badge-submitted",  label: "SUBMITTED" },
    acknowledged: { cls: "badge-new",        label: "ACK'D" },
    in_review:    { cls: "badge-high",       label: "IN REVIEW" },
    resolved:     { cls: "badge-resolved",   label: "RESOLVED" },
    rejected:     { cls: "badge-dismissed",  label: "REJECTED" },
  };
  const { cls, label } = map[status] ?? { cls: "badge-draft", label: status };
  return <span className={cls}>{label}</span>;
}

export function RiskBadge({ category, score }: { category: RiskCategory; score?: number }) {
  const map: Record<RiskCategory, { cls: string; label: string }> = {
    legitimate: { cls: "badge-resolved", label: "LEGITIMATE" },
    suspicious: { cls: "badge-medium",   label: "SUSPICIOUS" },
    imposter:   { cls: "badge-critical", label: "IMPOSTER" },
    unscored:   { cls: "badge-dismissed", label: "UNSCORED" },
  };
  const { cls, label } = map[category] ?? { cls: "badge-dismissed", label: "UNKNOWN" };
  return (
    <span className={cls}>
      {label}{score !== undefined ? ` ${score}` : ""}
    </span>
  );
}
