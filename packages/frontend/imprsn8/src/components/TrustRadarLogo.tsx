/**
 * TrustRadarLogo — brand logo system for Trust Radar
 *
 * Variants:
 *   "topbar"   — 28px animated ring + wordmark (for nav bars)
 *   "hero"     — large animated ring + wordmark (for login/splash)
 *   "icon"     — icon mark only, no wordmark (for mobile/favicon/loading)
 *   "loading"  — 48px animated icon mark (for loading states)
 *
 * Accepts theme='dark' | 'light'. Defaults to 'dark'.
 */

interface TrustRadarLogoProps {
  variant?: "topbar" | "hero" | "icon" | "loading";
  theme?: "dark" | "light";
  className?: string;
}

/* ── Color maps ─────────────────────────────────────────── */
const COLORS = {
  dark: {
    sentinel:   "#00d4ff",
    analyst:    "#00e5a0",
    cartographer: "#ffb627",
    strategist: "#ff3b5c",
    observer:   "#b388ff",
    wordmark:   "#e8edf5",
    nodeFill:   "#040810",
    coreGlow:   "rgba(0,212,255,.06)",
    coreFill:   "rgba(0,212,255,.08)",
    coreStroke: "rgba(0,212,255,.1)",
  },
  light: {
    sentinel:   "#0091b3",
    analyst:    "#00b377",
    cartographer: "#d49a00",
    strategist: "#e02040",
    observer:   "#8855cc",
    wordmark:   "#1a1a2e",
    nodeFill:   "#f4f6f9",
    coreGlow:   "rgba(0,145,179,.06)",
    coreFill:   "rgba(0,145,179,.08)",
    coreStroke: "rgba(0,145,179,.1)",
  },
} as const;

export function TrustRadarLogo({
  variant = "topbar",
  theme = "dark",
  className = "",
}: TrustRadarLogoProps) {
  const c = COLORS[theme];
  const arcOpacity = theme === "dark" ? ".5" : ".6";
  const nodeOpacity = theme === "dark" ? ".5" : ".6";
  const nodeHighOpacity = theme === "dark" ? "1" : "1";

  if (variant === "topbar") {
    return (
      <svg
        width="200" height="32" viewBox="0 0 200 32"
        className={className}
        aria-label="Trust Radar logo"
      >
        <g transform="translate(16,16)">
          {/* Five-color ring arcs */}
          <path d="M-2.2,-14 A14,14 0 0,1 8.2,-11.3" stroke={c.sentinel} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M10.4,-8.2 A14,14 0 0,1 13.8,2.6" stroke={c.analyst} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M12.6,6 A14,14 0 0,1 2.6,13.8" stroke={c.cartographer} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M-0.6,14 A14,14 0 0,1 -12.6,6" stroke={c.strategist} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M-13.8,2.6 A14,14 0 0,1 -6.7,-12.3" stroke={c.observer} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          {/* Sweep line */}
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
            <line x1="0" y1="0" x2="0" y2="-13" stroke={c.sentinel} strokeWidth=".8" opacity=".35" />
          </g>
          {/* Agent nodes */}
          <circle cx="2.7" cy="-8.6" r="1.5" fill={c.sentinel} opacity={nodeOpacity}>
            <animate attributeName="opacity" values={`${nodeOpacity};${nodeHighOpacity};${nodeOpacity}`} dur="6s" begin="0.3s" repeatCount="indefinite" />
          </circle>
          <circle cx="8.6" cy="0" r="1.5" fill={c.analyst} opacity={nodeOpacity}>
            <animate attributeName="opacity" values={`${nodeOpacity};${nodeHighOpacity};${nodeOpacity}`} dur="6s" begin="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="2.7" cy="8.6" r="1.5" fill={c.cartographer} opacity={nodeOpacity}>
            <animate attributeName="opacity" values={`${nodeOpacity};${nodeHighOpacity};${nodeOpacity}`} dur="6s" begin="2.7s" repeatCount="indefinite" />
          </circle>
          <circle cx="-6.9" cy="5" r="1.5" fill={c.strategist} opacity={nodeOpacity}>
            <animate attributeName="opacity" values={`${nodeOpacity};${nodeHighOpacity};${nodeOpacity}`} dur="6s" begin="3.9s" repeatCount="indefinite" />
          </circle>
          <circle cx="-6.9" cy="-5" r="1.5" fill={c.observer} opacity={nodeOpacity}>
            <animate attributeName="opacity" values={`${nodeOpacity};${nodeHighOpacity};${nodeOpacity}`} dur="6s" begin="5.1s" repeatCount="indefinite" />
          </circle>
          {/* Core */}
          <circle cx="0" cy="0" r="2.5" fill={c.coreFill} stroke={c.sentinel} strokeWidth="1" />
          <circle cx="0" cy="0" r="1.2" fill={c.sentinel} />
        </g>
        {/* Wordmark */}
        <text x="36" y="21" fontFamily="'Chakra Petch',sans-serif" fontWeight="700" fontSize="16" letterSpacing="2" fill={c.wordmark}>
          TRUST <tspan fill={c.sentinel}>RADAR</tspan>
        </text>
      </svg>
    );
  }

  if (variant === "hero") {
    return (
      <svg
        width="400" height="100" viewBox="0 0 480 120"
        className={className}
        aria-label="Trust Radar logo"
      >
        <g transform="translate(60,60)">
          {/* Five-color ring arcs */}
          <path d="M-12.6,-44 A46,46 0 0,1 27,-37.2" stroke={c.sentinel} strokeWidth="3" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M32.2,-30.6 A46,46 0 0,1 45.2,8.4" stroke={c.analyst} strokeWidth="3" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M41.4,19.8 A46,46 0 0,1 8.4,45.2" stroke={c.cartographer} strokeWidth="3" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M-1.8,46 A46,46 0 0,1 -41.4,19.8" stroke={c.strategist} strokeWidth="3" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M-45.2,8.4 A46,46 0 0,1 -22,-40.4" stroke={c.observer} strokeWidth="3" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          {/* Ambient threat dots */}
          <circle cx="30" cy="-34" r="2" fill={c.strategist} opacity=".3">
            <animate attributeName="opacity" values=".3;.6;.3" dur="4s" begin="0.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="-44" cy="14" r="2" fill={c.strategist} opacity=".3">
            <animate attributeName="opacity" values=".3;.6;.3" dur="4s" begin="2.4s" repeatCount="indefinite" />
          </circle>
          {/* Inner reference ring */}
          <circle cx="0" cy="0" r="28" fill="none" stroke={c.sentinel} strokeWidth=".5" opacity=".1" />
          {/* Sweep line + cone */}
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
            <path d="M0,0 L0,-44 A44,44 0 0,1 22,-38 Z" fill={c.coreGlow} opacity=".5" />
            <line x1="0" y1="0" x2="0" y2="-44" stroke={c.sentinel} strokeWidth="1.5" opacity=".6" strokeLinecap="round" />
          </g>
          {/* Sentinel node */}
          <g>
            <circle cx="8.7" cy="-26.6" r="6" fill={c.sentinel} opacity="0">
              <animate attributeName="opacity" values="0;.25;0" dur="6s" begin="0.3s" repeatCount="indefinite" />
            </circle>
            <circle cx="8.7" cy="-26.6" r="5" fill={c.nodeFill} stroke={c.sentinel} strokeWidth="1.5" opacity=".6" />
            <circle cx="8.7" cy="-26.6" r="2.2" fill={c.sentinel} opacity=".4">
              <animate attributeName="opacity" values=".4;1;.4" dur="6s" begin="0.3s" repeatCount="indefinite" />
              <animate attributeName="r" values="2.2;3.2;2.2" dur="6s" begin="0.3s" repeatCount="indefinite" />
            </circle>
          </g>
          {/* Analyst node */}
          <g>
            <circle cx="28" cy="0" r="6" fill={c.analyst} opacity="0">
              <animate attributeName="opacity" values="0;.25;0" dur="6s" begin="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="28" cy="0" r="5" fill={c.nodeFill} stroke={c.analyst} strokeWidth="1.5" opacity=".6" />
            <circle cx="28" cy="0" r="2.2" fill={c.analyst} opacity=".4">
              <animate attributeName="opacity" values=".4;1;.4" dur="6s" begin="1.5s" repeatCount="indefinite" />
              <animate attributeName="r" values="2.2;3.2;2.2" dur="6s" begin="1.5s" repeatCount="indefinite" />
            </circle>
          </g>
          {/* Cartographer node */}
          <g>
            <circle cx="8.7" cy="26.6" r="6" fill={c.cartographer} opacity="0">
              <animate attributeName="opacity" values="0;.25;0" dur="6s" begin="2.7s" repeatCount="indefinite" />
            </circle>
            <circle cx="8.7" cy="26.6" r="5" fill={c.nodeFill} stroke={c.cartographer} strokeWidth="1.5" opacity=".6" />
            <circle cx="8.7" cy="26.6" r="2.2" fill={c.cartographer} opacity=".4">
              <animate attributeName="opacity" values=".4;1;.4" dur="6s" begin="2.7s" repeatCount="indefinite" />
              <animate attributeName="r" values="2.2;3.2;2.2" dur="6s" begin="2.7s" repeatCount="indefinite" />
            </circle>
          </g>
          {/* Strategist node */}
          <g>
            <circle cx="-22.6" cy="16.4" r="6" fill={c.strategist} opacity="0">
              <animate attributeName="opacity" values="0;.25;0" dur="6s" begin="3.9s" repeatCount="indefinite" />
            </circle>
            <circle cx="-22.6" cy="16.4" r="5" fill={c.nodeFill} stroke={c.strategist} strokeWidth="1.5" opacity=".6" />
            <circle cx="-22.6" cy="16.4" r="2.2" fill={c.strategist} opacity=".4">
              <animate attributeName="opacity" values=".4;1;.4" dur="6s" begin="3.9s" repeatCount="indefinite" />
              <animate attributeName="r" values="2.2;3.2;2.2" dur="6s" begin="3.9s" repeatCount="indefinite" />
            </circle>
          </g>
          {/* Observer node */}
          <g>
            <circle cx="-22.6" cy="-16.4" r="6" fill={c.observer} opacity="0">
              <animate attributeName="opacity" values="0;.25;0" dur="6s" begin="5.1s" repeatCount="indefinite" />
            </circle>
            <circle cx="-22.6" cy="-16.4" r="5" fill={c.nodeFill} stroke={c.observer} strokeWidth="1.5" opacity=".6" />
            <circle cx="-22.6" cy="-16.4" r="2.2" fill={c.observer} opacity=".4">
              <animate attributeName="opacity" values=".4;1;.4" dur="6s" begin="5.1s" repeatCount="indefinite" />
              <animate attributeName="r" values="2.2;3.2;2.2" dur="6s" begin="5.1s" repeatCount="indefinite" />
            </circle>
          </g>
          {/* Core */}
          <circle cx="0" cy="0" r="10" fill={`rgba(${theme === "dark" ? "0,212,255" : "0,145,179"},.04)`} stroke={c.sentinel} strokeWidth="1.5" opacity=".5" />
          <circle cx="0" cy="0" r="4.5" fill={c.sentinel}>
            <animate attributeName="r" values="4.5;5.5;4.5" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;.5;1" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>
        {/* Wordmark */}
        <text x="130" y="48" fontFamily="'Chakra Petch',sans-serif" fontWeight="700" fontSize="34" letterSpacing="4" fill={c.wordmark}>TRUST</text>
        <text x="130" y="82" fontFamily="'Chakra Petch',sans-serif" fontWeight="500" fontSize="34" letterSpacing="4" fill={c.sentinel}>RADAR</text>
      </svg>
    );
  }

  if (variant === "icon") {
    // 28px icon-only mark (for mobile topbar)
    return (
      <svg
        width="28" height="28" viewBox="0 0 32 32"
        className={className}
        aria-label="Trust Radar"
      >
        <g transform="translate(16,16)">
          <path d="M-1.4,-13 A13.5,13.5 0 0,1 7.9,-10.9" stroke={c.sentinel} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M9.4,-7.8 A13.5,13.5 0 0,1 13.2,2.5" stroke={c.analyst} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M12.1,5.8 A13.5,13.5 0 0,1 2.5,13.2" stroke={c.cartographer} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M-0.5,13.5 A13.5,13.5 0 0,1 -12.1,5.8" stroke={c.strategist} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          <path d="M-13.2,2.5 A13.5,13.5 0 0,1 -5.9,-11.8" stroke={c.observer} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={arcOpacity} />
          {/* Sweep */}
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
            <line x1="0" y1="0" x2="0" y2="-12" stroke={c.sentinel} strokeWidth=".8" opacity=".35" />
          </g>
          {/* Nodes */}
          <circle cx="2.5" cy="-7.6" r="1.5" fill={c.sentinel} opacity=".6" />
          <circle cx="8" cy="0" r="1.5" fill={c.analyst} opacity=".6" />
          <circle cx="2.5" cy="7.6" r="1.5" fill={c.cartographer} opacity=".6" />
          <circle cx="-6.5" cy="4.7" r="1.5" fill={c.strategist} opacity=".6" />
          <circle cx="-6.5" cy="-4.7" r="1.5" fill={c.observer} opacity=".6" />
          {/* Core */}
          <circle cx="0" cy="0" r="3" fill={c.coreStroke} stroke={c.sentinel} strokeWidth="1" />
          <circle cx="0" cy="0" r="1.2" fill={c.sentinel} />
        </g>
      </svg>
    );
  }

  // variant === "loading" — 48px animated icon
  return (
    <svg
      width="48" height="48" viewBox="0 0 48 48"
      className={className}
      aria-label="Loading"
    >
      <g transform="translate(24,24)">
        <path d="M-2,-19 A20,20 0 0,1 11.7,-16.2" stroke={c.sentinel} strokeWidth="2" fill="none" strokeLinecap="round" opacity={arcOpacity} />
        <path d="M14,-11.5 A20,20 0 0,1 19.6,3.6" stroke={c.analyst} strokeWidth="2" fill="none" strokeLinecap="round" opacity={arcOpacity} />
        <path d="M17.9,8.6 A20,20 0 0,1 3.6,19.6" stroke={c.cartographer} strokeWidth="2" fill="none" strokeLinecap="round" opacity={arcOpacity} />
        <path d="M-0.8,20 A20,20 0 0,1 -17.9,8.6" stroke={c.strategist} strokeWidth="2" fill="none" strokeLinecap="round" opacity={arcOpacity} />
        <path d="M-19.6,3.6 A20,20 0 0,1 -8.8,-17.5" stroke={c.observer} strokeWidth="2" fill="none" strokeLinecap="round" opacity={arcOpacity} />
        {/* Sweep */}
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
          <line x1="0" y1="0" x2="0" y2="-18" stroke={c.sentinel} strokeWidth="1" opacity=".4" />
        </g>
        {/* Nodes with pulse */}
        <circle cx="3.7" cy="-11.4" r="2" fill={c.sentinel} opacity=".6">
          <animate attributeName="opacity" values=".6;1;.6" dur="6s" begin="0.3s" repeatCount="indefinite" />
        </circle>
        <circle cx="12" cy="0" r="2" fill={c.analyst} opacity=".6">
          <animate attributeName="opacity" values=".6;1;.6" dur="6s" begin="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="3.7" cy="11.4" r="2" fill={c.cartographer} opacity=".6">
          <animate attributeName="opacity" values=".6;1;.6" dur="6s" begin="2.7s" repeatCount="indefinite" />
        </circle>
        <circle cx="-9.7" cy="7" r="2" fill={c.strategist} opacity=".6">
          <animate attributeName="opacity" values=".6;1;.6" dur="6s" begin="3.9s" repeatCount="indefinite" />
        </circle>
        <circle cx="-9.7" cy="-7" r="2" fill={c.observer} opacity=".6">
          <animate attributeName="opacity" values=".6;1;.6" dur="6s" begin="5.1s" repeatCount="indefinite" />
        </circle>
        {/* Core */}
        <circle cx="0" cy="0" r="4" fill={c.coreFill} stroke={c.sentinel} strokeWidth="1" />
        <circle cx="0" cy="0" r="1.8" fill={c.sentinel}>
          <animate attributeName="r" values="1.8;2.5;1.8" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;.5;1" dur="2s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}
