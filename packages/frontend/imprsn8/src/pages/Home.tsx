import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: "✦",
    title: "AI Impression Score",
    desc: "Get a 0–100 score on your digital presence powered by GPT-4o.",
  },
  {
    icon: "◈",
    title: "Multi-Platform Analysis",
    desc: "Analyze LinkedIn, Twitter, GitHub, Instagram and more in one place.",
  },
  {
    icon: "◉",
    title: "Actionable Insights",
    desc: "Receive specific suggestions to strengthen your personal brand.",
  },
  {
    icon: "◌",
    title: "Score Tracking",
    desc: "Track how your impression evolves over time with trend charts.",
  },
];

export default function Home() {
  const token = localStorage.getItem("imprsn8_token");

  return (
    <div className="max-w-5xl mx-auto px-4">
      {/* Hero */}
      <section className="py-24 text-center space-y-8">
        <div className="inline-flex items-center gap-2 border border-brand-border rounded-full px-4 py-1.5 text-sm text-brand-muted mb-4">
          <span className="w-2 h-2 rounded-full bg-brand-purple animate-pulse" />
          AI-powered personal brand analysis
        </div>

        <h1 className="text-6xl font-extrabold tracking-tight leading-tight">
          Your digital first{" "}
          <span className="gradient-text">impression</span>
          <br />starts here.
        </h1>

        <p className="text-brand-muted text-xl max-w-xl mx-auto leading-relaxed">
          imprsn8 scores your online presence across platforms, identifies gaps, and gives you a clear roadmap to stand out.
        </p>

        <div className="flex items-center justify-center gap-4">
          {token ? (
            <Link to="/dashboard" className="btn-primary text-base px-8 py-4">
              Go to Dashboard →
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary text-base px-8 py-4">
                Analyze my presence
              </Link>
              <Link to="/login" className="btn-ghost text-base px-8 py-4">
                Sign in
              </Link>
            </>
          )}
        </div>

        {/* Score preview */}
        <div className="mt-8 inline-flex items-center gap-6 card py-5 px-8">
          {[
            { label: "Clarity", score: 88 },
            { label: "Impact", score: 74 },
            { label: "Consistency", score: 92 },
            { label: "Professional", score: 81 },
          ].map(({ label, score }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold gradient-text">{score}</div>
              <div className="text-xs text-brand-muted mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 space-y-10">
        <h2 className="text-center text-3xl font-bold text-slate-100">Everything you need to level up</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} className="card hover:border-brand-purple/50 transition-colors group">
              <div className="text-2xl text-brand-purple mb-3">{icon}</div>
              <h3 className="font-semibold text-slate-100 mb-1 group-hover:text-brand-purple transition-colors">{title}</h3>
              <p className="text-brand-muted text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <div className="card py-14 px-8 space-y-6 bg-gradient-to-br from-brand-card via-brand-card to-brand-purple/5">
          <h2 className="text-4xl font-extrabold gradient-text">Ready to know your score?</h2>
          <p className="text-brand-muted max-w-md mx-auto">
            Join thousands of professionals who use imprsn8 to grow their digital presence.
          </p>
          <Link to="/register" className="btn-primary inline-block text-base px-10 py-4">
            Start for free
          </Link>
        </div>
      </section>
    </div>
  );
}
