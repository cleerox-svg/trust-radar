/**
 * Bespoke geometric agent icons.
 * Each icon is an inline SVG with a distinct silhouette recognizable at 16px
 * and interesting at 48px. Designed to the spec: abstract enough to be
 * ownable, specific enough to be memorable.
 *
 * Agent roster (9 total):
 *   SENTINEL  — Impersonation Detection
 *   RECON     — Threat Discovery / Scanning
 *   VERITAS   — Identity Verification / Scoring
 *   NEXUS     — Cross-platform Attribution
 *   ARBITER   — Takedown Authorization
 *   WATCHDOG  — Compliance & Brand Monitoring
 *   PHANTOM   — Voice Clone / Audio Detection
 *   CIPHER    — URL / Phishing Analysis
 *   ECHO      — Audience Reach Measurement
 */

export type AgentName =
  | "SENTINEL" | "RECON" | "VERITAS" | "NEXUS" | "ARBITER"
  | "WATCHDOG" | "PHANTOM" | "CIPHER" | "ECHO" | "manual";

export const AGENT_COLORS: Record<AgentName, string> = {
  SENTINEL: "#6D40ED",  // violet — watchful eye
  RECON:    "#3B82F6",  // blue — scanning/discovery
  VERITAS:  "#F0A500",  // gold — truth/scoring
  NEXUS:    "#F97316",  // orange — connection/network
  ARBITER:  "#E8163B",  // red — authority/decision
  WATCHDOG: "#16A34A",  // green — protection/safety
  PHANTOM:  "#8B7FA3",  // muted violet — hidden/audio
  CIPHER:   "#EF9F0A",  // amber — URL/encryption
  ECHO:     "#0D9488",  // teal — reach/waves
  manual:   "#6B5F82",
};

export const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  SENTINEL: "Impersonation Detection",
  RECON:    "Threat Discovery",
  VERITAS:  "Identity Verification",
  NEXUS:    "Cross-platform Attribution",
  ARBITER:  "Takedown Authorization",
  WATCHDOG: "Brand Monitoring",
  PHANTOM:  "Voice Clone Detection",
  CIPHER:   "URL & Phishing Analysis",
  ECHO:     "Audience Reach Measurement",
  manual:   "Manual Trigger",
};

interface AgentIconProps {
  name: AgentName;
  size?: number;
  color?: string;
  className?: string;
}

export function AgentIcon({ name, size = 48, color, className = "" }: AgentIconProps) {
  const c = color ?? AGENT_COLORS[name];
  const s = size;

  const icons: Record<AgentName, JSX.Element> = {

    /* SENTINEL — An eye within a hexagonal shield. Vigilant, precise. */
    SENTINEL: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className}>
        <polygon points="24,4 42,14 42,34 24,44 6,34 6,14"
          stroke={c} strokeWidth="2" fill={`${c}14`} />
        <ellipse cx="24" cy="24" rx="8" ry="5.5"
          stroke={c} strokeWidth="1.5" fill="none" />
        <circle cx="24" cy="24" r="2.5" fill={c} />
        <line x1="14" y1="24" x2="18" y2="24" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="30" y1="24" x2="34" y2="24" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),

    /* RECON — A radar sweep inside a circle. Scanning, discovering. */
    RECON: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className}>
        <circle cx="24" cy="24" r="18" stroke={c} strokeWidth="2" fill={`${c}10`} />
        <circle cx="24" cy="24" r="11" stroke={c} strokeWidth="1" strokeDasharray="3 3" fill="none" />
        <circle cx="24" cy="24" r="4" stroke={c} strokeWidth="1.5" fill="none" />
        {/* Sweep arm */}
        <line x1="24" y1="24" x2="38" y2="16" stroke={c} strokeWidth="2" strokeLinecap="round" />
        {/* Blip */}
        <circle cx="36" cy="17" r="2" fill={c} />
        <circle cx="28" cy="15" r="1.5" fill={c} opacity="0.5" />
      </svg>
    ),

    /* VERITAS — A balance scale reduced to geometric essentials. Truth, scoring. */
    VERITAS: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className}>
        <line x1="24" y1="8" x2="24" y2="40" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="14" x2="36" y2="14" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="14" x2="12" y2="22" stroke={c} strokeWidth="1.5" />
        <line x1="36" y1="14" x2="36" y2="22" stroke={c} strokeWidth="1.5" />
        <rect x="7" y="22" width="10" height="5" rx="2" fill={`${c}25`} stroke={c} strokeWidth="1.5" />
        <rect x="31" y="19" width="10" height="8" rx="2" fill={`${c}25`} stroke={c} strokeWidth="1.5" />
        <circle cx="24" cy="40" r="3" fill={c} />
      </svg>
    ),

    /* NEXUS — Three nodes interconnected, attribution network. */
    NEXUS: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className}>
        <circle cx="24" cy="12" r="5" fill={`${c}20`} stroke={c} strokeWidth="2" />
        <circle cx="10" cy="36" r="5" fill={`${c}20`} stroke={c} strokeWidth="2" />
        <circle cx="38" cy="36" r="5" fill={`${c}20`} stroke={c} strokeWidth="2" />
        <line x1="24" y1="17" x2="12" y2="31" stroke={c} strokeWidth="1.5" />
        <line x1="24" y1="17" x2="36" y2="31" stroke={c} strokeWidth="1.5" />
        <line x1="15" y1="36" x2="33" y2="36" stroke={c} strokeWidth="1.5" />
        <circle cx="24" cy="24" r="3" fill={c} />
      </svg>
    ),

    /* ARBITER — A gavel head reduced to geometric shapes. Authority, decision. */
    ARBITER: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className}>
        {/* Gavel head */}
        <rect x="10" y="10" width="20" height="10" rx="3"
          fill={`${c}20`} stroke={c} strokeWidth="2"
          transform="rotate(45 20 15)" />
        {/* Handle */}
        <line x1="26" y1="26" x2="40" y2="40" stroke={c} strokeWidth="3" strokeLinecap="round" />
        {/* Strike surface */}
        <line x1="8" y1="40" x2="22" y2="40" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="43" x2="22" y2="43" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      </svg>
    ),

    /* WATCHDOG — A shield with a heartbeat pulse inside. Protection, monitoring. */
    WATCHDOG: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className}>
        <path d="M24 6 L40 13 L40 27 C40 35 32 41 24 44 C16 41 8 35 8 27 L8 13 Z"
          fill={`${c}14`} stroke={c} strokeWidth="2" strokeLinejoin="round" />
        {/* Pulse line */}
        <polyline points="12,24 17,24 20,18 23,30 26,20 29,24 36,24"
          stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),

    /* PHANTOM — A sound wave with a slash through it — hidden/audio. */
    PHANTOM: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className}>
        {/* Sound waves left side */}
        <path d="M8 20 Q4 24 8 28" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.4" />
        <path d="M12 16 Q5 24 12 32" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
        {/* Microphone body */}
        <rect x="19" y="10" width="10" height="16" rx="5"
          fill={`${c}20`} stroke={c} strokeWidth="2" />
        {/* Mic stand */}
        <path d="M14 26 Q14 36 24 36 Q34 36 34 26"
          stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <line x1="24" y1="36" x2="24" y2="42" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="18" y1="42" x2="30" y2="42" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        {/* Ghost slash */}
        <line x1="10" y1="10" x2="40" y2="38" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      </svg>
    ),

    /* CIPHER — A chain link with a key notch. URL/encryption, phishing analysis. */
    CIPHER: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className}>
        {/* Key bow */}
        <circle cx="16" cy="18" r="8" fill={`${c}15`} stroke={c} strokeWidth="2" />
        <circle cx="16" cy="18" r="3.5" fill={c} opacity="0.3" />
        {/* Key blade */}
        <line x1="22" y1="22" x2="40" y2="38" stroke={c} strokeWidth="3" strokeLinecap="round" />
        {/* Key teeth */}
        <line x1="30" y1="32" x2="33" y2="29" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <line x1="34" y1="36" x2="37" y2="33" stroke={c} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),

    /* ECHO — Concentric arcs radiating outward from a central point. Reach/waves. */
    ECHO: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className}>
        <circle cx="24" cy="28" r="3" fill={c} />
        <path d="M14 36 Q14 20 24 20 Q34 20 34 36"
          stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M8 42 Q8 10 24 10 Q40 10 40 42"
          stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
        <path d="M18 28 Q18 14 24 14 Q30 14 30 28"
          stroke={c} strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.35" />
      </svg>
    ),

    /* manual — Simple play triangle */
    manual: (
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className}>
        <polygon points="16,12 36,24 16,36" fill={`${c}20`} stroke={c} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  };

  return icons[name] ?? icons.manual;
}
