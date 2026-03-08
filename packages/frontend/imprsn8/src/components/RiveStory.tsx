/**
 * RiveStory — Rive animation canvas wired to the War Room simulation steps.
 *
 * ─── FOR THE RIVE DESIGNER ───────────────────────────────────────────────────
 *
 *  File:          /public/animations/agent-story.riv
 *  Artboard:      "AgentStory"         (must match RIVE_ARTBOARD below)
 *  State Machine: "StoryMachine"       (must match RIVE_STATE_MACHINE below)
 *
 *  Inputs:
 *    Number  "currentStep"   — 0 = idle, 1–8 = story beats (mapped 1:1 to sim steps)
 *    Boolean "isPlaying"     — true while auto-play is running
 *    String  "scenario"      — "impersonation" | "phishing" | "reputation"
 *
 *  Story beats (currentStep values):
 *    0 → Idle / waiting        – Static social-media profile, peaceful
 *    1 → Signal detected       – Fake profile slides in, red glow
 *    2 → Agent activated       – First agent node lights up in the network
 *    3 → Cross-platform scan   – Agent lines expand across nodes
 *    4 → URL / content scan    – Magnifier / code overlay
 *    5 → Audience impact       – Numbers cascading / reach visualization
 *    6 → Takedown filed        – Gavel / report icon, platform logos
 *    7 → Neutralized           – Fake profile dissolves, green shield, score rises
 *
 *  Recommended artboard size: 600 × 400
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRive, useStateMachineInput, Layout, Fit, Alignment } from "@rive-app/react-canvas";
import { useEffect } from "react";

// ─── Constants — keep in sync with the .riv file ─────────────────────────────
const RIVE_FILE_PATH      = "/animations/agent-story.riv";
const RIVE_ARTBOARD       = "AgentStory";
const RIVE_STATE_MACHINE  = "StoryMachine";
const INPUT_STEP          = "currentStep";
const INPUT_PLAYING       = "isPlaying";

// ─── Story-beat metadata (mirrors SCENARIOS step indices) ─────────────────────
const BEAT_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Idle — monitoring",                   color: "var(--text-tertiary)" },
  1: { label: "Impersonator detected",               color: "var(--red-400)" },
  2: { label: "Agent network activated",             color: "#8B6FD4" },
  3: { label: "Cross-platform scan",                 color: "#8B6FD4" },
  4: { label: "URL & content analysis",              color: "var(--red-400)" },
  5: { label: "Audience exposure calculated",        color: "var(--red-400)" },
  6: { label: "Takedown request filed",              color: "var(--gold-400)" },
  7: { label: "Threat neutralized",                  color: "var(--gold-400)" },
};

interface RiveStoryProps {
  /** -1 = idle (no playback started), 0–7 = active step index */
  step: number;
  playing: boolean;
  scenario: string;
}

export function RiveStory({ step, playing, scenario }: RiveStoryProps) {
  const { rive, RiveComponent } = useRive({
    src: RIVE_FILE_PATH,
    artboard: RIVE_ARTBOARD,
    stateMachines: RIVE_STATE_MACHINE,
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
    autoplay: true,
    // Silently no-ops when the file doesn't exist yet — placeholder shows instead
    onLoadError: () => { /* .riv not ready yet, placeholder renders */ },
  });

  const stepInput    = useStateMachineInput(rive, RIVE_STATE_MACHINE, INPUT_STEP);
  const playingInput = useStateMachineInput(rive, RIVE_STATE_MACHINE, INPUT_PLAYING);

  // Drive state machine inputs from parent step/playing state
  useEffect(() => {
    if (stepInput)    stepInput.value    = Math.max(step, 0);
  }, [step, stepInput]);

  useEffect(() => {
    if (playingInput) playingInput.value = playing;
  }, [playing, playingInput]);

  // scenario is passed for future String input support
  void scenario;

  const currentBeat = BEAT_LABELS[Math.max(step, 0)];
  const isLoaded    = rive !== null;

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: 280 }}>

      {/* ── Canvas or placeholder ─────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden" style={{ minHeight: 240 }}>

        {/* Rive canvas — renders once .riv is present */}
        <RiveComponent
          style={{ width: "100%", height: "100%", display: isLoaded ? "block" : "none" }}
        />

        {/* Placeholder — shown until the .riv file is added ─────────────── */}
        {!isLoaded && <RivePlaceholder step={step} />}
      </div>

      {/* ── Current beat label ────────────────────────────────────────────── */}
      {step >= 0 && (
        <div
          className="px-4 py-2 text-xs font-mono text-center transition-colors"
          style={{
            color: currentBeat?.color ?? "var(--text-tertiary)",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--surface-raised)",
          }}
        >
          {currentBeat?.label ?? ""}
        </div>
      )}
    </div>
  );
}

// ─── Placeholder ─────────────────────────────────────────────────────────────
// A hand-crafted SVG/CSS scene that mirrors each story beat.
// Remove or hide once the .riv file is in place.

const PLACEHOLDER_AGENTS = ["PHANTOM", "SENTINEL", "NEXUS", "CIPHER", "ECHO", "VERITAS", "ARBITER", "RECON", "WATCHDOG"] as const;
const AGENT_HEX: Record<string, string> = {
  SENTINEL: "#6D40ED", RECON: "#2D9CDB", VERITAS: "#27AE60",
  NEXUS: "#F2994A",    ARBITER: "#F0A500", WATCHDOG: "#9B51E0",
  PHANTOM: "#EB5757",  CIPHER: "#E8163B",  ECHO: "#56CCF2",
};

function RivePlaceholder({ step }: { step: number }) {
  const cx = 150, cy = 115, r = 90;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: "var(--surface-overlay)" }}
    >
      <svg
        viewBox="0 0 300 260"
        className="w-full h-full"
        style={{ maxWidth: 320, maxHeight: 280 }}
        aria-label="Agent story animation placeholder — add agent-story.riv to enable"
      >
        <defs>
          <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={step >= 7 ? "#F0A50022" : step >= 1 ? "#E8163B18" : "#6D40ED18"} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="blur4">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          </filter>
        </defs>

        {/* Background glow */}
        <ellipse cx={cx} cy={cy} rx={110} ry={90} fill="url(#bgGlow)" />

        {/* ── Scene: social-media profile card (steps 0–1) ─────────────── */}
        {step <= 1 && (
          <g>
            {/* Genuine profile card */}
            <rect x={cx - 55} y={cy - 60} width={110} height={80} rx={8}
              fill="var(--surface-float)" stroke="var(--border-default)" strokeWidth={1} />
            <circle cx={cx - 28} cy={cy - 35} r={14}
              fill={step === 1 ? "#6D40ED33" : "#6D40ED55"}
              stroke={step === 1 ? "#6D40ED88" : "#6D40ED"} strokeWidth={1.5} />
            <text x={cx - 28} y={cy - 31} textAnchor="middle" style={{ fontSize: 12, fill: "#6D40ED" }}>✓</text>
            <rect x={cx - 10} y={cy - 44} width={60} height={6} rx={3} fill="var(--border-strong)" opacity={0.7} />
            <rect x={cx - 10} y={cy - 33} width={44} height={5} rx={2.5} fill="var(--border-default)" />
            <rect x={cx - 10} y={cy - 23} width={52} height={4} rx={2} fill="var(--border-subtle)" />

            {/* Impersonator card — slides in at step 1 */}
            {step === 1 && (
              <g style={{ animation: "slideInRight 0.4s ease-out forwards" }}>
                <rect x={cx + 20} y={cy - 20} width={90} height={70} rx={8}
                  fill="var(--surface-float)" stroke="#E8163B" strokeWidth={1.5}
                  opacity={0.95} />
                <circle cx={cx + 45} cy={cy + 2} r={12} fill="#E8163B22" stroke="#E8163B" strokeWidth={1.5} />
                <text x={cx + 45} y={cy + 6} textAnchor="middle" style={{ fontSize: 11, fill: "#E8163B" }}>!</text>
                <rect x={cx + 62} y={cy - 8} width={40} height={5} rx={2.5} fill="#E8163B44" />
                <rect x={cx + 62} y={cy + 4} width={30} height={4} rx={2} fill="#E8163B22" />
                <text x={cx + 66} y={cy + 40} style={{ fontSize: 7, fill: "#E8163B", fontFamily: "JetBrains Mono" }}>
                  97% match
                </text>
              </g>
            )}
          </g>
        )}

        {/* ── Scene: agent network (steps 2–6) ─────────────────────────── */}
        {step >= 2 && step <= 6 && (
          <g>
            {/* Edges */}
            {PLACEHOLDER_AGENTS.map((a, i) =>
              PLACEHOLDER_AGENTS.map((b, j) => {
                if (j <= i) return null;
                const ai = (2 * Math.PI * i) / PLACEHOLDER_AGENTS.length - Math.PI / 2;
                const bi = (2 * Math.PI * j) / PLACEHOLDER_AGENTS.length - Math.PI / 2;
                const ax = cx + r * Math.cos(ai), ay = cy + r * Math.sin(ai);
                const bx = cx + r * Math.cos(bi), by = cy + r * Math.sin(bi);
                const iEdgeActive = i < step - 1 || j < step - 1;
                return (
                  <line key={`${a}-${b}`} x1={ax} y1={ay} x2={bx} y2={by}
                    stroke={iEdgeActive ? "rgba(240,165,0,0.25)" : "var(--border-subtle)"}
                    strokeWidth={iEdgeActive ? 1 : 0.4} />
                );
              })
            )}
            {/* Nodes */}
            {PLACEHOLDER_AGENTS.map((name, i) => {
              const angle = (2 * Math.PI * i) / PLACEHOLDER_AGENTS.length - Math.PI / 2;
              const nx = cx + r * Math.cos(angle);
              const ny = cy + r * Math.sin(angle);
              const color = AGENT_HEX[name] ?? "#6B5F82";
              const isActive = i < step - 1;
              return (
                <g key={name} transform={`translate(${nx},${ny})`}>
                  {isActive && (
                    <circle r={18} fill="none" stroke={color} strokeWidth={1} opacity={0.3}>
                      <animate attributeName="r" values="12;20;12" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0;0.3" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle r={12} fill={isActive ? `${color}22` : "var(--surface-raised)"}
                    stroke={isActive ? color : "var(--border-subtle)"}
                    strokeWidth={isActive ? 1.5 : 0.8} />
                  <text textAnchor="middle" dy={16} style={{ fontSize: 6.5, fill: isActive ? color : "var(--text-tertiary)", fontFamily: "Inter" }}>
                    {name}
                  </text>
                </g>
              );
            })}
            {/* Centre hub */}
            <circle cx={cx} cy={cy} r={18} fill="var(--surface-float)" stroke="var(--border-gold)" strokeWidth={1.5} />
            <text textAnchor="middle" x={cx} y={cy + 4} style={{ fontSize: 6.5, fill: "var(--gold-400)", fontFamily: "Syne", fontWeight: 700 }}>
              imprsn8
            </text>
          </g>
        )}

        {/* ── Scene: neutralized (step 7+) ──────────────────────────────── */}
        {step >= 7 && (
          <g>
            {/* Shield */}
            <path
              d={`M ${cx} ${cy - 60} C ${cx + 40} ${cy - 60} ${cx + 50} ${cy - 30} ${cx + 50} ${cy}
                  C ${cx + 50} ${cy + 40} ${cx + 20} ${cy + 55} ${cx} ${cy + 65}
                  C ${cx - 20} ${cy + 55} ${cx - 50} ${cy + 40} ${cx - 50} ${cy}
                  C ${cx - 50} ${cy - 30} ${cx - 40} ${cy - 60} ${cx} ${cy - 60} Z`}
              fill="rgba(240,165,0,0.07)"
              stroke="var(--gold-400)"
              strokeWidth={2}
            />
            <text textAnchor="middle" x={cx} y={cy + 12} style={{ fontSize: 28, fill: "var(--gold-400)" }}>✓</text>
            <text textAnchor="middle" x={cx} y={cy + 40} style={{ fontSize: 8, fill: "var(--gold-400)", fontFamily: "Syne", fontWeight: 700 }}>
              THREAT NEUTRALIZED
            </text>
            {/* Faint fading threat badge */}
            <rect x={cx + 30} y={cy - 50} width={60} height={30} rx={6}
              fill="var(--surface-float)" stroke="#E8163B44" strokeWidth={1} opacity={0.4} />
            <text x={cx + 60} y={cy - 31} textAnchor="middle" style={{ fontSize: 8, fill: "#E8163B88" }}>
              REMOVED
            </text>
          </g>
        )}

        {/* ── Placeholder label ─────────────────────────────────────────── */}
        <text
          textAnchor="middle"
          x={150}
          y={248}
          style={{ fontSize: 7, fill: "var(--text-tertiary)", fontFamily: "JetBrains Mono" }}
        >
          [ add /public/animations/agent-story.riv to enable Rive ]
        </text>
      </svg>
    </div>
  );
}
