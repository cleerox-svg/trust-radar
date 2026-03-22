/**
 * Trust Radar — Platform Overview Page
 * Served at /platform
 */
import { wrapPage } from "./shared";

export function renderPlatformPage(): string {
  return wrapPage(
    "Platform — Trust Radar",
    "Outside-in brand threat intelligence powered by AI. Threat detection, email security, social monitoring, and AI agents.",
    `
<style>
.plat-hero { padding: 8rem 0 4rem; text-align: center; background: var(--gradient-hero); position: relative; }
.plat-hero h1 { font-family: var(--font-display); font-size: clamp(2.5rem,4vw,3.5rem); font-weight: 800; margin-bottom: 1rem; }
.plat-hero p { font-size: 1.1rem; color: var(--text-secondary); max-width: 560px; margin: 0 auto 2rem; line-height: 1.7; }

.cap-nav { position: sticky; top: 64px; z-index: 50; background: var(--bg-secondary); border-bottom: 1px solid var(--border); padding: 0.75rem 0; }
.cap-nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 2rem; display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
.cap-tab { font-family: var(--font-mono); font-size: 0.78rem; font-weight: 500; padding: 0.5rem 1.25rem; border-radius: 100px; border: 1px solid var(--border); background: transparent; color: var(--text-secondary); cursor: pointer; text-decoration: none; transition: all 0.2s; }
.cap-tab:hover, .cap-tab.active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }

.cap-section { padding: 5rem 0; }
.cap-section:nth-child(even) { background: var(--bg-tertiary); }
.cap-row { max-width: 1200px; margin: 0 auto; padding: 0 2rem; display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
.cap-row.reversed { direction: rtl; }
.cap-row.reversed > * { direction: ltr; }
.cap-text .section-label { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600; color: var(--accent); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 0.75rem; }
.cap-text h2 { font-family: var(--font-display); font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; }
.cap-text p { color: var(--text-secondary); line-height: 1.7; margin-bottom: 1.5rem; }
.cap-features { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.cap-features li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--text-secondary); }
.cap-features li::before { content: '✓'; color: var(--green); font-weight: 700; }
.callout { background: var(--accent-bg); border: 1px solid rgba(8,145,178,0.15); border-radius: var(--radius-md); padding: 1rem 1.25rem; font-size: 0.85rem; color: var(--accent); font-weight: 500; margin-top: 1rem; }

.cap-visual { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.5rem; }
.feed-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.feed-badge { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.85rem; background: var(--bg-tertiary); border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 500; }
.feed-dot { width: 8px; height: 8px; border-radius: 50%; }

.email-card { }
.email-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
.email-item:last-child { border-bottom: none; }
.email-pass { font-family: var(--font-mono); font-size: 0.75rem; color: var(--green); font-weight: 600; }
.email-fail { font-family: var(--font-mono); font-size: 0.75rem; color: var(--red); font-weight: 600; }
.email-grade { text-align: center; padding: 1rem; margin-top: 0.75rem; background: var(--bg-tertiary); border-radius: var(--radius-md); }
.email-grade-letter { font-family: var(--font-display); font-size: 2.5rem; font-weight: 800; color: var(--accent); }

.social-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
.social-item { text-align: center; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); }
.social-name { font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem; }
.social-status { font-size: 0.7rem; }
.social-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 0.25rem; vertical-align: middle; }

.agent-card { margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); }
.agent-name { font-family: var(--font-mono); font-size: 0.78rem; font-weight: 600; color: var(--accent); margin-bottom: 0.25rem; }
.agent-desc { font-size: 0.82rem; color: var(--text-secondary); }
.narrative-block { border-left: 3px solid var(--accent); padding: 1rem 1.25rem; background: var(--bg-tertiary); border-radius: 0 var(--radius-md) var(--radius-md) 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6; }
.narrative-label { font-family: var(--font-mono); font-size: 0.68rem; font-weight: 600; color: var(--accent); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem; }
.narrative-dot { width: 6px; height: 6px; background: var(--accent); border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(8,145,178,0.4); } 50% { opacity:0.8; box-shadow:0 0 0 6px rgba(8,145,178,0); } }

.arch-section { padding: 5rem 0; text-align: center; }
.arch-flow { max-width: 800px; margin: 2rem auto; display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex-wrap: wrap; }
.arch-node { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem 1.5rem; font-family: var(--font-mono); font-size: 0.82rem; font-weight: 500; }
.arch-arrow { font-size: 1.2rem; color: var(--accent); }

.int-section { padding: 5rem 0; background: var(--bg-tertiary); text-align: center; }
.int-grid { max-width: 800px; margin: 2rem auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.int-badge { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem 1rem; font-size: 0.82rem; font-weight: 600; transition: border-color 0.2s; }
.int-badge:hover { border-color: var(--accent); }

.cta-block { padding: 5rem 0; text-align: center; }
.cta-block h2 { font-family: var(--font-display); font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
.cta-block p { color: var(--text-secondary); max-width: 480px; margin: 0 auto 2rem; }
.cta-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

@media (max-width: 768px) {
  .cap-row, .cap-row.reversed { grid-template-columns: 1fr; gap: 2rem; direction: ltr; }
  .social-grid { grid-template-columns: repeat(2, 1fr); }
  .feed-grid { grid-template-columns: 1fr; }
  .int-grid { grid-template-columns: repeat(2, 1fr); }
  .arch-flow { flex-direction: column; }
}
</style>

<section class="plat-hero">
  <div class="container">
    <div class="section-label" style="text-align:center;">The Platform</div>
    <h1>Outside-in brand threat intelligence,<br>powered by AI.</h1>
    <p>Trust Radar monitors your brand's digital footprint across threat feeds, email infrastructure, social platforms, and the open web — delivering actionable intelligence through AI agents.</p>
  </div>
</section>

<div class="cap-nav">
  <div class="cap-nav-inner">
    <a href="#threat-detection" class="cap-tab active">Threat Detection</a>
    <a href="#email-security" class="cap-tab">Email Security</a>
    <a href="#social-monitoring" class="cap-tab">Social Monitoring</a>
    <a href="#ai-agents" class="cap-tab">AI Agents</a>
  </div>
</div>

<!-- Capability 1: Threat Detection -->
<section class="cap-section" id="threat-detection">
  <div class="cap-row">
    <div class="cap-text">
      <div class="section-label">Capability 01</div>
      <h2>Continuous Threat Detection</h2>
      <p>Trust Radar monitors multiple threat intelligence feeds every 30 minutes, checking for brand mentions across phishing databases, malware URL feeds, and domain intelligence sources.</p>
      <ul class="cap-features">
        <li>30-minute scanning cycles across all feeds</li>
        <li>Parallel feed processing for speed</li>
        <li>Automatic deduplication and false positive filtering</li>
        <li>Safe domains allowlist to reduce noise</li>
        <li>AI-powered threat assessment on detection</li>
      </ul>
    </div>
    <div class="cap-visual">
      <div style="font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:var(--text-tertiary);margin-bottom:1rem;text-transform:uppercase;letter-spacing:0.1em;">Connected Feeds</div>
      <div class="feed-grid">
        <div class="feed-badge"><span class="feed-dot" style="background:var(--red)"></span> Phishing DBs</div>
        <div class="feed-badge"><span class="feed-dot" style="background:var(--coral)"></span> Malware URLs</div>
        <div class="feed-badge"><span class="feed-dot" style="background:var(--amber)"></span> Threat Intel</div>
        <div class="feed-badge"><span class="feed-dot" style="background:var(--accent)"></span> CT Logs</div>
        <div class="feed-badge"><span class="feed-dot" style="background:var(--green)"></span> DNS Intel</div>
        <div class="feed-badge"><span class="feed-dot" style="background:var(--red)"></span> Breach Intel</div>
      </div>
    </div>
  </div>
</section>

<!-- Capability 2: Email Security -->
<section class="cap-section" id="email-security">
  <div class="cap-row reversed">
    <div class="cap-text">
      <div class="section-label">Capability 02</div>
      <h2>Email Security Posture Engine</h2>
      <p>Most brand protection platforms completely ignore email security. Trust Radar is different — we analyze your SPF, DKIM, DMARC, and MX configuration to identify gaps that attackers exploit.</p>
      <ul class="cap-features">
        <li>SPF record validation</li>
        <li>DKIM multi-selector verification (12+ enterprise selectors)</li>
        <li>DMARC policy assessment</li>
        <li>MX provider detection and scoring</li>
        <li>A+ through F grading methodology</li>
      </ul>
      <div class="callout">No competitor in the brand protection space does this.</div>
    </div>
    <div class="cap-visual">
      <div class="email-card">
        <div class="email-item"><span>SPF Record</span><span class="email-pass">PASS ✓</span></div>
        <div class="email-item"><span>DKIM (google)</span><span class="email-pass">PASS ✓</span></div>
        <div class="email-item"><span>DKIM (proofpoint)</span><span class="email-pass">PASS ✓</span></div>
        <div class="email-item"><span>DMARC Policy</span><span class="email-pass">reject ✓</span></div>
        <div class="email-item"><span>MX Provider</span><span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-secondary);">Google Workspace</span></div>
        <div class="email-grade">
          <div class="email-grade-letter">A</div>
          <div style="font-size:0.78rem;color:var(--text-tertiary);">Email Security Grade</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Capability 3: Social Monitoring -->
<section class="cap-section" id="social-monitoring">
  <div class="cap-row">
    <div class="cap-text">
      <div class="section-label">Capability 03</div>
      <h2>Social Brand Monitoring</h2>
      <p>Monitor six social platforms for brand impersonation, handle squatting, and unauthorized brand usage. AI-powered confidence scoring identifies the most dangerous impersonation attempts.</p>
      <ul class="cap-features">
        <li>Handle existence and availability checking</li>
        <li>Impersonation detection with confidence scoring</li>
        <li>Handle permutation generation</li>
        <li>Evidence collection for takedown requests</li>
        <li>Executive name monitoring</li>
      </ul>
    </div>
    <div class="cap-visual">
      <div style="font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:var(--text-tertiary);margin-bottom:1rem;text-transform:uppercase;letter-spacing:0.1em;">Platform Status</div>
      <div class="social-grid">
        <div class="social-item"><div class="social-name">Twitter/X</div><div class="social-status"><span class="social-dot" style="background:var(--green)"></span> Verified</div></div>
        <div class="social-item"><div class="social-name">LinkedIn</div><div class="social-status"><span class="social-dot" style="background:var(--green)"></span> Verified</div></div>
        <div class="social-item"><div class="social-name">Instagram</div><div class="social-status"><span class="social-dot" style="background:var(--amber)"></span> Unclaimed</div></div>
        <div class="social-item"><div class="social-name">TikTok</div><div class="social-status"><span class="social-dot" style="background:var(--text-tertiary)"></span> N/A</div></div>
        <div class="social-item"><div class="social-name">GitHub</div><div class="social-status"><span class="social-dot" style="background:var(--green)"></span> Verified</div></div>
        <div class="social-item"><div class="social-name">YouTube</div><div class="social-status"><span class="social-dot" style="background:var(--red)"></span> Squatted</div></div>
      </div>
    </div>
  </div>
</section>

<!-- Capability 4: AI Agents -->
<section class="cap-section" id="ai-agents">
  <div class="cap-row reversed">
    <div class="cap-text">
      <div class="section-label">Capability 04</div>
      <h2>AI-Powered Intelligence</h2>
      <p>Trust Radar's AI agents don't just detect threats — they reason about them. The Analyst correlates signals across email, domains, and social platforms to construct threat narratives that explain why a combination of findings is dangerous.</p>
      <ul class="cap-features">
        <li>Multi-signal threat correlation</li>
        <li>Natural language threat narratives</li>
        <li>Severity scoring with context</li>
        <li>Daily intelligence briefings</li>
        <li>Actionable recommendations</li>
      </ul>
    </div>
    <div class="cap-visual">
      <div class="agent-card">
        <div class="agent-name">Analyst Agent</div>
        <div class="agent-desc">Evaluates threats, correlates signals, generates assessments. Triggered on new detections.</div>
      </div>
      <div class="agent-card">
        <div class="agent-name">Observer Agent</div>
        <div class="agent-desc">Daily intelligence briefings, trend analysis, email security monitoring.</div>
      </div>
      <div class="narrative-block">
        <div class="narrative-label"><span class="narrative-dot"></span> Analyst Agent — Threat Narrative</div>
        "A phishing domain matching your brand was registered 48 hours ago with active MX records, combined with your current DKIM gap on the proofpoint selector. This creates a HIGH-severity compound risk — attackers can send spoofed emails that pass basic checks."
      </div>
    </div>
  </div>
</section>

<!-- Architecture -->
<section class="arch-section">
  <div class="container">
    <div class="section-label" style="text-align:center;">Architecture</div>
    <h2 style="font-family:var(--font-display);font-size:2rem;font-weight:700;margin-bottom:0.5rem;">How Data Flows Through Trust Radar</h2>
    <p style="color:var(--text-secondary);margin-bottom:2rem;">From ingestion to intelligence in minutes.</p>
    <div class="arch-flow">
      <div class="arch-node">Threat Feeds</div>
      <div class="arch-arrow">→</div>
      <div class="arch-node">Scanners</div>
      <div class="arch-arrow">→</div>
      <div class="arch-node">AI Agents</div>
      <div class="arch-arrow">→</div>
      <div class="arch-node">Dashboard</div>
    </div>
  </div>
</section>

<!-- Integrations -->
<section class="int-section">
  <div class="container">
    <div class="section-label" style="text-align:center;">Integrations</div>
    <h2 style="font-family:var(--font-display);font-size:2rem;font-weight:700;margin-bottom:0.5rem;">Works With Your Existing Stack</h2>
    <p style="color:var(--text-secondary);margin-bottom:2rem;">Export data and receive alerts in the tools you already use.</p>
    <div class="int-grid">
      <div class="int-badge">Splunk</div>
      <div class="int-badge">QRadar</div>
      <div class="int-badge">Sentinel</div>
      <div class="int-badge">STIX/TAXII</div>
      <div class="int-badge">Webhooks</div>
      <div class="int-badge">Slack</div>
      <div class="int-badge">Email</div>
      <div class="int-badge">REST API</div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-block">
  <div class="container">
    <h2>Ready to see your brand exposure?</h2>
    <p>Start with a free scan or explore our pricing plans.</p>
    <div class="cta-actions">
      <a href="/scan" class="btn btn-primary btn-lg">Scan Your Brand — Free</a>
      <a href="/pricing" class="btn btn-outline btn-lg">See Pricing</a>
    </div>
  </div>
</section>
`
  );
}
