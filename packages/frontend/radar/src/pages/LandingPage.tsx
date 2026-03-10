import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getToken } from "../lib/api";
import { WordMark } from "../components/LogoMark";

/* ── 10 Shield Guardian Agent Cards ────────────────────────── */
const AGENTS = [
  { name: "Sentinel", role: "Triage & Routing", color: "#22D3EE", desc: "First-response agent that classifies incoming threats, assigns severity, and routes to the right team." },
  { name: "Reaper", role: "Takedown Automation", color: "#EF4444", desc: "Automates DMCA notices, registrar abuse reports, and platform takedown requests at scale." },
  { name: "Phantom", role: "Dark Web Monitor", color: "#A855F7", desc: "Crawls .onion sites, paste dumps, and underground forums for leaked credentials and brand mentions." },
  { name: "Prism", role: "Brand Impersonation", color: "#3B82F6", desc: "Detects lookalike domains, phishing kits, and social media impersonation campaigns." },
  { name: "Oracle", role: "Predictive Analysis", color: "#F59E0B", desc: "Uses ML models to predict emerging threat vectors and pre-emptively adjust defences." },
  { name: "Nexus", role: "Signal Correlation", color: "#10B981", desc: "Links disparate threat indicators across feeds into unified campaign clusters." },
  { name: "Aegis", role: "Certificate Monitor", color: "#6366F1", desc: "Monitors Certificate Transparency logs for unauthorized certificate issuance." },
  { name: "Vanguard", role: "Feed Ingestion", color: "#EC4899", desc: "Orchestrates 24 intelligence feeds with circuit breaker protection and deduplication." },
  { name: "Herald", role: "Alert Dispatch", color: "#14B8A6", desc: "Smart alerting with risk scoring, deduplication, and escalation workflows." },
  { name: "Arbiter", role: "HITL Gatekeeper", color: "#F97316", desc: "Enforces human-in-the-loop approval for high-impact automated actions." },
];

/* ── How It Works steps ─────────────────────────────────────── */
const STEPS = [
  { label: "Measure", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", desc: "Continuous scanning across 24 intelligence feeds, domain registries, and dark web sources." },
  { label: "Monitor", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z", desc: "10 autonomous AI agents correlate signals, detect campaigns, and surface emerging threats." },
  { label: "Defend", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", desc: "Automated takedowns, abuse reports, and coordinated response with HITL approval gates." },
  { label: "Report", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", desc: "Daily briefings, executive dashboards, SLA tracking, and compliance audit trails." },
];

/* ── Threat heatmap hotspots (simplified world map) ─────────── */
const HOTSPOTS = [
  { cx: 25, cy: 35, r: 3, label: "US East" },
  { cx: 18, cy: 40, r: 2.5, label: "US West" },
  { cx: 48, cy: 30, r: 3.5, label: "Europe" },
  { cx: 55, cy: 32, r: 2, label: "Russia" },
  { cx: 75, cy: 40, r: 4, label: "China" },
  { cx: 70, cy: 55, r: 2, label: "SE Asia" },
  { cx: 42, cy: 55, r: 1.5, label: "Africa" },
  { cx: 30, cy: 60, r: 2, label: "Brazil" },
  { cx: 83, cy: 65, r: 1.5, label: "Australia" },
  { cx: 60, cy: 35, r: 2.5, label: "Middle East" },
];

/* ── Stat ticker data ────────────────────────────────────────── */
const STATS = [
  { label: "URLs Scanned", value: "12M+" },
  { label: "Threats Blocked", value: "847K" },
  { label: "Intel Feeds", value: "24" },
  { label: "AI Agents", value: "10" },
  { label: "Uptime", value: "99.99%" },
  { label: "Response Time", value: "<200ms" },
];

/* ── Feature cards ───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    title: "Real-Time URL Scanning",
    description: "Instantly analyze any URL for phishing, malware, brand impersonation, and emerging threats with our multi-engine scanner.",
  },
  {
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    title: "24 Intelligence Feeds",
    description: "Automated ingestion from OSINT, dark web, social media, DNS, certificate transparency, and threat intel sources.",
  },
  {
    icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    title: "10 AI Agents",
    description: "Autonomous agents for triage, threat hunting, impersonation detection, takedown automation, and predictive analysis.",
  },
  {
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Global Threat Map",
    description: "Live SVG world map with heat-colored hotspots, animated pulse rings, and cross-border connection visualization.",
  },
  {
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    title: "Smart Alerting",
    description: "Risk-scored alerts with circuit breaker protection, HITL agent approval gating, and automated escalation workflows.",
  },
  {
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    title: "Security First",
    description: "Rate limiting, CSP headers, input sanitization, HSTS preload, and encrypted storage. Built on Cloudflare's global network.",
  },
];

/* ── Pricing tiers ───────────────────────────────────────────── */
const PRICING = [
  {
    name: "Starter",
    price: "Free",
    description: "For individuals and small teams getting started with threat intelligence.",
    features: ["10 scans/day", "3 intel feeds", "Basic alerts", "Community support"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    description: "For security teams that need comprehensive URL intelligence.",
    features: ["Unlimited scans", "All 24 feeds", "10 AI agents", "API access", "CSV export", "Priority support"],
    cta: "Start Pro Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For organizations requiring dedicated infrastructure and SLA.",
    features: ["Custom feeds", "Dedicated agents", "SSO/SAML", "SLA guarantee", "On-prem option", "Dedicated CSM"],
    cta: "Contact Sales",
    highlight: false,
  },
];

/* ── Lead Capture Form ───────────────────────────────────────── */
function LeadCaptureForm() {
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // In production, this would POST to an API endpoint
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "var(--surface-raised)", border: "1px solid rgba(34, 211, 238, 0.2)" }}
      >
        <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(34, 211, 238, 0.1)" }}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="var(--cyan-400)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-semibold mb-1">Report requested!</h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>We&apos;ll send your threat report to {email} shortly.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-6 space-y-4"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
    >
      <div>
        <label className="text-xs font-mono uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-tertiary)" }}>Work email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full text-sm px-3 py-2.5 rounded-lg focus:outline-none"
          style={{ background: "var(--surface-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
        />
      </div>
      <div>
        <label className="text-xs font-mono uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-tertiary)" }}>Domain to scan</label>
        <input
          type="text"
          required
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="w-full text-sm px-3 py-2.5 rounded-lg font-mono focus:outline-none"
          style={{ background: "var(--surface-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
        />
      </div>
      <button
        type="submit"
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-[1.01]"
        style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
      >
        Get Free Report
      </button>
      <p className="text-[10px] text-center" style={{ color: "var(--text-tertiary)" }}>
        No credit card required. We&apos;ll never share your data.
      </p>
    </form>
  );
}

/* ── Landing Page ────────────────────────────────────────────── */
export default function LandingPage() {
  const isLoggedIn = !!getToken();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: "var(--surface-base)", color: "var(--text-primary)" }}>
      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(10, 14, 26, 0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid var(--border-subtle)" : "1px solid transparent",
        }}
      >
        <Link to="/">
          <WordMark size={30} textSize="text-lg" />
        </Link>
        <div className="flex items-center gap-4">
          <a href="#features" className="hidden sm:inline text-sm text-[--text-secondary] hover:text-[--text-primary] transition-colors">Features</a>
          <a href="#pricing" className="hidden sm:inline text-sm text-[--text-secondary] hover:text-[--text-primary] transition-colors">Pricing</a>
          <Link to="/scanner" className="hidden sm:inline text-sm text-[--text-secondary] hover:text-[--text-primary] transition-colors">Free Scanner</Link>
          {isLoggedIn ? (
            <Link
              to="/dashboard"
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-[--text-secondary] hover:text-[--text-primary] transition-colors">Sign In</Link>
              <Link
                to="/register"
                className="text-sm font-semibold px-4 py-2 rounded-lg transition-all"
                style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Radial glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, rgba(34, 211, 238, 0.3), transparent 70%)" }} />

        <div className="relative text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-8"
            style={{ background: "rgba(34, 211, 238, 0.1)", border: "1px solid rgba(34, 211, 238, 0.2)", color: "var(--cyan-400)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            24 feeds active · 10 AI agents online
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold leading-tight mb-6">
            Trust Intelligence
            <br />
            <span style={{ color: "var(--cyan-400)" }}>for the Modern Web</span>
          </h1>

          <p className="text-lg sm:text-xl mb-10 max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            Real-time URL scanning, 24 intelligence feeds, and 10 AI agents
            protecting your digital surface around the clock.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              to="/register"
              className="px-6 py-3 rounded-lg text-base font-semibold transition-all hover:scale-105"
              style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
            >
              Start Free
            </Link>
            <a
              href="#features"
              className="px-6 py-3 rounded-lg text-base font-medium transition-all"
              style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
            >
              Learn More
            </a>
          </div>

          {/* Terminal mockup */}
          <div
            className="mt-16 mx-auto max-w-lg rounded-xl overflow-hidden text-left"
            style={{ background: "var(--surface-void)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-3 text-[10px] font-mono text-[--text-tertiary]">trust-radar-cli</span>
            </div>
            <div className="p-4 font-mono text-xs leading-relaxed">
              <div style={{ color: "var(--text-tertiary)" }}>$ trust-radar scan https://suspicious-login.example.com</div>
              <div className="mt-2" style={{ color: "var(--cyan-400)" }}>Scanning URL...</div>
              <div className="mt-1" style={{ color: "var(--text-secondary)" }}>
                ├─ Phishing detection: <span className="text-red-400">HIGH RISK</span> (0.94)
              </div>
              <div style={{ color: "var(--text-secondary)" }}>
                ├─ Brand impersonation: <span className="text-yellow-400">DETECTED</span> (PayPal)
              </div>
              <div style={{ color: "var(--text-secondary)" }}>
                ├─ SSL certificate: <span className="text-red-400">INVALID</span>
              </div>
              <div style={{ color: "var(--text-secondary)" }}>
                ├─ Domain age: <span className="text-yellow-400">2 days</span>
              </div>
              <div style={{ color: "var(--text-secondary)" }}>
                └─ Risk score: <span className="text-red-400 font-bold">92/100</span>
              </div>
              <div className="mt-2" style={{ color: "var(--cyan-400)" }}>
                → Alert created · Agent triage initiated · Takedown queued
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ticker ───────────────────────────────────────── */}
      <section className="py-8 overflow-hidden" style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex animate-scroll-x gap-16 px-8">
          {[...STATS, ...STATS].map((stat, i) => (
            <div key={i} className="flex items-center gap-3 shrink-0">
              <span className="text-2xl font-display font-bold" style={{ color: "var(--cyan-400)" }}>{stat.value}</span>
              <span className="text-sm font-mono" style={{ color: "var(--text-tertiary)" }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              Everything you need to
              <span style={{ color: "var(--cyan-400)" }}> defend your surface</span>
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              From URL scanning to autonomous AI agents, Trust Radar provides end-to-end threat intelligence.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl p-6 transition-all hover:scale-[1.02]"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: "rgba(34, 211, 238, 0.1)" }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--cyan-400)" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6" style={{ background: "var(--surface-void)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-base" style={{ color: "var(--text-secondary)" }}>Start free, scale when you need to.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className="rounded-xl p-6 flex flex-col"
                style={{
                  background: tier.highlight ? "rgba(34, 211, 238, 0.05)" : "var(--surface-raised)",
                  border: tier.highlight ? "1px solid rgba(34, 211, 238, 0.3)" : "1px solid var(--border-subtle)",
                }}
              >
                {tier.highlight && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full self-start mb-3"
                    style={{ background: "rgba(34, 211, 238, 0.15)", color: "var(--cyan-400)" }}
                  >
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-semibold mb-1">{tier.name}</h3>
                <div className="mb-3">
                  <span className="text-3xl font-display font-bold">{tier.price}</span>
                  {tier.period && <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>{tier.period}</span>}
                </div>
                <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{tier.description}</p>
                <ul className="space-y-2 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="var(--cyan-400)" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span style={{ color: "var(--text-secondary)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className="block text-center py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: tier.highlight ? "var(--cyan-400)" : "transparent",
                    color: tier.highlight ? "#0A0E1A" : "var(--text-secondary)",
                    border: tier.highlight ? "none" : "1px solid var(--border-default)",
                  }}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Animated Threat Heatmap ──────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              Global threat <span style={{ color: "var(--cyan-400)" }}>visibility</span>
            </h2>
            <p className="text-base" style={{ color: "var(--text-secondary)" }}>
              Real-time threat activity monitored across every continent.
            </p>
          </div>
          <div
            className="rounded-xl p-8 relative overflow-hidden"
            style={{ background: "var(--surface-void)", border: "1px solid var(--border-subtle)" }}
          >
            <svg viewBox="0 0 100 80" className="w-full" style={{ opacity: 0.15 }}>
              {/* Simplified continent outlines */}
              <ellipse cx="25" cy="38" rx="12" ry="18" fill="var(--text-tertiary)" />
              <ellipse cx="48" cy="32" rx="10" ry="14" fill="var(--text-tertiary)" />
              <ellipse cx="42" cy="55" rx="7" ry="10" fill="var(--text-tertiary)" />
              <ellipse cx="70" cy="40" rx="16" ry="16" fill="var(--text-tertiary)" />
              <ellipse cx="83" cy="62" rx="6" ry="5" fill="var(--text-tertiary)" />
            </svg>
            <svg viewBox="0 0 100 80" className="w-full absolute inset-0" style={{ padding: "2rem" }}>
              {HOTSPOTS.map((h, i) => (
                <g key={i}>
                  <circle cx={h.cx} cy={h.cy} r={h.r * 2.5} fill="rgba(239,68,68,0.08)" />
                  <circle cx={h.cx} cy={h.cy} r={h.r * 1.5} fill="rgba(239,68,68,0.15)" className="animate-pulse" />
                  <circle cx={h.cx} cy={h.cy} r={h.r * 0.5} fill="#EF4444" />
                </g>
              ))}
              {/* Connection lines */}
              <line x1="25" y1="35" x2="48" y2="30" stroke="rgba(34,211,238,0.15)" strokeWidth="0.3" />
              <line x1="48" y1="30" x2="75" y2="40" stroke="rgba(34,211,238,0.15)" strokeWidth="0.3" />
              <line x1="48" y1="30" x2="55" y2="32" stroke="rgba(34,211,238,0.15)" strokeWidth="0.3" />
              <line x1="75" y1="40" x2="83" y2="65" stroke="rgba(34,211,238,0.15)" strokeWidth="0.3" />
            </svg>
            <div className="flex items-center justify-center gap-6 mt-4">
              {[
                { label: "Active Hotspots", value: "10", color: "#EF4444" },
                { label: "Feeds Online", value: "24", color: "#22D3EE" },
                { label: "Agents Active", value: "10", color: "#22C55E" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: m.color }} />
                  <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                    <span className="font-bold" style={{ color: m.color }}>{m.value}</span> {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Agent Showcase ─────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: "var(--surface-void)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              10 Shield <span style={{ color: "var(--cyan-400)" }}>Guardian Agents</span>
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              Autonomous AI agents that work 24/7 to detect, correlate, and neutralize threats — with human oversight where it matters.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {AGENTS.map((agent) => (
              <div
                key={agent.name}
                className="rounded-xl p-4 transition-all hover:scale-[1.03]"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold mb-3"
                  style={{ background: `${agent.color}15`, color: agent.color }}
                >
                  {agent.name[0]}
                </div>
                <h3 className="text-sm font-bold mb-0.5">{agent.name}</h3>
                <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: agent.color }}>{agent.role}</div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{agent.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              How Shield <span style={{ color: "var(--cyan-400)" }}>works</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.label} className="text-center">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 relative"
                  style={{ background: "rgba(34, 211, 238, 0.08)", border: "1px solid rgba(34, 211, 238, 0.15)" }}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="var(--cyan-400)" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                  </svg>
                  <span
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-base font-bold mb-2">{step.label}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HITL Trust Message ──────────────────────────────────── */}
      <section className="py-16 px-6" style={{ background: "rgba(34, 211, 238, 0.03)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-6"
            style={{ background: "rgba(249, 115, 22, 0.1)", border: "1px solid rgba(249, 115, 22, 0.2)", color: "#F97316" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Human-in-the-Loop
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4">
            AI with <span style={{ color: "var(--cyan-400)" }}>human oversight</span>
          </h2>
          <p className="text-base leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
            High-impact actions — takedowns, abuse reports, escalations — always require human approval.
            Our Arbiter agent enforces approval gates so no automated action fires without your team&apos;s sign-off.
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            {[
              { n: "100%", l: "Takedowns reviewed" },
              { n: "0", l: "Uncontrolled actions" },
              { n: "<5min", l: "Avg approval time" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-xl font-display font-bold" style={{ color: "var(--cyan-400)" }}>{s.n}</div>
                <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lead Capture Form ──────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-display font-bold mb-3">
              Get a <span style={{ color: "var(--cyan-400)" }}>free threat report</span>
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Enter your domain and we&apos;ll send a comprehensive threat intelligence report to your inbox.
            </p>
          </div>
          <LeadCaptureForm />
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4">
          Ready to secure your digital surface?
        </h2>
        <p className="text-base mb-8 max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
          Join thousands of security teams using Trust Radar to detect and neutralize threats in real time.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/register"
            className="inline-block px-8 py-3 rounded-lg text-base font-semibold transition-all hover:scale-105"
            style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
          >
            Get Started — It&apos;s Free
          </Link>
          <Link
            to="/scanner"
            className="inline-block px-8 py-3 rounded-lg text-base font-medium transition-all"
            style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
          >
            Try Free Scanner
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="px-6 py-8" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <span className="font-display font-semibold text-sm">Trust Radar</span>
            <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>by LRX</span>
          </div>
          <div className="flex items-center gap-6 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <span>© 2026 LRX. All rights reserved.</span>
            <a href="https://imprsn8.com" className="hover:text-[--text-primary] transition-colors">imprsn8</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
