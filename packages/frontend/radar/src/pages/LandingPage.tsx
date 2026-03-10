import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken } from "../lib/api";
import { WordMark } from "../components/LogoMark";

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

/* ── Landing Page ────────────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (getToken()) navigate("/dashboard", { replace: true });
  }, [navigate]);

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
          <Link to="/login" className="text-sm text-[--text-secondary] hover:text-[--text-primary] transition-colors">Sign In</Link>
          <Link
            to="/register"
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-all"
            style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
          >
            Get Started
          </Link>
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

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4">
          Ready to secure your digital surface?
        </h2>
        <p className="text-base mb-8 max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
          Join thousands of security teams using Trust Radar to detect and neutralize threats in real time.
        </p>
        <Link
          to="/register"
          className="inline-block px-8 py-3 rounded-lg text-base font-semibold transition-all hover:scale-105"
          style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
        >
          Get Started — It's Free
        </Link>
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
