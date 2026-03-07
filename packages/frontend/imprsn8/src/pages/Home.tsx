import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { publicApi } from "../lib/api";
import type { PublicStats } from "../lib/types";
import { ThemeToggle } from "../components/ui/ThemeToggle";

// ── Animated counter ──────────────────────────────────────────
function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(ease * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return value;
}

function StatCounter({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const count = useCountUp(value);
  return (
    <div className="text-center space-y-1">
      <div className="text-3xl sm:text-4xl font-extrabold gradient-text tabular-nums">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-xs text-brand-muted uppercase tracking-widest">{label}</div>
    </div>
  );
}

// ── Mini SVG ring ─────────────────────────────────────────────
function MiniRing({ score, color, label }: { score: number; color: string; label: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg className="-rotate-90" width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="6" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.5s ease", filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="text-center -mt-1">
        <div className="font-bold text-base" style={{ color }}>{score}</div>
        <div className="text-[10px] text-brand-muted">{label}</div>
      </div>
    </div>
  );
}

const SCORES = [
  { label: "Clarity", score: 88, color: "#8b5cf6" },
  { label: "Impact", score: 74, color: "#a78bfa" },
  { label: "Consistency", score: 92, color: "#ec4899" },
  { label: "Professional", score: 81, color: "#8b5cf6" },
];

const FEATURES = [
  {
    icon: "◈",
    title: "AI-Powered Threat Detection",
    desc: "Autonomous agents scan platforms 24/7 to surface impersonators, fake accounts, and brand hijackers before they cause damage.",
    glow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
  },
  {
    icon: "✦",
    title: "Impression Score",
    desc: "A 0–100 AI score across clarity, impact, consistency and professionalism. Know exactly where you stand.",
    glow: "hover:shadow-[0_0_30px_rgba(236,72,153,0.12)]",
  },
  {
    icon: "◉",
    title: "Automated Takedowns",
    desc: "File platform takedown requests in one click. Track status from draft to resolved without leaving the dashboard.",
    glow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
  },
  {
    icon: "◌",
    title: "Multi-Platform Coverage",
    desc: "Monitor Instagram, TikTok, X, YouTube and more. One unified view of your entire digital footprint.",
    glow: "hover:shadow-[0_0_30px_rgba(236,72,153,0.12)]",
  },
];

const THREAT_TYPES = [
  { label: "Fake accounts", color: "#ef4444" },
  { label: "Username squatting", color: "#f97316" },
  { label: "Bio impersonation", color: "#eab308" },
  { label: "Content theft", color: "#ec4899" },
];

export default function Home() {
  const token = localStorage.getItem("imprsn8_token");
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    publicApi.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="relative">
      {/* Floating theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Background glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-brand-purple/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-60 w-[500px] h-[500px] rounded-full bg-brand-pink/8 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-brand-purple/8 blur-[80px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="pt-20 pb-16 text-center space-y-8">
          {/* Logo mark */}
          <Link to="/" className="inline-block mb-2 group">
            <span className="font-extrabold text-2xl tracking-tight gradient-text group-hover:opacity-80 transition-opacity">
              imprsn<span style={{ color: "#eab308" }}>8</span>
            </span>
          </Link>

          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 border border-brand-border/80 rounded-full px-4 py-1.5 text-xs text-brand-muted bg-brand-card/50 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-pulse" style={{ boxShadow: "0 0 8px #8b5cf6" }} />
            Real-time brand protection &amp; trust intelligence
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05]">
            Protect your{" "}
            <span className="gradient-text" style={{ filter: "drop-shadow(0 0 40px rgba(139,92,246,0.4))" }}>
              digital identity
            </span>
            <br />before it's stolen.
          </h1>

          <p className="text-brand-muted text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
            imprsn8 deploys AI agents to detect impersonators, score your online presence,
            and fire takedowns — all from one command center.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {token ? (
              <Link to="/dashboard" className="btn-primary text-base px-8 py-3.5"
                style={{ boxShadow: "0 0 30px rgba(139,92,246,0.35)" }}>
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary text-base px-8 py-3.5"
                  style={{ boxShadow: "0 0 30px rgba(139,92,246,0.35)" }}>
                  Protect my brand →
                </Link>
                <Link to="/login" className="btn-ghost text-base px-8 py-3.5">
                  Sign in
                </Link>
              </>
            )}
          </div>

          {/* Score preview card */}
          <div className="mt-10 inline-flex items-center gap-8 card py-6 px-10 mx-auto
                          border-brand-purple/20 bg-brand-card/80 backdrop-blur
                          shadow-[0_0_60px_rgba(139,92,246,0.12)]">
            <div className="hidden sm:block text-left pr-6 border-r border-brand-border">
              <div className="text-xs text-brand-muted mb-1 uppercase tracking-widest">Overall</div>
              <div className="text-4xl font-extrabold gradient-text">84</div>
              <div className="text-xs text-brand-muted mt-0.5">Impression Score</div>
            </div>
            <div className="flex items-center gap-6 sm:gap-8">
              {SCORES.map(({ label, score, color }) => (
                <MiniRing key={label} score={score} color={color} label={label} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Live Stats ───────────────────────────────────────────── */}
        <section className="py-12">
          <div className="card border-brand-purple/20 bg-brand-card/60 backdrop-blur px-6 py-10
                          shadow-[0_0_60px_rgba(139,92,246,0.08)]">
            <p className="text-center text-xs text-brand-muted uppercase tracking-widest mb-8">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: "0 0 6px #4ade80" }} />
                Live platform statistics
              </span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              <StatCounter value={stats?.influencers_protected ?? 0} label="Influencers Protected" />
              <StatCounter value={stats?.accounts_monitored ?? 0} label="Accounts Monitored" />
              <StatCounter value={stats?.threats_detected ?? 0} label="Threats Detected" />
              <StatCounter value={stats?.takedowns_filed ?? 0} label="Takedowns Filed" />
            </div>
          </div>
        </section>

        {/* ── Threat Types ─────────────────────────────────────────── */}
        <section className="py-12 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100">
              What we <span className="gradient-text">catch</span>
            </h2>
            <p className="text-brand-muted max-w-md mx-auto">
              Our agents surface every type of identity threat across every major platform.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THREAT_TYPES.map(({ label, color }) => (
              <div key={label}
                className="card text-center py-5 hover:border-brand-purple/40 transition-all duration-300 cursor-default"
                style={{ boxShadow: `0 0 20px ${color}10` }}>
                <div className="w-2 h-2 rounded-full mx-auto mb-3" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <div className="text-sm font-medium text-slate-200">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────── */}
        <section className="py-12 space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100">The full protection stack</h2>
            <p className="text-brand-muted max-w-md mx-auto">Every tool you need. One dashboard.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon, title, desc, glow }) => (
              <div key={title}
                className={`card hover:border-brand-purple/40 transition-all duration-300 group cursor-default ${glow}`}>
                <div className="text-2xl mb-4 text-brand-purple" style={{ filter: "drop-shadow(0 0 8px rgba(139,92,246,0.6))" }}>
                  {icon}
                </div>
                <h3 className="font-semibold text-slate-100 mb-2 group-hover:text-brand-purple transition-colors">{title}</h3>
                <p className="text-brand-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────── */}
        <section className="py-12">
          <h2 className="text-center text-3xl font-bold text-slate-100 mb-12">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
            <div className="hidden sm:block absolute top-6 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px bg-gradient-to-r from-brand-purple/40 via-brand-pink/40 to-brand-purple/40" />
            {[
              { step: "01", title: "Connect your profiles", desc: "Add your handles across Instagram, TikTok, X, YouTube and more." },
              { step: "02", title: "Agents go to work", desc: "AI agents scan continuously, scoring your presence and hunting imposters." },
              { step: "03", title: "Protect & grow", desc: "Get threat alerts, fire takedowns, and a clear roadmap to raise your score." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full border border-brand-border bg-brand-card flex items-center justify-center mx-auto font-mono text-sm font-bold gradient-text"
                  style={{ boxShadow: "0 0 20px rgba(139,92,246,0.2)" }}>
                  {step}
                </div>
                <h3 className="font-semibold text-slate-200">{title}</h3>
                <p className="text-brand-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <section className="py-20 text-center">
          <div className="relative card py-16 px-8 space-y-6 overflow-hidden border-brand-purple/20">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/5 via-transparent to-brand-pink/5 pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-brand-purple/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <Link to="/" className="inline-block mb-6 group">
                <span className="font-extrabold text-3xl tracking-tight gradient-text group-hover:opacity-80 transition-opacity">
                  imprsn<span style={{ color: "#eab308" }}>8</span>
                </span>
              </Link>
              <h2 className="text-4xl font-extrabold gradient-text mb-4">Your identity deserves a guardian.</h2>
              <p className="text-brand-muted max-w-md mx-auto mb-8">
                Join the creators, founders &amp; professionals who trust imprsn8 to protect what they've built.
              </p>
              {token ? (
                <Link to="/dashboard" className="btn-primary inline-block text-base px-10 py-4"
                  style={{ boxShadow: "0 0 40px rgba(139,92,246,0.4)" }}>
                  Go to Dashboard →
                </Link>
              ) : (
                <Link to="/register" className="btn-primary inline-block text-base px-10 py-4"
                  style={{ boxShadow: "0 0 40px rgba(139,92,246,0.4)" }}>
                  Start protecting for free →
                </Link>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
