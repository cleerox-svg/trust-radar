/**
 * Public Landing Page — spec §PUBLIC LANDING PAGE
 *
 * Sections:
 *   1. NAV (transparent → scroll blur)
 *   2. HERO (left 55% + right 45% product mockup)
 *   3. LIVE PROOF TICKER (CSS infinite scroll)
 *   4. THREE FEARS (problem recognition)
 *   5. WAR ROOM SIMULATION (interactive 8-step playback)
 *   6. AGENT DIRECTORY (9 agents with custom SVGs)
 *   7. SOCIAL PROOF (testimonials)
 *   8. PRICING (3 tiers)
 *   9. CTA + FOOTER
 */

import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, SkipBack, SkipForward, RefreshCw, Check, Star } from "lucide-react";
import { publicApi } from "../lib/api";
import type { PublicStats } from "../lib/types";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { TrustRadarLogo } from "../components/TrustRadarLogo";
import { AgentIcon, AGENT_COLORS, AGENT_DESCRIPTIONS } from "../components/ui/AgentIcon";
import type { AgentName } from "../components/ui/AgentIcon";
import { RiveStory } from "../components/RiveStory";

// ─── Animated counter ─────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1800) {
  const reduced = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [value, setValue] = useState(reduced ? target : 0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0 || reduced) { setValue(target); return; }
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(ease * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, reduced]);
  return value;
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 20); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all"
      style={{
        background: scrolled ? "rgba(17,15,18,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border-subtle)" : "none",
      }}
    >
      <div className="max-w-content mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/">
          <TrustRadarLogo variant="topbar" theme="dark" />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm" style={{ color: "var(--text-secondary)" }}>
          {["Features", "Intelligence", "Pricing"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`}
              className="transition-colors hover:text-white" style={{ color: "inherit" }}>
              {item}
            </a>
          ))}
          <a href="/shield" className="transition-colors hover:text-white flex items-center gap-1.5" style={{ color: "inherit" }}>
            Shield
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(109,64,237,0.18)", color: "var(--violet-300)", border: "1px solid rgba(109,64,237,0.3)" }}>
              Enterprise
            </span>
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/login"
            className="text-sm transition-colors hidden sm:block"
            style={{ color: "var(--text-secondary)" }}>
            Sign In
          </Link>
          <Link to="/register" className="btn-gold text-sm px-4 py-2">
            Start Free →
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function Hero({ stats }: { stats: PublicStats | null }) {
  const count = useCountUp(stats?.influencers_protected ?? 0);

  return (
    <section
      className="min-h-screen flex items-center pt-20"
      style={{
        background: "radial-gradient(ellipse at 30% 50%, #1A0F2E 0%, var(--surface-base) 60%)",
      }}
    >
      <div className="max-w-content mx-auto px-6 py-20 flex flex-col lg:flex-row gap-16 items-center">

        {/* Left — editorial text */}
        <div className="flex-1" style={{ maxWidth: 560 }}>
          {/* Status badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8"
            style={{ background: "rgba(109,64,237,0.15)", border: "1px solid rgba(109,64,237,0.3)", color: "var(--violet-300)" }}
          >
            <span className="status-dot active" style={{ width: 6, height: 6 }} />
            AI-Powered Creator Protection
          </div>

          {/* Dual-service pills */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(240,165,0,0.12)", border: "1px solid rgba(240,165,0,0.3)", color: "var(--gold-400)" }}
            >
              <span className="status-dot active" style={{ width: 5, height: 5 }} />
              Guard — Creator Protection
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(109,64,237,0.12)", border: "1px solid rgba(109,64,237,0.3)", color: "var(--violet-300)" }}
            >
              <span className="status-dot" style={{ width: 5, height: 5, background: "var(--violet-400)" }} />
              Shield — Brand Protection
            </span>
          </div>

          <h1
            className="font-display font-bold mb-6"
            style={{ fontSize: "clamp(42px, 6vw, 72px)", lineHeight: 1.05, color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            Protect what<br />
            your brand<br />
            <span style={{ color: "var(--gold-400)" }}>stands for.</span>
          </h1>

          <p className="mb-8 text-lg" style={{ color: "var(--text-secondary)", maxWidth: 480, lineHeight: 1.6 }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Guard</strong> watches over individual creators.&nbsp;
            <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Shield</strong> protects enterprise brands.
            Both powered by 9 specialized AI agents running 24/7.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <Link to="/register" className="btn-gold text-base px-6 py-3 text-center">
              Protect my identity →
            </Link>
            <a href="/shield" className="btn-ghost text-base px-6 py-3 text-center flex items-center justify-center gap-2"
              style={{ borderColor: "rgba(109,64,237,0.35)", color: "var(--violet-300)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(109,64,237,0.6)"; e.currentTarget.style.background = "rgba(109,64,237,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(109,64,237,0.35)"; e.currentTarget.style.background = ""; }}
            >
              Protect my brand →
            </a>
          </div>

          {/* Trust bar */}
          <div
            className="flex items-center gap-3 p-4 rounded-lg"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map((i) => <Star key={i} size={12} fill="#F0A500" color="#F0A500" />)}
            </div>
            <p className="text-xs italic" style={{ color: "var(--text-secondary)" }}>
              &#8220;imprsn8 caught a fake account before my brand deal fell through.&#8221;
            </p>
            <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
              @kaylathompson_ · 2.3M
            </span>
          </div>
        </div>

        {/* Right — product mockup */}
        <div className="flex-1 flex justify-center lg:justify-end">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              transform: "perspective(1200px) rotateY(-8deg) rotateX(2deg)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px var(--border-default)",
              maxWidth: 480,
              width: "100%",
            }}
          >
            {/* Mock dashboard UI */}
            <div style={{ background: "var(--surface-raised)", padding: 24 }}>
              <div className="flex items-center gap-3 mb-5">
                <div style={{ background: "#FF5F57", width: 10, height: 10, borderRadius: "50%" }} />
                <div style={{ background: "#FEBC2E", width: 10, height: 10, borderRadius: "50%" }} />
                <div style={{ background: "#28C840", width: 10, height: 10, borderRadius: "50%" }} />
                <span className="text-xs ml-2 font-mono" style={{ color: "var(--text-tertiary)" }}>imprsn8 · Dashboard</span>
              </div>
              {/* Score ring mockup */}
              <div className="flex items-center gap-6 mb-5">
                <div className="relative" style={{ width: 100, height: 100 }}>
                  <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(242,238,248,0.06)" strokeWidth="6" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#F0A500" strokeWidth="6"
                      strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - 0.87)}`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-bold tabular" style={{ fontSize: 28, color: "#F0A500", fontVariantNumeric: "tabular-nums" }}>87</span>
                  </div>
                </div>
                <div>
                  <div className="text-11 uppercase tracking-widest mb-1" style={{ color: "var(--text-tertiary)" }}>Brand Health Score</div>
                  <div className="font-display font-bold text-base mb-1" style={{ color: "#F0A500" }}>Protected</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>9 active AI agents</div>
                </div>
              </div>
              {/* Mock threat row */}
              <div className="space-y-2">
                {[
                  { handle: "@maya_style_fake", platform: "Instagram", sev: "critical", time: "4m ago" },
                  { handle: "@realkayla_x2",    platform: "TikTok",    sev: "high",     time: "12m ago" },
                ].map((t) => (
                  <div
                    key={t.handle}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{
                      background: "var(--surface-overlay)",
                      borderLeft: `3px solid ${t.sev === "critical" ? "var(--red-400)" : "var(--threat-high)"}`,
                    }}
                  >
                    <span className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>{t.handle}</span>
                    <span className="text-11 ml-auto" style={{ color: "var(--text-tertiary)" }}>{t.platform}</span>
                    <span
                      className={`badge-${t.sev}`}
                    >
                      {t.sev}
                    </span>
                    <span className="text-11 font-mono" style={{ color: "var(--text-tertiary)" }}>{t.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── PROOF TICKER ─────────────────────────────────────────────────────────────
function ProofTicker({ stats }: { stats: PublicStats | null }) {
  const items = [
    `⚡ ${(stats?.influencers_protected ?? 1247).toLocaleString()} creators protected — Guard`,
    `🛡 ${(stats?.threats_detected ?? 48).toLocaleString()} threats blocked today`,
    `🤖 9 AI agents running`,
    `⚠ ${(stats?.takedowns_filed ?? 3).toLocaleString()} fake accounts removed today`,
    `📊 ${(stats?.accounts_monitored ?? 8400).toLocaleString()} accounts monitored`,
    `🏢 Enterprise brand monitoring — Shield`,
    `⚡ Response time under 5 minutes`,
    `🛡 24/7 real-time detection`,
  ];
  const doubled = [...items, ...items];

  return (
    <div
      className="py-4 overflow-hidden"
      style={{ background: "var(--surface-raised)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="ticker-track flex gap-12 whitespace-nowrap" style={{ width: "max-content" }}>
        {doubled.map((item, i) => (
          <span key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {item}
            {i < doubled.length - 1 && <span className="mx-6" style={{ color: "var(--border-default)" }}>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── THREE FEARS ──────────────────────────────────────────────────────────────
function ThreeFears() {
  const fears = [
    {
      icon: "🎭",
      color: "var(--red-400)",
      title: "Someone is pretending to be you.",
      desc: "Impersonators steal your identity, scam your followers, and destroy the trust you've spent years building.",
      cta: "How SENTINEL catches this →",
      href: "#agents",
    },
    {
      icon: "🎣",
      color: "var(--amber-400)",
      title: "That link in your DMs could cost you everything.",
      desc: "Phishing attacks target creators specifically. One click and your accounts, deals, and revenue disappear.",
      cta: "How CIPHER stops this →",
      href: "#agents",
    },
    {
      icon: "📉",
      color: "var(--gold-400)",
      title: "Your brand reputation is shifting right now.",
      desc: "Fake reviews, scam campaigns, and brand attacks erode your influence silently — until it's too late.",
      cta: "How ECHO monitors this →",
      href: "#agents",
    },
  ];

  return (
    <section className="py-24" style={{ background: "var(--surface-base)" }}>
      <div className="max-w-content mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {fears.map((fear, i) => (
            <div
              key={i}
              className="card-enter p-8"
              style={{
                "--card-index": i,
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 16,
              } as React.CSSProperties}
            >
              <div className="text-5xl mb-6">{fear.icon}</div>
              <h3
                className="font-display font-bold text-22 mb-4"
                style={{ color: "var(--text-primary)", lineHeight: 1.2 }}
              >
                {fear.title}
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {fear.desc}
              </p>
              <a href={fear.href} className="text-sm font-medium" style={{ color: fear.color }}>
                {fear.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── WAR ROOM SIMULATION ──────────────────────────────────────────────────────
type SimScenario = "impersonation" | "phishing" | "reputation";

interface SimStep {
  agent: string;
  agentName: AgentName;
  action: string;
  detail: string;
  logColor: "gray" | "violet" | "red" | "gold";
  duration: number; // ms
}

const SCENARIOS: Record<SimScenario, { label: string; emoji: string; steps: SimStep[] }> = {
  impersonation: {
    label: "Impersonation Attack",
    emoji: "🎭",
    steps: [
      { agent: "PHANTOM",  agentName: "PHANTOM",  action: "Detected new account @maya_style_x2",     detail: "97% name similarity detected",             logColor: "violet", duration: 800 },
      { agent: "SENTINEL", agentName: "SENTINEL",  action: "Profile analysis complete",               detail: "94% impersonation confidence",             logColor: "red",    duration: 1000 },
      { agent: "NEXUS",    agentName: "NEXUS",     action: "Cross-platform attribution",              detail: "Same account pattern on 3 platforms",      logColor: "violet", duration: 900 },
      { agent: "CIPHER",   agentName: "CIPHER",    action: "URL scan complete",                       detail: "2 phishing domains detected in bio",       logColor: "red",    duration: 700 },
      { agent: "ECHO",     agentName: "ECHO",      action: "Audience reach calculated",               detail: "12,000 potential victims at risk",          logColor: "red",    duration: 800 },
      { agent: "VERITAS",  agentName: "VERITAS",   action: "Brand impact assessment",                 detail: "−8 score points predicted",                logColor: "violet", duration: 600 },
      { agent: "ARBITER",  agentName: "ARBITER",   action: "Takedown filed — Instagram, TikTok, X",  detail: "Platform reports submitted",               logColor: "gold",   duration: 1000 },
      { agent: "ALL",      agentName: "WATCHDOG",  action: "Threat neutralized",                     detail: "00:04:12 total response time",              logColor: "gold",   duration: 500 },
    ],
  },
  phishing: {
    label: "Phishing Campaign",
    emoji: "🎣",
    steps: [
      { agent: "WATCHDOG", agentName: "WATCHDOG", action: "Suspicious DM campaign detected",         detail: "47 identical messages in 2 hours",          logColor: "violet", duration: 800 },
      { agent: "CIPHER",   agentName: "CIPHER",   action: "URL analysis initiated",                  detail: "3 shortened URLs in circulation",           logColor: "violet", duration: 700 },
      { agent: "CIPHER",   agentName: "CIPHER",   action: "Malicious domains confirmed",             detail: "Credential harvesting pages detected",      logColor: "red",    duration: 900 },
      { agent: "RECON",    agentName: "RECON",    action: "Infrastructure mapping",                  detail: "Linked to known phishing network",          logColor: "red",    duration: 800 },
      { agent: "NEXUS",    agentName: "NEXUS",    action: "Actor attribution complete",              detail: "Same threat actor — 3 previous campaigns",  logColor: "violet", duration: 700 },
      { agent: "ECHO",     agentName: "ECHO",     action: "Victim count estimation",                 detail: "8,400 followers potentially exposed",       logColor: "red",    duration: 600 },
      { agent: "ARBITER",  agentName: "ARBITER",  action: "Platform reports filed",                  detail: "URLs flagged to Google Safe Browsing",      logColor: "gold",   duration: 900 },
      { agent: "ALL",      agentName: "WATCHDOG", action: "Campaign neutralized",                    detail: "00:06:38 total response time",              logColor: "gold",   duration: 500 },
    ],
  },
  reputation: {
    label: "Reputation Crisis",
    emoji: "📉",
    steps: [
      { agent: "ECHO",     agentName: "ECHO",     action: "Sentiment shift detected",               detail: "Brand score dropped 12 points in 6 hours",  logColor: "red",    duration: 800 },
      { agent: "RECON",    agentName: "RECON",    action: "Source attribution scan",                detail: "Coordinated inauthentic behavior found",     logColor: "violet", duration: 900 },
      { agent: "SENTINEL", agentName: "SENTINEL", action: "Bot network identified",                 detail: "340 fake accounts amplifying content",       logColor: "red",    duration: 800 },
      { agent: "VERITAS",  agentName: "VERITAS",  action: "Content authenticity check",             detail: "Deepfake video circulating — flagged",       logColor: "red",    duration: 700 },
      { agent: "NEXUS",    agentName: "NEXUS",    action: "Cross-platform mapping",                 detail: "Same campaign on 4 platforms",               logColor: "violet", duration: 800 },
      { agent: "ARBITER",  agentName: "ARBITER",  action: "Mass report initiated",                  detail: "340 bot accounts reported",                  logColor: "gold",   duration: 1000 },
      { agent: "WATCHDOG", agentName: "WATCHDOG", action: "Brand monitoring heightened",            detail: "Hourly scans enabled for 72 hours",          logColor: "gold",   duration: 600 },
      { agent: "ALL",      agentName: "ECHO",     action: "Crisis contained",                       detail: "Score recovering — +4 in 2 hours",           logColor: "gold",   duration: 500 },
    ],
  },
};

function WarRoomSim() {
  const [scenario, setScenario] = useState<SimScenario>("impersonation");
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const sim = SCENARIOS[scenario];
  const totalSteps = sim.steps.length;
  const visibleSteps = step >= 0 ? sim.steps.slice(0, step + 1) : [];

  function reset() {
    setStep(-1);
    setPlaying(false);
    if (intervalRef.current) clearTimeout(intervalRef.current);
  }

  function nextStep() {
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing) { if (intervalRef.current) clearTimeout(intervalRef.current); return; }
    if (step >= totalSteps - 1) { setPlaying(false); return; }
    const delay = (sim.steps[step + 1]?.duration ?? 800) / speed;
    intervalRef.current = setTimeout(() => { nextStep(); }, delay);
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); };
  }, [playing, step, speed, scenario]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [visibleSteps.length]);

  // When scenario changes, reset
  useEffect(() => { reset(); }, [scenario]);

  const logColors = {
    gray:   "var(--text-tertiary)",
    violet: "var(--violet-300)",
    red:    "var(--red-400)",
    gold:   "var(--gold-400)",
  };

  return (
    <section id="simulation" className="py-24" style={{ background: "var(--surface-raised)" }}>
      <div className="max-w-content mx-auto px-6">
        <div className="text-center mb-10">
          <div className="text-11 uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
            SIMULATION
          </div>
          <h2 className="font-display font-bold text-38 mb-3" style={{ color: "var(--text-primary)" }}>
            Watch the agents respond.
          </h2>
          <p className="text-base" style={{ color: "var(--text-secondary)" }}>
            Select a scenario and watch how 9 specialized AI agents coordinate in real time.
          </p>
        </div>

        {/* Scenario tabs */}
        <div className="flex justify-center gap-3 mb-8 flex-wrap">
          {(Object.entries(SCENARIOS) as [SimScenario, typeof SCENARIOS[SimScenario]][]).map(([key, s]) => (
            <button
              key={key}
              onClick={() => setScenario(key)}
              className="filter-pill px-4 py-2"
              style={{
                background: scenario === key ? "var(--surface-overlay)" : "",
                borderColor: scenario === key ? "var(--border-strong)" : "",
                color: scenario === key ? "var(--text-primary)" : "",
                fontSize: 13,
              }}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border-default)", background: "var(--surface-overlay)" }}
        >
          <div className="flex flex-col lg:flex-row" style={{ minHeight: 400 }}>
            {/* Left: Rive story animation */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: "1px solid var(--border-subtle)", minWidth: 0 }}>
              <RiveStory step={step} playing={playing} scenario={scenario} />
            </div>

            {/* Right: live log */}
            <div className="flex-1 flex flex-col">
              <div
                ref={logRef}
                className="flex-1 overflow-y-auto p-5 font-mono text-xs space-y-1.5"
                style={{ minHeight: 280, maxHeight: 320 }}
              >
                {step === -1 ? (
                  <div className="flex items-center justify-center h-full">
                    <span style={{ color: "var(--text-tertiary)" }}>Press Play to start simulation…</span>
                  </div>
                ) : (
                  visibleSteps.map((s, i) => (
                    <div key={i} className="flex gap-3">
                      <span style={{ color: "var(--text-tertiary)", flexShrink: 0, width: 20 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ color: logColors[s.logColor], flexShrink: 0, width: 60 }}>[{s.agent}]</span>
                      <span style={{ color: "var(--text-secondary)" }}>{s.action} — </span>
                      <span style={{ color: logColors[s.logColor] }}>{s.detail}</span>
                    </div>
                  ))
                )}
                {step === totalSteps - 1 && (
                  <div className="mt-4 p-3 rounded-lg text-center"
                    style={{ background: "rgba(240,165,0,0.08)", border: "1px solid var(--border-gold)" }}>
                    <div className="font-bold mb-1" style={{ color: "var(--gold-400)" }}>
                      {sim.steps[totalSteps - 1]?.detail}
                    </div>
                    <div className="text-11" style={{ color: "var(--text-tertiary)" }}>
                      Without imprsn8: this threat could have run for weeks.
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div
                className="px-5 py-4 flex items-center gap-3 flex-wrap"
                style={{ borderTop: "1px solid var(--border-subtle)" }}
              >
                <button onClick={reset} className="btn-icon !p-1.5" title="Reset"><RefreshCw size={13} /></button>
                <button onClick={prevStep} disabled={step <= 0} className="btn-icon !p-1.5" title="Previous"><SkipBack size={13} /></button>
                <button
                  onClick={() => { if (step === -1) setStep(0); setPlaying((p) => !p); }}
                  className="btn-gold flex items-center gap-1.5 px-4 py-1.5 text-sm"
                >
                  {playing ? <Pause size={12} /> : <Play size={12} />}
                  {playing ? "Pause" : step === -1 ? "Play" : "Resume"}
                </button>
                <button onClick={nextStep} disabled={step >= totalSteps - 1} className="btn-icon !p-1.5" title="Next"><SkipForward size={13} /></button>

                {/* Progress */}
                <div className="flex-1 min-w-[120px]">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-float)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${step < 0 ? 0 : ((step + 1) / totalSteps) * 100}%`,
                        background: "var(--gold-400)",
                        transition: "width 300ms ease",
                      }}
                    />
                  </div>
                  <div className="text-11 mt-1" style={{ color: "var(--text-tertiary)" }}>
                    Step {Math.max(step + 1, 0)} of {totalSteps}
                  </div>
                </div>

                {/* Speed */}
                <div className="flex gap-1">
                  {[0.5, 1, 2].map((s) => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className="text-11 px-2 py-1 rounded"
                      style={{
                        background: speed === s ? "var(--surface-raised)" : "transparent",
                        border: `1px solid ${speed === s ? "var(--border-strong)" : "var(--border-subtle)"}`,
                        color: speed === s ? "var(--text-primary)" : "var(--text-tertiary)",
                      }}>
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {step === totalSteps - 1 && (
          <div className="mt-6 text-center">
            <Link to="/register" className="btn-gold px-6 py-3 text-base">
              Start Your Free Protection →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── AGENT DIRECTORY ──────────────────────────────────────────────────────────
const AGENT_STATS: Partial<Record<AgentName, string>> = {
  SENTINEL: "47K+ threats detected",
  RECON:    "230K+ profiles scanned",
  VERITAS:  "98.4% accuracy",
  NEXUS:    "12K+ actors linked",
  ARBITER:  "8.2K+ takedowns filed",
  WATCHDOG: "24/7 monitoring",
  PHANTOM:  "Coming soon",
  CIPHER:   "15K+ URLs analyzed",
  ECHO:     "Reach calculated in realtime",
};

function AgentDirectory() {
  const agents: AgentName[] = ["SENTINEL", "RECON", "VERITAS", "NEXUS", "ARBITER", "WATCHDOG", "PHANTOM", "CIPHER", "ECHO"];

  return (
    <section id="intelligence" className="py-24" style={{ background: "var(--surface-base)" }}>
      <div className="max-w-content mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="font-display font-bold text-38 mb-4" style={{ color: "var(--text-primary)" }}>
            Meet the Intelligence.
          </h2>
          <p className="text-base" style={{ color: "var(--text-secondary)", maxWidth: 540, margin: "0 auto" }}>
            9 specialized AI agents work together, each an expert in a different threat domain.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((name, i) => {
            const color = AGENT_COLORS[name];
            const desc = AGENT_DESCRIPTIONS[name];
            const stat = AGENT_STATS[name];
            const isComingSoon = name === "PHANTOM";
            return (
              <div
                key={name}
                className="card-enter p-6"
                style={{
                  "--card-index": i,
                  background: isComingSoon ? "var(--surface-raised)" : `${color}08`,
                  border: `1px solid ${isComingSoon ? "var(--border-subtle)" : `${color}20`}`,
                  borderRadius: 16,
                  opacity: isComingSoon ? 0.6 : 1,
                } as React.CSSProperties}
              >
                <div className="flex justify-center mb-5">
                  <AgentIcon name={name} size={64} />
                </div>
                <h3 className="font-display font-bold text-18 text-center mb-1" style={{ color }}>
                  {name}
                </h3>
                <p className="text-xs text-center mb-3" style={{ color: "var(--text-secondary)" }}>{desc}</p>
                {stat && (
                  <div
                    className="text-xs text-center px-3 py-1.5 rounded-full"
                    style={{ background: `${color}12`, color }}
                  >
                    {stat}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── SOCIAL PROOF ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: "Kayla Thompson",
    handle: "@kaylathompson_",
    followers: "2.3M followers",
    quote: "imprsn8 caught a fake account before my brand deal fell through. The ROI on that one detection was massive.",
  },
  {
    name: "Marcus Rivera",
    handle: "@marcusrivera",
    followers: "890K followers",
    quote: "Within 48 hours, SENTINEL found 3 accounts impersonating me. The takedown process was completely handled.",
  },
  {
    name: "Priya Sharma",
    handle: "@priyacreates",
    followers: "1.1M followers",
    quote: "The phishing link my audience received was caught before anyone clicked it. That&#8217;s the protection I needed.",
  },
];

function SocialProof() {
  return (
    <section className="py-24" style={{ background: "var(--surface-raised)" }}>
      <div className="max-w-content mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-38 mb-4" style={{ color: "var(--text-primary)" }}>
            Trusted by creators.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className="card-featured p-6"
              style={{ borderRadius: 16 }}
            >
              <div className="flex items-center gap-0.5 mb-4">
                {[1,2,3,4,5].map((s) => <Star key={s} size={13} fill="#F0A500" color="#F0A500" />)}
              </div>
              <p className="text-sm mb-5 italic leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                &#8220;{t.quote}&#8221;
              </p>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t.name}</div>
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {t.handle} · {t.followers}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SHIELD TEASER ────────────────────────────────────────────────────────────
function ShieldTeaser() {
  const features = [
    { icon: "🏢", title: "Enterprise-grade monitoring", desc: "Multi-brand roster management with dedicated SOC analysts and SLA-backed response." },
    { icon: "🔍", title: "Domain & trademark protection", desc: "Monitor web, dark web, and social channels for unauthorised use of your brand assets." },
    { icon: "📊", title: "Brand intelligence reports", desc: "Automated weekly reports with trend analysis, threat attribution, and executive summaries." },
    { icon: "⚡", title: "API & integrations", desc: "Connect to your existing SIEM, Slack, or Jira. White-label reports for agency clients." },
  ];

  return (
    <section
      className="py-24"
      style={{
        background: "radial-gradient(ellipse at 70% 50%, rgba(109,64,237,0.08) 0%, var(--surface-base) 60%)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-content mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-16 items-center">

          {/* Left — copy */}
          <div style={{ flex: "0 0 460px", maxWidth: 460 }}>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{ background: "rgba(109,64,237,0.12)", border: "1px solid rgba(109,64,237,0.3)", color: "var(--violet-300)" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--violet-400)", display: "inline-block" }} />
              Shield — Enterprise Brand Protection
            </div>

            <h2
              className="font-display font-bold mb-5"
              style={{ fontSize: "clamp(30px, 4vw, 44px)", lineHeight: 1.1, color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              Brand protection<br />
              <span style={{ color: "var(--violet-300)" }}>at enterprise scale.</span>
            </h2>

            <p className="mb-8 text-base" style={{ color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 420 }}>
              While Guard protects individual creators, Shield is built for marketing teams,
              agencies, and enterprise brands managing reputation across dozens of channels —
              with dedicated analysts, custom AI tuning, and full API access.
            </p>

            <a
              href="/shield"
              className="btn-ghost inline-flex items-center gap-2 text-base px-6 py-3"
              style={{ borderColor: "rgba(109,64,237,0.4)", color: "var(--violet-300)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(109,64,237,0.7)"; e.currentTarget.style.background = "rgba(109,64,237,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(109,64,237,0.4)"; e.currentTarget.style.background = ""; }}
            >
              Explore Shield →
            </a>

            <p className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
              Custom pricing · Demo available · Team onboarding included
            </p>
          </div>

          {/* Right — feature grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div
                key={i}
                className="card-enter p-5"
                style={{
                  "--card-index": i,
                  background: "var(--surface-raised)",
                  border: "1px solid rgba(109,64,237,0.15)",
                  borderRadius: 12,
                } as React.CSSProperties}
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h4 className="font-semibold text-sm mb-2" style={{ color: "var(--text-primary)" }}>{f.title}</h4>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── PRICING ──────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: "Creator",
    price: "Free",
    period: "",
    featured: false,
    cta: "Start Free",
    features: [
      "2 platforms monitored",
      "SENTINEL basic detection",
      "Weekly threat summary",
      "Email alerts",
    ],
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    featured: true,
    cta: "Get Pro",
    features: [
      "Unlimited platforms",
      "All 9 AI agents active",
      "Real-time threat alerts",
      "Takedown filing assistance",
      "Brand Health Score",
      "Priority SOC support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    featured: false,
    cta: "Contact Sales",
    features: [
      "Multi-creator roster",
      "Dedicated SOC analysts",
      "Custom agent configuration",
      "SLA-backed response",
      "API access",
      "White-label reports",
    ],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-24" style={{ background: "var(--surface-base)" }}>
      <div className="max-w-content mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="font-display font-bold text-38 mb-4" style={{ color: "var(--text-primary)" }}>
            Protection that scales.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: plan.featured ? "var(--surface-overlay)" : "var(--surface-raised)",
                border: plan.featured ? "1px solid var(--border-gold)" : "1px solid var(--border-subtle)",
                borderRadius: 16,
                padding: 28,
                transform: plan.featured ? "scale(1.03)" : "none",
                position: "relative",
              }}
            >
              {plan.featured && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-11 font-bold px-3 py-1 rounded-full"
                  style={{ background: "var(--gold-400)", color: "var(--gold-600)" }}
                >
                  Most Popular
                </div>
              )}
              <div className="text-11 uppercase tracking-widest mb-2" style={{ color: "var(--text-tertiary)" }}>{plan.name}</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-display font-bold" style={{ fontSize: 38, color: "var(--text-primary)" }}>{plan.price}</span>
                {plan.period && <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>{plan.period}</span>}
              </div>
              <ul className="space-y-2.5 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <Check size={13} style={{ color: "var(--green-400)", flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={plan.featured ? "btn-gold w-full text-center block py-3" : "btn-ghost w-full text-center block py-3"}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA + FOOTER ─────────────────────────────────────────────────────────────
function CtaFooter() {
  return (
    <>
      {/* CTA */}
      <section
        className="py-28 text-center"
        style={{ background: "radial-gradient(ellipse at 50% 50%, #1A0F2E 0%, var(--surface-base) 70%)" }}
      >
        <div className="max-w-content mx-auto px-6">
          <h2
            className="font-display font-bold mb-6"
            style={{ fontSize: "clamp(36px, 5vw, 54px)", color: "var(--text-primary)", lineHeight: 1.1 }}
          >
            Your identity<br />
            <span style={{ color: "var(--gold-400)" }}>deserves a guardian.</span>
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <Link to="/register" className="btn-gold inline-block text-base px-8 py-4">
              Start Free with Guard →
            </Link>
            <a
              href="/shield"
              className="btn-ghost inline-block text-base px-8 py-4 text-center"
              style={{ borderColor: "rgba(109,64,237,0.4)", color: "var(--violet-300)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(109,64,237,0.7)"; e.currentTarget.style.background = "rgba(109,64,237,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(109,64,237,0.4)"; e.currentTarget.style.background = ""; }}
            >
              Enterprise? Explore Shield →
            </a>
          </div>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            No credit card required · 2-minute setup · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-12"
        style={{ background: "var(--surface-raised)", borderTop: "1px solid var(--border-subtle)" }}
      >
        <div className="max-w-content mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-8 mb-10">
            <div className="flex-1">
              <TrustRadarLogo variant="topbar" theme="dark" className="mb-3" />
              <p className="text-xs" style={{ color: "var(--text-tertiary)", maxWidth: 240, lineHeight: 1.7 }}>
                Guard protects creators. Shield protects brands. 9 AI agents. 24/7 defense.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <a href="/register" className="text-xs" style={{ color: "var(--gold-400)" }}>Guard ↗</a>
                <a href="/shield" className="text-xs" style={{ color: "var(--violet-300)" }}>Shield ↗</a>
              </div>
            </div>
            {[
              { label: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
              { label: "Company", links: ["About", "Blog", "Careers", "Press"] },
              { label: "Legal", links: ["Privacy", "Terms", "Cookie Policy"] },
            ].map((col) => (
              <div key={col.label}>
                <div className="text-11 uppercase tracking-widest mb-4" style={{ color: "var(--text-tertiary)" }}>
                  {col.label}
                </div>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-xs transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}>
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-2 pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between w-full">
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>© 2026 Trust Radar. All rights reserved.</span>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Privacy · Terms</span>
            </div>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              Operated by{" "}
              <span style={{ color: "var(--text-secondary)" }}>LRX Enterprises Inc.</span>
              {" "}{"\u{1F1E8}\u{1F1E6}"} Canadian owned and operated
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Home() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    publicApi.stats().then(setStats).catch(() => null);
  }, []);

  return (
    <div style={{ background: "var(--surface-base)", minHeight: "100vh" }}>
      <Nav />
      <Hero stats={stats} />
      <ProofTicker stats={stats} />
      <ThreeFears />
      <WarRoomSim />
      <AgentDirectory />
      <SocialProof />
      <ShieldTeaser />
      <Pricing />
      <CtaFooter />
    </div>
  );
}
