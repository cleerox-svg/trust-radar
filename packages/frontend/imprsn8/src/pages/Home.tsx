import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: "✦",
    title: "AI Impression Score",
    desc: "Get a 0–100 score on your digital presence powered by advanced AI analysis.",
    glow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
  },
  {
    icon: "◈",
    title: "Multi-Platform Analysis",
    desc: "Analyze LinkedIn, Twitter, GitHub, Instagram and more in one place.",
    glow: "hover:shadow-[0_0_30px_rgba(236,72,153,0.12)]",
  },
  {
    icon: "◉",
    title: "Actionable Insights",
    desc: "Receive specific suggestions to strengthen your personal brand.",
    glow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
  },
  {
    icon: "◌",
    title: "Score Tracking",
    desc: "Track how your impression evolves over time with trend charts.",
    glow: "hover:shadow-[0_0_30px_rgba(236,72,153,0.12)]",
  },
];

const SCORES = [
  { label: "Clarity", score: 88, color: "#8b5cf6" },
  { label: "Impact", score: 74, color: "#a78bfa" },
  { label: "Consistency", score: 92, color: "#ec4899" },
  { label: "Professional", score: 81, color: "#8b5cf6" },
];

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

export default function Home() {
  const token = localStorage.getItem("imprsn8_token");

  return (
    <div className="relative">
      {/* Background glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-brand-purple/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-60 w-[500px] h-[500px] rounded-full bg-brand-pink/8 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-brand-purple/8 blur-[80px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="pt-20 pb-24 text-center space-y-8">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 border border-brand-border/80 rounded-full px-4 py-1.5 text-xs text-brand-muted mb-2 bg-brand-card/50 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-pulse" style={{ boxShadow: "0 0 8px #8b5cf6" }} />
            AI-powered personal brand analysis
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05]">
            Your digital first{" "}
            <span className="gradient-text" style={{ filter: "drop-shadow(0 0 40px rgba(139,92,246,0.4))" }}>
              impression
            </span>
            <br />starts here.
          </h1>

          <p className="text-brand-muted text-lg sm:text-xl max-w-lg mx-auto leading-relaxed">
            imprsn8 scores your online presence across platforms, identifies gaps, and gives you a clear roadmap to stand out.
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
                  Analyze my presence
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

          {/* Social proof */}
          <p className="text-xs text-brand-muted/60 tracking-wider uppercase">
            Trusted by creators, founders &amp; professionals
          </p>
        </section>

        {/* ── Features ─────────────────────────────────────────────── */}
        <section className="py-16 space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100">Everything you need to level up</h2>
            <p className="text-brand-muted max-w-md mx-auto">One platform. Full clarity on your digital brand.</p>
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
        <section className="py-16">
          <h2 className="text-center text-3xl font-bold text-slate-100 mb-12">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
            <div className="hidden sm:block absolute top-6 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px bg-gradient-to-r from-brand-purple/40 via-brand-pink/40 to-brand-purple/40" />
            {[
              { step: "01", title: "Connect your profiles", desc: "Paste your bio, content, or link your social profiles." },
              { step: "02", title: "AI analysis runs", desc: "Our engine scores clarity, impact, professionalism & consistency." },
              { step: "03", title: "Get your roadmap", desc: "Receive a prioritised action list to boost your score." },
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
              <h2 className="text-4xl font-extrabold gradient-text mb-4">Ready to know your score?</h2>
              <p className="text-brand-muted max-w-md mx-auto mb-8">
                Join thousands of professionals who use imprsn8 to grow their digital presence.
              </p>
              <Link to="/register" className="btn-primary inline-block text-base px-10 py-4"
                style={{ boxShadow: "0 0 40px rgba(139,92,246,0.4)" }}>
                Start for free →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
