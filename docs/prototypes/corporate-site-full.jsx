import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
// TRUST RADAR — FULL CORPORATE SITE PROTOTYPE
// LRX Enterprises Inc.
// Pages: Home, Platform, About, Blog, Security, Pricing, Contact, Changelog
// ═══════════════════════════════════════════════════════════

const THEME_KEY = "tr-theme";

function useTheme() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) setTheme(saved);
  }, []);
  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };
  return { theme, toggle };
}

function useRouter() {
  const [page, setPage] = useState("home");
  const navigate = useCallback((p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  return { page, navigate };
}

// ── SHARED COMPONENTS ──

function Nav({ theme, toggleTheme, navigate, currentPage }) {
  const links = [
    { id: "platform", label: "Platform" },
    { id: "pricing", label: "Pricing" },
    { id: "about", label: "About" },
    { id: "blog", label: "Blog" },
    { id: "security", label: "Security" },
  ];
  return (
    <nav style={{
      position: "fixed", top: 0, width: "100%", zIndex: 1000,
      background: theme === "light" ? "rgba(250,251,252,0.88)" : "rgba(11,17,32,0.88)",
      backdropFilter: "blur(24px) saturate(180%)",
      borderBottom: `1px solid ${theme === "light" ? "#e2e8f0" : "#1e293b"}`,
      transition: "all 0.3s"
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigate("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.6rem", color: "inherit" }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="12.5" stroke="#0891b2" strokeWidth="2"/>
            <circle cx="14" cy="14" r="7" stroke="#0891b2" strokeWidth="1.2" opacity="0.4"/>
            <circle cx="14" cy="14" r="2" fill="#0891b2"/>
            <line x1="14" y1="14" x2="14" y2="3" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 14 14" to="360 14 14" dur="5s" repeatCount="indefinite"/>
            </line>
          </svg>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>Trust Radar</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.58rem", color: theme === "light" ? "#94a3b8" : "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: -2 }}>by LRX Enterprise</div>
          </div>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          {links.map(l => (
            <button key={l.id} onClick={() => navigate(l.id)} style={{
              background: currentPage === l.id ? (theme === "light" ? "rgba(8,145,178,0.08)" : "rgba(8,145,178,0.15)") : "none",
              border: "none", padding: "0.5rem 0.85rem", borderRadius: 6, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", fontWeight: 500,
              color: currentPage === l.id ? "#0891b2" : (theme === "light" ? "#475569" : "#94a3b8"),
              transition: "all 0.2s"
            }}>{l.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={toggleTheme} style={{
            width: 36, height: 36, border: `1px solid ${theme === "light" ? "#e2e8f0" : "#334155"}`,
            borderRadius: "50%", background: theme === "light" ? "#fff" : "#1e293b",
            cursor: "pointer", fontSize: "1rem", color: theme === "light" ? "#475569" : "#94a3b8",
            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s"
          }}>{theme === "light" ? "☀" : "☾"}</button>
          <button onClick={() => navigate("contact")} style={{
            background: "#0891b2", color: "#fff", border: "none", padding: "0.5rem 1.15rem",
            borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 600,
            cursor: "pointer", transition: "all 0.2s"
          }}>Free Scan</button>
        </div>
      </div>
    </nav>
  );
}

function Footer({ theme, navigate }) {
  const cols = [
    { title: "Platform", links: [["Threat Detection", "platform"], ["Email Security", "platform"], ["Social Monitoring", "platform"], ["AI Agents", "platform"], ["Free Scan", "contact"]] },
    { title: "Company", links: [["About", "about"], ["Blog", "blog"], ["Careers", "about"], ["Contact", "contact"], ["Changelog", "changelog"]] },
    { title: "Resources", links: [["Documentation", "platform"], ["API Reference", "platform"], ["Security", "security"], ["Status", "security"]] },
    { title: "Legal", links: [["Privacy Policy", "security"], ["Terms of Service", "security"], ["DPA", "security"]] },
  ];
  const border = theme === "light" ? "#e2e8f0" : "#1e293b";
  const muted = theme === "light" ? "#94a3b8" : "#64748b";
  return (
    <footer style={{ borderTop: `1px solid ${border}`, padding: "5rem 0 2.5rem", transition: "border 0.3s" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "3rem", marginBottom: "4rem" }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: "0.75rem" }}>Trust Radar</div>
            <p style={{ fontSize: "0.88rem", color: theme === "light" ? "#475569" : "#94a3b8", lineHeight: 1.7, maxWidth: 280 }}>AI-powered brand threat intelligence platform by LRX Enterprises Inc. Continuous monitoring for impersonation, phishing, and social media abuse.</p>
            <p style={{ marginTop: "1rem", fontSize: "0.82rem", color: muted }}>LRX Enterprises Inc.<br/>Canada</p>
          </div>
          {cols.map(col => (
            <div key={col.title}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "0.82rem", fontWeight: 700, marginBottom: "1rem" }}>{col.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {col.links.map(([label, target]) => (
                  <button key={label} onClick={() => navigate(target)} style={{
                    background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer",
                    fontSize: "0.85rem", color: theme === "light" ? "#475569" : "#94a3b8", fontFamily: "'DM Sans', sans-serif"
                  }}>{label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "2rem", borderTop: `1px solid ${border}`, flexWrap: "wrap", gap: "1rem" }}>
          <span style={{ fontSize: "0.78rem", color: muted }}>© 2026 LRX Enterprises Inc. All rights reserved.</span>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            {[["#f6821f", "Cloudflare"], ["#10b981", "SOC 2 (Planned)"]].map(([c, l]) => (
              <span key={l} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.68rem", color: muted, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" }}/>{l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function SectionLabel({ children }) { return <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", fontWeight: 600, color: "#0891b2", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>{children}</div>; }
function SectionTitle({ children, center }) { return <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(2rem,3.5vw,2.75rem)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.03em", marginBottom: "1rem", maxWidth: center ? 640 : undefined, textAlign: center ? "center" : undefined, margin: center ? "0 auto 1rem" : undefined }}>{children}</h2>; }
function SectionDesc({ children, center }) { return <p style={{ fontSize: "1.05rem", color: "var(--muted)", lineHeight: 1.75, maxWidth: center ? 560 : 560, marginBottom: "3.5rem", textAlign: center ? "center" : undefined, margin: center ? "0 auto 3.5rem" : undefined }}>{children}</p>; }

function Btn({ children, primary, onClick, large }) {
  return <button onClick={onClick} style={{
    display: "inline-flex", alignItems: "center", gap: "0.5rem",
    padding: large ? "0.85rem 2rem" : "0.6rem 1.4rem",
    borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
    fontSize: large ? "0.95rem" : "0.88rem", fontWeight: 600, cursor: "pointer",
    background: primary ? "#0891b2" : "transparent",
    color: primary ? "#fff" : "inherit",
    border: primary ? "none" : "1.5px solid var(--border-strong)",
    transition: "all 0.2s"
  }}>{children}</button>;
}

// ── PAGE: PLATFORM ──

function PlatformPage({ theme, navigate }) {
  const capabilities = [
    {
      color: "#0891b2", bgColor: "rgba(8,145,178,0.08)",
      icon: "🛡", title: "Threat Detection",
      desc: "Continuous scanning across phishing databases, malware feeds, certificate transparency logs, and DNS infrastructure. AI agents correlate raw signals into coherent attack narratives.",
      details: ["Multiple phishing database integrations", "Certificate Transparency log monitoring", "Lookalike domain generation (typosquat, homoglyph, TLD swap)", "30-minute scan cycle with deduplication", "Credential breach + stealer log checks", "Safe domains allowlist to minimize false positives"],
      visual: "pipeline"
    },
    {
      color: "#f97316", bgColor: "rgba(249,115,22,0.08)",
      icon: "📧", title: "Email Security Posture",
      desc: "Deep outside-in analysis of SPF, DKIM, and DMARC deployment — the email authentication controls that determine whether attackers can impersonate your domain. Graded A+ through F.",
      details: ["SPF record validation with mechanism analysis", "Multi-selector DKIM verification (12+ enterprise selectors)", "DMARC policy assessment and enforcement check", "MX provider detection with security-aware scoring", "Provider-specific scoring (Proofpoint, Mimecast, Google, Microsoft)", "Historical grade tracking and change alerts"],
      visual: "posture"
    },
    {
      color: "#10b981", bgColor: "rgba(16,185,129,0.08)",
      icon: "👥", title: "Social Brand Monitoring",
      desc: "Monitor your brand identity across Twitter/X, LinkedIn, Instagram, TikTok, GitHub, and YouTube. AI-powered impersonation detection with evidence collection for takedown requests.",
      details: ["Handle reservation status across 6+ platforms", "Impersonation signal analysis (name, age, followers, content)", "Handle permutation checking (separator, suffix, character swap)", "Executive name monitoring for C-suite impersonation", "Evidence collection and screenshot capture", "Takedown request templating"],
      visual: "social"
    },
    {
      color: "#7c3aed", bgColor: "rgba(124,58,237,0.08)",
      icon: "🤖", title: "AI Agents",
      desc: "Analyst and Observer agents don't produce alert dumps — they correlate signals across all systems and generate human-readable threat narratives with specific, actionable recommendations.",
      details: ["Analyst: threat assessment, signal correlation, narratives", "Observer: daily briefings, trend analysis, grade monitoring", "Multi-signal reasoning across email, social, domains, feeds", "Severity auto-escalation when signals compound", "Powered by the most advanced AI available", "STIX 2.1 structured export for SIEM integration"],
      visual: "agent"
    }
  ];

  const cardBg = theme === "light" ? "#ffffff" : "#111827";
  const border = theme === "light" ? "#e2e8f0" : "#1e293b";

  return (
    <div style={{ paddingTop: "8rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem" }}>
        <SectionLabel>The Platform</SectionLabel>
        <SectionTitle>Outside-in brand protection.<br/>Powered by AI agents.</SectionTitle>
        <SectionDesc>Trust Radar operates from the attacker's perspective — scanning the open internet, social platforms, DNS infrastructure, and threat feeds to build a complete picture of your brand's exposure.</SectionDesc>
      </div>

      {/* Architecture diagram */}
      <div style={{ maxWidth: 900, margin: "0 auto 5rem", padding: "0 2rem" }}>
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "2.5rem", textAlign: "center", transition: "all 0.3s" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "#0891b2", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "2rem" }}>Data Flow Architecture</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
            {["Threat Feeds", "→", "Scanner Pipeline", "→", "AI Agents", "→", "Dashboard"].map((item, i) => (
              item === "→" ?
                <span key={i} style={{ color: "#0891b2", fontSize: "1.5rem", fontWeight: 300 }}>→</span> :
                <div key={i} style={{
                  background: "rgba(8,145,178,0.08)", border: "1px solid rgba(8,145,178,0.2)",
                  borderRadius: 10, padding: "1rem 1.5rem",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.82rem", fontWeight: 600, color: "#0891b2"
                }}>{item}</div>
            ))}
          </div>
          <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {["Phishing DBs", "Malware URLs", "Threat Intel", "CT Logs", "Breach Intel", "DNS/WHOIS"].map(f => (
              <span key={f} style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", padding: "0.2rem 0.6rem",
                borderRadius: 100, background: theme === "light" ? "#f1f5f9" : "#1a2332",
                color: "var(--muted)", border: `1px solid ${border}`
              }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem" }}>
        {capabilities.map((cap, i) => (
          <div key={cap.title} style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center",
            marginBottom: "6rem", direction: i % 2 === 1 ? "rtl" : "ltr"
          }}>
            <div style={{ direction: "ltr" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.68rem", fontWeight: 600, color: cap.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>{cap.icon} {cap.title}</div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem", lineHeight: 1.3 }}>{cap.desc.split('.')[0]}.</h3>
              <p style={{ fontSize: "0.95rem", color: "var(--muted)", lineHeight: 1.8, marginBottom: "1.75rem" }}>{cap.desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {cap.details.map(d => (
                  <div key={d} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "var(--muted)" }}>
                    <span style={{ color: cap.color, fontWeight: 700, fontSize: "0.8rem", marginTop: 2 }}>✓</span>{d}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ direction: "ltr", background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "2rem", position: "relative", overflow: "hidden", transition: "all 0.3s" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: cap.color, opacity: 0.6 }}/>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: `1px solid ${border}` }}>{cap.title} — Live Preview</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.82rem", color: "var(--muted)", lineHeight: 2 }}>
                {cap.details.slice(0, 4).map((d, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: j < 2 ? "#10b981" : "#f59e0b", flexShrink: 0 }}/>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Integration section */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "4rem 2rem", textAlign: "center" }}>
        <SectionLabel>Integrations</SectionLabel>
        <SectionTitle center>Works with your existing stack.</SectionTitle>
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap", marginTop: "2rem" }}>
          {["STIX 2.1", "Splunk", "Microsoft Sentinel", "QRadar", "Webhooks", "Slack", "REST API", "Email Alerts"].map(n => (
            <div key={n} style={{
              background: cardBg, border: `1px solid ${border}`, borderRadius: 10,
              padding: "1rem 1.5rem", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.82rem",
              fontWeight: 500, color: "var(--muted)", transition: "all 0.3s"
            }}>{n}</div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "4rem 2rem 6rem" }}>
        <Btn primary large onClick={() => navigate("pricing")}>See Pricing</Btn>
        <span style={{ display: "inline-block", width: "1rem" }}/>
        <Btn large onClick={() => navigate("contact")}>Request Demo</Btn>
      </div>
    </div>
  );
}

// ── PAGE: ABOUT ──

function AboutPage({ theme }) {
  const border = theme === "light" ? "#e2e8f0" : "#1e293b";
  const cardBg = theme === "light" ? "#ffffff" : "#111827";
  const principles = [
    { title: "Outside-In First", desc: "See your brand the way attackers do. Works instantly with zero setup — scans the open internet and reports what we find. Optionally connects to your existing security platforms for deeper signal and autonomous response.", color: "#0891b2" },
    { title: "AI-Native", desc: "Intelligence, not alert dumps. AI agents built from day one with the most advanced AI available — not bolted on as a feature. They reason, correlate, and narrate, replacing the human analysts most companies can't afford.", color: "#7c3aed" },
    { title: "Radically Accessible", desc: "Enterprise-grade intelligence without enterprise pricing. Edge-native architecture on Cloudflare Workers keeps operational costs 10-50x lower than traditional platforms, and we pass those savings on.", color: "#10b981" },
  ];

  const facts = [
    { label: "Canadian-incorporated", value: "🇨🇦" },
    { label: "Built AI-native from day one", value: "AI-Native" },
    { label: "Cloudflare edge, zero cold starts", value: "Edge-First" },
    { label: "Integrated threat intel feeds", value: "6+" },
    { label: "Less than enterprise competitors", value: "10-50×" },
    { label: "SOC 2 compliance roadmap", value: "In Progress" },
  ];

  const stack = [
    ["Runtime", "Cloudflare Workers (TypeScript)"],
    ["Database", "Cloudflare D1 (SQLite at the edge)"],
    ["AI Agents", "Advanced AI engine (Analyst + Observer)"],
    ["DNS Intel", "Cloudflare DoH (SPF/DKIM/DMARC/MX)"],
    ["Threat Feeds", "Phishing, malware, breach, and CT intelligence sources"],
    ["CI/CD", "GitHub Actions, Turborepo monorepo"],
  ];

  return (
    <div style={{ paddingTop: "8rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem 6rem" }}>
        <SectionLabel>About</SectionLabel>
        <SectionTitle>Making brand threat intelligence accessible.</SectionTitle>
        <SectionDesc>LRX Enterprises Inc. is a Canadian cybersecurity company building tools that make brand protection available to every organization — not just enterprises with six-figure security budgets.</SectionDesc>

        {/* Story */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "5rem", marginBottom: "6rem", alignItems: "start" }}>
          <div>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.35rem", fontWeight: 700, marginBottom: "1rem" }}>Why We Built Trust Radar</h3>
            <p style={{ fontSize: "0.95rem", color: "var(--muted)", lineHeight: 1.85, marginBottom: "1.5rem" }}>
              The brand protection market is dominated by platforms built for Fortune 500 security operations centers — priced at $20,000 to $150,000+ per year with dedicated analyst teams as prerequisites.
            </p>
            <p style={{ fontSize: "0.95rem", color: "var(--muted)", lineHeight: 1.85, marginBottom: "1.5rem" }}>
              Meanwhile, mid-market companies, fast-growing startups, and lean organizations face the exact same threats — phishing domains, social media impersonation, email spoofing, brand abuse — with none of the tooling. They discover impersonation from customer complaints. They learn about phishing campaigns from support tickets.
            </p>
            <p style={{ fontSize: "0.95rem", color: "var(--muted)", lineHeight: 1.85 }}>
              Trust Radar closes that gap. AI agents replace the human analyst teams those companies can't afford. Edge-native architecture on Cloudflare keeps costs radically lower than traditional platforms. It works instantly with zero setup, and gets even better when connected to your existing security stack for deeper signal and autonomous response.
            </p>
          </div>
          <div>
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "1.75rem", marginBottom: "1.5rem", transition: "all 0.3s" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>Technology Stack</div>
              {stack.map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", fontWeight: 600, color: "#0891b2", width: 90, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {facts.map(f => (
                <div key={f.label} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 10, padding: "1rem", transition: "all 0.3s" }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.25rem", fontWeight: 800, color: "#0891b2" }}>{f.value}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.25rem" }}>{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Principles */}
        <SectionLabel>Our Approach</SectionLabel>
        <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.75rem", fontWeight: 700, marginBottom: "2.5rem" }}>Three principles that guide everything we build.</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem", marginBottom: "4rem" }}>
          {principles.map(p => (
            <div key={p.title} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "2rem", position: "relative", overflow: "hidden", transition: "all 0.3s" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: p.color, opacity: 0.5 }}/>
              <h4 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.75rem" }}>{p.title}</h4>
              <p style={{ fontSize: "0.92rem", color: "var(--muted)", lineHeight: 1.75 }}>{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Careers */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "3rem", textAlign: "center", transition: "all 0.3s" }}>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.35rem", fontWeight: 700, marginBottom: "0.75rem" }}>Join us.</h3>
          <p style={{ fontSize: "0.95rem", color: "var(--muted)", lineHeight: 1.75, maxWidth: 500, margin: "0 auto 1.5rem" }}>We're building the future of accessible brand threat intelligence. If you're passionate about cybersecurity, AI, and making the internet safer — we'd love to hear from you.</p>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.85rem", color: "#0891b2" }}>careers@trustradar.ca</div>
        </div>
      </div>
    </div>
  );
}

// ── PAGE: SECURITY ──

function SecurityPage({ theme }) {
  const border = theme === "light" ? "#e2e8f0" : "#1e293b";
  const cardBg = theme === "light" ? "#ffffff" : "#111827";
  const sections = [
    { title: "Security Practices", items: ["Data at rest: Encrypted in Cloudflare D1", "Data in transit: TLS 1.3 everywhere", "Authentication: JWT with bcrypt password hashing", "Outside-in monitoring works with zero integration; optional platform connections use scoped OAuth", "API keys are rotatable and scoped per permission", "Rate limiting on all public and authenticated endpoints"] },
    { title: "Infrastructure Security", items: ["Cloudflare Workers: isolated V8 execution per request", "No shared servers — no container escape surface", "DDoS protection via Cloudflare's global network", "Automatic TLS certificate management", "Zero cold-start architecture (no idle vulnerable state)", "Global edge distribution across 300+ data centers"] },
    { title: "Data Handling", items: ["Free scans: Results cached 24 hours, then deleted", "Paid monitoring: Data retained while subscription is active + 30 days after cancellation", "Threat data: Retained indefinitely for intelligence (domain/URL-level data only, no PII)", "No data sold to third parties — ever", "Data export available on request for all tiers", "Right to deletion honored within 72 hours"] },
    { title: "Third-Party Security", items: ["AI: Enterprise-grade AI provider (SOC 2 certified)", "Infrastructure: Cloudflare (SOC 2 Type II, ISO 27001, PCI DSS)", "DNS: Cloudflare DoH (encrypted DNS resolution)", "No additional third-party processors beyond core stack"] },
  ];
  const compliance = [
    { label: "SOC 2 Type I", status: "Target Q3 2026", color: "#f59e0b" },
    { label: "SOC 2 Type II", status: "Target Q1 2027", color: "#f59e0b" },
    { label: "GDPR", status: "Data processing practices in place", color: "#10b981" },
    { label: "PIPEDA", status: "Canadian privacy compliance active", color: "#10b981" },
  ];

  return (
    <div style={{ paddingTop: "8rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 2rem 6rem" }}>
        <SectionLabel>Security</SectionLabel>
        <SectionTitle>How we protect your data.</SectionTitle>
        <SectionDesc>Trust Radar is a security product. We hold ourselves to the standards we help our customers achieve.</SectionDesc>

        {sections.map(s => (
          <div key={s.title} style={{ marginBottom: "3rem" }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.2rem", fontWeight: 700, marginBottom: "1.25rem" }}>{s.title}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {s.items.map(item => (
                <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.92rem", color: "var(--muted)", lineHeight: 1.6 }}>
                  <span style={{ color: "#10b981", fontWeight: 700, marginTop: 2, flexShrink: 0 }}>✓</span>{item}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Compliance */}
        <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.2rem", fontWeight: 700, marginBottom: "1.25rem" }}>Compliance Roadmap</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "3rem" }}>
          {compliance.map(c => (
            <div key={c.label} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 10, padding: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.3s" }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: "0.95rem" }}>{c.label}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", fontWeight: 600, color: c.color, background: c.color + "15", padding: "0.2rem 0.6rem", borderRadius: 100 }}>{c.status}</span>
            </div>
          ))}
        </div>

        {/* Responsible Disclosure */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "2.5rem", transition: "all 0.3s" }}>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>Responsible Disclosure</h3>
          <p style={{ fontSize: "0.95rem", color: "var(--muted)", lineHeight: 1.8, marginBottom: "1.5rem" }}>We take security seriously. If you've discovered a vulnerability in Trust Radar, we want to hear from you.</p>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.92rem", color: "#0891b2", marginBottom: "1.5rem" }}>security@trustradar.ca</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {["Acknowledge receipt within 24 hours", "Provide initial assessment within 72 hours", "Never pursue legal action for good-faith reports", "Credit researchers with their permission", "Keep reporters informed through resolution"].map(item => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem", color: "var(--muted)" }}>
                <span style={{ color: "#0891b2", fontWeight: 700 }}>→</span>{item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PAGE: BLOG ──

function BlogPage({ theme }) {
  const border = theme === "light" ? "#e2e8f0" : "#1e293b";
  const cardBg = theme === "light" ? "#ffffff" : "#111827";
  const posts = [
    { title: "Introducing Trust Radar: AI-Powered Brand Threat Intelligence", date: "March 20, 2026", category: "Product", color: "#0891b2", excerpt: "Today we're launching Trust Radar — a brand threat intelligence platform that works instantly with zero setup and gets even better when connected to your security stack. AI agents deliver intelligence previously available only to enterprises with six-figure security budgets." },
    { title: "Why Your Email Security Posture Is Your Brand's Front Door", date: "March 18, 2026", category: "Threat Intel", color: "#f97316", excerpt: "Most brand impersonation starts with email. Yet none of the major brand protection platforms analyze your SPF, DKIM, and DMARC configuration. Here's why that's a critical gap." },
    { title: "The Pricing Problem: Why Brand Protection Shouldn't Require a Six-Figure Budget", date: "March 15, 2026", category: "Company", color: "#7c3aed", excerpt: "Incumbent brand protection platforms charge tens of thousands per year. AI agents and edge computing fundamentally change the economics. We break down why." },
    { title: "How AI-Generated Phishing Is Changing Brand Impersonation", date: "March 12, 2026", category: "Threat Intel", color: "#f97316", excerpt: "LLM-generated phishing emails are harder to detect, more personalized, and produced at scale. Traditional signature-based detection is failing. Here's what comes next." },
    { title: "Your Brand on Social Media: Who Else Is Using Your Name?", date: "March 10, 2026", category: "Threat Intel", color: "#f97316", excerpt: "Handle squatting and social media impersonation are rising. We analyzed patterns across 6 major platforms and found that 73% of mid-market companies have at least one unclaimed brand handle." },
    { title: "Building Trust Radar on Cloudflare Workers: An Architecture Decision", date: "March 8, 2026", category: "Engineering", color: "#10b981", excerpt: "Why we chose edge computing for a security platform, how it keeps costs radically lower, and the technical tradeoffs we made along the way." },
  ];

  return (
    <div style={{ paddingTop: "8rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 2rem 6rem" }}>
        <SectionLabel>Blog</SectionLabel>
        <SectionTitle>Insights from the Trust Radar team.</SectionTitle>
        <SectionDesc>Threat intelligence, product updates, and engineering deep dives from LRX Enterprise.</SectionDesc>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "3rem" }}>
          {["All", "Product", "Threat Intel", "Company", "Engineering"].map(cat => (
            <button key={cat} style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 500,
              padding: "0.4rem 1rem", borderRadius: 100, cursor: "pointer",
              background: cat === "All" ? "#0891b2" : "transparent",
              color: cat === "All" ? "#fff" : "var(--muted)",
              border: cat === "All" ? "none" : `1px solid ${border}`,
              transition: "all 0.2s"
            }}>{cat}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {posts.map(post => (
            <article key={post.title} style={{
              background: cardBg, border: `1px solid ${border}`, borderRadius: 12,
              padding: "2rem", cursor: "pointer", transition: "all 0.3s"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", fontWeight: 600, color: post.color, background: post.color + "12", padding: "0.2rem 0.6rem", borderRadius: 100, border: `1px solid ${post.color}25` }}>{post.category}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "var(--muted)" }}>{post.date}</span>
              </div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.65rem", lineHeight: 1.3 }}>{post.title}</h3>
              <p style={{ fontSize: "0.92rem", color: "var(--muted)", lineHeight: 1.7 }}>{post.excerpt}</p>
              <div style={{ marginTop: "1rem", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", fontWeight: 600, color: "#0891b2" }}>Read more →</div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PAGE: PRICING ──

function PricingPage({ theme, navigate }) {
  const border = theme === "light" ? "#e2e8f0" : "#1e293b";
  const cardBg = theme === "light" ? "#ffffff" : "#111827";
  const tiers = [
    { name: "Scan", price: "Free", period: "", desc: "One-time Brand Exposure Report.", popular: false, features: ["Brand Exposure Score", "Email security grade", "Lookalike domain check", "Social handle scan", "AI threat assessment", "Shareable report link"], cta: "Run Free Scan", action: "contact" },
    { name: "Professional", price: "$799", period: "/mo", desc: "Continuous monitoring for 1 brand.", popular: true, features: ["Everything in Scan", "24/7 continuous monitoring", "Daily AI threat briefings", "Email posture tracking", "Social monitoring (6 platforms)", "Credential exposure alerts", "Lookalike domain monitoring", "Email + in-app alerts"], cta: "Start Monitoring", action: "contact" },
    { name: "Business", price: "$1,999", period: "/mo", desc: "Full protection for up to 10 brands.", popular: false, features: ["Everything in Professional", "Up to 10 brands/domains", "CT log monitoring", "AI threat narratives", "Executive name monitoring", "STIX 2.1 export", "API access + webhooks", "Priority support"], cta: "Contact Sales", action: "contact" },
    { name: "Enterprise", price: "Custom", period: "", desc: "Multi-tenant, SSO, and dedicated support.", popular: false, features: ["Everything in Business", "Unlimited brands", "SSO (SAML / OIDC)", "Multi-tenant / MSSP", "SIEM integration", "Custom AI agent tuning", "Dedicated account team", "SLA guarantee"], cta: "Request Demo", action: "contact" },
  ];

  return (
    <div style={{ paddingTop: "8rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem 6rem" }}>
        <SectionLabel>Pricing</SectionLabel>
        <SectionTitle>Enterprise-grade intelligence.<br/>Without the enterprise price tag.</SectionTitle>
        <SectionDesc>Incumbent brand protection platforms charge $20,000–$150,000+ per year. Trust Radar delivers comparable intelligence at 1/2 to 2/3 of the cost — because AI agents scale where human analysts don't.</SectionDesc>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem" }}>
          {tiers.map(t => (
            <div key={t.name} style={{
              background: cardBg, border: `1px solid ${t.popular ? "#0891b2" : border}`,
              borderRadius: 16, padding: "2rem 1.75rem", display: "flex", flexDirection: "column",
              boxShadow: t.popular ? "0 0 40px rgba(8,145,178,0.1)" : undefined,
              position: "relative", transition: "all 0.3s"
            }}>
              {t.popular && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#0891b2", color: "#fff", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", fontWeight: 600, padding: "0.25rem 0.85rem", borderRadius: 100, letterSpacing: "0.06em" }}>MOST POPULAR</div>}
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem" }}>{t.name}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.25rem" }}>{t.price}<span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--muted)" }}>{t.period}</span></div>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1.75rem", minHeight: "2.5rem" }}>{t.desc}</div>
              <div style={{ height: 1, background: border, marginBottom: "1.5rem" }}/>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "2rem" }}>
                {t.features.map(f => (
                  <div key={f} style={{ fontSize: "0.85rem", color: "var(--muted)", display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                    <span style={{ color: "#0891b2", fontWeight: 700, fontSize: "0.85rem", marginTop: 1, flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button onClick={() => navigate(t.action)} style={{
                width: "100%", padding: "0.7rem", borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", textAlign: "center",
                background: t.popular ? "#0891b2" : "transparent",
                color: t.popular ? "#fff" : "inherit",
                border: t.popular ? "none" : `1.5px solid ${border}`,
                transition: "all 0.2s"
              }}>{t.cta}</button>
            </div>
          ))}
        </div>

        {/* Competitor comparison */}
        <div style={{ marginTop: "5rem", textAlign: "center" }}>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.35rem", fontWeight: 700, marginBottom: "1rem" }}>Priced at 1/2 to 2/3 of incumbent platforms.</h3>
          <p style={{ fontSize: "0.95rem", color: "var(--muted)", lineHeight: 1.75, maxWidth: 560, margin: "0 auto 2.5rem" }}>Established brand protection and digital risk protection platforms price between $20,000 and $150,000+ per year. Trust Radar delivers comparable intelligence at a fraction of the cost — because AI agents scale where human analyst teams don't.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
            {[["Incumbent Entry", "$20K–$30K/yr"], ["Incumbent Mid", "$30K–$60K/yr"], ["Incumbent Upper", "$60K–$150K+/yr"], ["Trust Radar", "$9.6K–$60K/yr"]].map(([name, price]) => (
              <div key={name} style={{
                background: name === "Trust Radar" ? "rgba(8,145,178,0.08)" : cardBg,
                border: `1px solid ${name === "Trust Radar" ? "#0891b2" : border}`,
                borderRadius: 10, padding: "1.25rem 1.75rem", textAlign: "center", minWidth: 160, transition: "all 0.3s"
              }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.35rem", color: name === "Trust Radar" ? "#0891b2" : undefined }}>{name}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.82rem", color: "var(--muted)" }}>{price}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PAGE: CONTACT ──

function ContactPage({ theme }) {
  const border = theme === "light" ? "#e2e8f0" : "#1e293b";
  const cardBg = theme === "light" ? "#ffffff" : "#111827";
  const inputBg = theme === "light" ? "#f8fafc" : "#0b1120";

  const inputStyle = {
    width: "100%", padding: "0.75rem 1rem", borderRadius: 8,
    border: `1px solid ${border}`, background: inputBg,
    fontFamily: "'DM Sans', sans-serif", fontSize: "0.92rem",
    color: "inherit", outline: "none", transition: "border 0.2s"
  };

  return (
    <div style={{ paddingTop: "8rem" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 2rem 6rem" }}>
        <SectionLabel>Contact</SectionLabel>
        <SectionTitle>Get in touch.</SectionTitle>
        <SectionDesc>Whether you're interested in a demo, have a security question, or want to discuss an enterprise deployment — we'd love to hear from you.</SectionDesc>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "4rem", alignItems: "start" }}>
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "2.5rem", transition: "all 0.3s" }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.15rem", fontWeight: 700, marginBottom: "2rem" }}>Send us a message</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div><label style={{ display: "block", fontSize: "0.82rem", fontWeight: 500, marginBottom: "0.4rem", color: "var(--muted)" }}>Name</label><input type="text" style={inputStyle} placeholder="Your name"/></div>
              <div><label style={{ display: "block", fontSize: "0.82rem", fontWeight: 500, marginBottom: "0.4rem", color: "var(--muted)" }}>Work Email</label><input type="email" style={inputStyle} placeholder="you@company.com"/></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div><label style={{ display: "block", fontSize: "0.82rem", fontWeight: 500, marginBottom: "0.4rem", color: "var(--muted)" }}>Company</label><input type="text" style={inputStyle} placeholder="Company name"/></div>
              <div><label style={{ display: "block", fontSize: "0.82rem", fontWeight: 500, marginBottom: "0.4rem", color: "var(--muted)" }}>Interest</label>
                <select style={{ ...inputStyle, cursor: "pointer" }}>
                  <option>Free Scan</option><option>Professional Plan</option><option>Business Plan</option><option>Enterprise</option><option>MSSP Partnership</option><option>Other</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 500, marginBottom: "0.4rem", color: "var(--muted)" }}>Message</label>
              <textarea rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="Tell us about your needs..."/>
            </div>
            <button style={{ width: "100%", padding: "0.85rem", background: "#0891b2", color: "#fff", border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: "0.92rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>Send Message</button>
          </div>

          <div>
            <div style={{ marginBottom: "2.5rem" }}>
              <h4 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, marginBottom: "1rem" }}>Contact Information</h4>
              {[["General inquiries", "hello@trustradar.ca"], ["Security issues", "security@trustradar.ca"], ["Sales", "sales@trustradar.ca"], ["Careers", "careers@trustradar.ca"]].map(([l, e]) => (
                <div key={l} style={{ marginBottom: "0.85rem" }}>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.15rem" }}>{l}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.88rem", color: "#0891b2" }}>{e}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: "2.5rem" }}>
              <h4 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, marginBottom: "0.5rem" }}>Response Time</h4>
              <p style={{ fontSize: "0.92rem", color: "var(--muted)", lineHeight: 1.7 }}>We respond to all inquiries within 1 business day. Enterprise and security inquiries are prioritized.</p>
            </div>
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: "1.5rem", transition: "all 0.3s" }}>
              <h4 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem" }}>LRX Enterprises Inc.</h4>
              <p style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.7 }}>Canadian-incorporated cybersecurity company.<br/>Building accessible brand threat intelligence.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PAGE: CHANGELOG ──

function ChangelogPage({ theme }) {
  const border = theme === "light" ? "#e2e8f0" : "#1e293b";
  const entries = [
    { date: "March 20, 2026", badge: "Feature", color: "#0891b2", title: "Social Brand Monitoring Launch", desc: "Monitor 6+ social platforms for brand impersonation, handle squatting, and unauthorized usage. AI-powered impersonation confidence scoring with evidence collection for takedown requests." },
    { date: "March 18, 2026", badge: "Feature", color: "#0891b2", title: "Free Brand Exposure Report", desc: "Instant AI-powered assessment of any domain's brand attack surface. Email security grade, lookalike domain detection, social handle scan, and threat feed check. No account required." },
    { date: "March 15, 2026", badge: "Improvement", color: "#10b981", title: "DKIM Selector Expansion", desc: "Added 9 new enterprise DKIM selectors: proofpoint, s1024, s2048, sc1, pphosted, pps, mimecast20190104, mc1. Improved scoring with partial credit for enterprise email security providers." },
    { date: "March 12, 2026", badge: "Feature", color: "#0891b2", title: "AI Threat Narratives", desc: "Analyst agent now generates human-readable threat narratives that correlate signals across email posture, domain impersonation, social monitoring, and threat feeds into coherent attack stories." },
    { date: "March 10, 2026", badge: "Fix", color: "#ef4444", title: "Scanner False Positive Reduction", desc: "Implemented safe domains allowlist and backfill for major domains (Apple, Google, Amazon, Microsoft). Significantly reduces false positive rate in the threat feed pipeline." },
    { date: "March 8, 2026", badge: "Feature", color: "#0891b2", title: "Lookalike Domain Detection", desc: "Automatic generation and monitoring of domain permutations including typosquats, homoglyphs, TLD swaps, and keyword additions. Checks registration status via Cloudflare DoH." },
    { date: "March 5, 2026", badge: "Improvement", color: "#10b981", title: "Observer Daily Briefings", desc: "Observer agent now includes email security stats, new threat detections, and trend analysis in daily intelligence briefings. Delivered via email and in-app notification." },
    { date: "March 1, 2026", badge: "Security", color: "#7c3aed", title: "Domain Migration to trustradar.ca", desc: "Completed migration from lrx-radar.com to trustradar.ca. Updated CSP headers, OAuth redirect URIs, CORS origins, and configured 301 redirects from legacy domain." },
  ];

  return (
    <div style={{ paddingTop: "8rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 2rem 6rem" }}>
        <SectionLabel>Changelog</SectionLabel>
        <SectionTitle>What's new in Trust Radar.</SectionTitle>
        <SectionDesc>Product updates, improvements, and fixes. We ship continuously.</SectionDesc>

        <div style={{ position: "relative", paddingLeft: "2rem" }}>
          <div style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 2, background: border, borderRadius: 1 }}/>
          {entries.map((e, i) => (
            <div key={i} style={{ position: "relative", marginBottom: "2.5rem" }}>
              <div style={{ position: "absolute", left: -23, top: 6, width: 12, height: 12, borderRadius: "50%", background: e.color, border: `3px solid ${theme === "light" ? "#fafbfc" : "#0b1120"}` }}/>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "var(--muted)" }}>{e.date}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", fontWeight: 600, color: e.color, background: e.color + "12", padding: "0.15rem 0.55rem", borderRadius: 100, border: `1px solid ${e.color}25` }}>{e.badge}</span>
              </div>
              <h4 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.4rem" }}>{e.title}</h4>
              <p style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.7 }}>{e.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PAGE: HOME (condensed version for navigation) ──

function HomePage({ theme, navigate }) {
  const border = theme === "light" ? "#e2e8f0" : "#1e293b";
  const cardBg = theme === "light" ? "#ffffff" : "#111827";
  return (
    <div>
      {/* Hero */}
      <section style={{ padding: "10rem 0 6rem", background: theme === "light" ? "linear-gradient(135deg, #fafbfc 0%, #f0f9ff 50%, #f0fdf4 100%)" : "linear-gradient(135deg, #0b1120 0%, #0c1a2e 50%, #0b1120 100%)", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 1rem", background: "rgba(8,145,178,0.08)", border: "1px solid rgba(8,145,178,0.2)", borderRadius: 100, fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", fontWeight: 500, color: "#0891b2", letterSpacing: "0.03em", marginBottom: "1.75rem" }}>
              <span style={{ width: 6, height: 6, background: "#0891b2", borderRadius: "50%", animation: "pulse 2s infinite" }}/> AI-Powered Brand Threat Intelligence
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(2.5rem,4.5vw,3.75rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.035em", marginBottom: "1.5rem" }}>See your brand the way <em style={{ fontStyle: "normal", color: "#0891b2" }}>attackers</em> do.</h1>
            <p style={{ fontSize: "1.12rem", color: "var(--muted)", lineHeight: 1.75, marginBottom: "2.5rem", maxWidth: 480 }}>Continuous monitoring for impersonation, phishing infrastructure, email vulnerabilities, and social media abuse — powered by AI agents that deliver intelligence, not alert noise.</p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Btn primary large onClick={() => navigate("contact")}>Scan Your Brand — Free</Btn>
              <Btn large onClick={() => navigate("platform")}>Explore Platform</Btn>
            </div>
            <div style={{ display: "flex", gap: "2rem", marginTop: "3rem" }}>
              {[["24/7", "Continuous monitoring"], ["6+", "Social platforms"], ["<5min", "Threat detection"]].map(([n, l]) => (
                <div key={l}><div style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.5rem", fontWeight: 700 }}>{n}</div><div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>{l}</div></div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="420" height="420" viewBox="0 0 500 500" fill="none" style={{ maxWidth: "100%" }}>
              <circle cx="250" cy="250" r="60" stroke={border} strokeWidth="1" fill="none"/>
              <circle cx="250" cy="250" r="120" stroke={border} strokeWidth="1" fill="none"/>
              <circle cx="250" cy="250" r="180" stroke="#0891b2" strokeWidth="1" opacity="0.2" fill="none"/>
              <circle cx="250" cy="250" r="220" stroke={border} strokeWidth="1" fill="none"/>
              <g style={{ transformOrigin: "250px 250px", animation: "spin 5s linear infinite" }}>
                <defs><linearGradient id="sg2" gradientTransform="rotate(80)"><stop offset="0%" stopColor="rgba(8,145,178,0)"/><stop offset="100%" stopColor="rgba(8,145,178,0.18)"/></linearGradient></defs>
                <path d="M250 250 L250 30 A220 220 0 0 1 405 105 Z" fill="url(#sg2)"/>
                <line x1="250" y1="250" x2="250" y2="30" stroke="#0891b2" strokeWidth="1.5" opacity="0.5"/>
              </g>
              <circle cx="310" cy="140" r="6" fill="#ef4444" opacity="0.7"><animate attributeName="opacity" values="0;0.7;0.4;0.7;0" dur="4s" repeatCount="indefinite"/></circle>
              <circle cx="165" cy="310" r="5" fill="#ef4444" opacity="0.5"><animate attributeName="opacity" values="0;0.5;0.3;0.5;0" dur="5s" begin="1s" repeatCount="indefinite"/></circle>
              <circle cx="280" cy="210" r="5" fill="#10b981" opacity="0.5"><animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite"/></circle>
            </svg>
          </div>
        </div>
      </section>

      {/* Quick platform overview */}
      <section style={{ padding: "5rem 0", background: theme === "light" ? "#f1f5f9" : "#111827", borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, transition: "all 0.3s" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem", textAlign: "center" }}>
          <SectionLabel>The Platform</SectionLabel>
          <SectionTitle center>Four layers of brand intelligence.</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", marginTop: "2.5rem" }}>
            {[
              { icon: "🛡", title: "Threat Detection", desc: "Phishing feeds, CT logs, lookalike domains", color: "#0891b2" },
              { icon: "📧", title: "Email Security", desc: "SPF, DKIM, DMARC posture grading", color: "#f97316" },
              { icon: "👥", title: "Social Monitoring", desc: "Impersonation detection across 6+ platforms", color: "#10b981" },
              { icon: "🤖", title: "AI Agents", desc: "Threat narratives, daily briefings, correlation", color: "#7c3aed" },
            ].map(c => (
              <div key={c.title} onClick={() => navigate("platform")} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "2rem", cursor: "pointer", textAlign: "left", transition: "all 0.3s", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: c.color, opacity: 0.5 }}/>
                <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>{c.icon}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.5rem" }}>{c.title}</h3>
                <p style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "5rem 0", textAlign: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem" }}>
          <SectionTitle center>Ready to see what attackers see?</SectionTitle>
          <p style={{ fontSize: "1.05rem", color: "var(--muted)", maxWidth: 500, margin: "0 auto 2rem", lineHeight: 1.75 }}>Run a free Brand Exposure Report on your domain. No account required. Results in under 30 seconds.</p>
          <Btn primary large onClick={() => navigate("contact")}>Scan Your Brand — Free</Btn>
          <span style={{ display: "inline-block", width: "1rem" }}/>
          <Btn large onClick={() => navigate("pricing")}>See Pricing</Btn>
        </div>
      </section>
    </div>
  );
}

// ── MAIN APP ──

export default function App() {
  const { theme, toggle } = useTheme();
  const { page, navigate } = useRouter();

  const colors = theme === "light"
    ? { bg: "#fafbfc", text: "#0f172a", muted: "#475569", borderStrong: "#cbd5e1" }
    : { bg: "#0b1120", text: "#f1f5f9", muted: "#94a3b8", borderStrong: "#334155" };

  const pages = {
    home: <HomePage theme={theme} navigate={navigate}/>,
    platform: <PlatformPage theme={theme} navigate={navigate}/>,
    about: <AboutPage theme={theme}/>,
    blog: <BlogPage theme={theme}/>,
    security: <SecurityPage theme={theme}/>,
    pricing: <PricingPage theme={theme} navigate={navigate}/>,
    contact: <ContactPage theme={theme}/>,
    changelog: <ChangelogPage theme={theme}/>,
  };

  return (
    <div style={{
      "--muted": colors.muted,
      "--border-strong": colors.borderStrong,
      background: colors.bg,
      color: colors.text,
      fontFamily: "'DM Sans', sans-serif",
      lineHeight: 1.65,
      minHeight: "100vh",
      transition: "background 0.4s, color 0.3s",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(8,145,178,0.4)} 50%{opacity:0.8;box-shadow:0 0 0 6px rgba(8,145,178,0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        * { margin:0; padding:0; box-sizing:border-box; }
        input:focus, select:focus, textarea:focus { border-color: #0891b2 !important; outline: none; }
        button:hover { opacity: 0.9; }
        ::selection { background: rgba(8,145,178,0.2); }
      `}</style>
      <Nav theme={theme} toggleTheme={toggle} navigate={navigate} currentPage={page}/>
      {pages[page] || pages.home}
      <Footer theme={theme} navigate={navigate}/>
    </div>
  );
}
