import { generateSpiderTraps } from "../seeders/spider-injector";
import { wrapPage } from "./shared";

export function renderHomepage(): string {
  const spiderTraps = generateSpiderTraps("averrow.com", "scan");

  const pageStyles = `
<style>
/* ═══════════════════════════════════════════════════════════
   HOMEPAGE — Phase 2A
   ═══════════════════════════════════════════════════════════ */

/* ── HERO ── */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 120px 2rem 80px;
  position: relative;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 30%, rgba(200, 60, 60, 0.04) 0%, transparent 70%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  z-index: 2;
  max-width: 720px;
}

.hero-tag {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3em;
  color: var(--accent);
  margin-bottom: 16px;
  text-transform: uppercase;
}

.hero-h1 {
  font-family: var(--font-display);
  font-size: 48px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.03em;
  margin-bottom: 20px;
  color: var(--text-primary);
}

.hero-p {
  font-size: 18px;
  color: var(--text-secondary);
  line-height: 1.65;
  max-width: 580px;
  margin: 0 auto 36px;
}

/* ── SCAN INPUT ── */
.scan-box {
  display: flex;
  gap: 0;
  max-width: 520px;
  margin: 0 auto;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border-strong);
  background: var(--bg-secondary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.scan-box:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 30px rgba(200, 60, 60, 0.1);
}

.scan-input {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 14px;
  padding: 14px 18px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  outline: none;
  letter-spacing: 0.02em;
}

.scan-input::placeholder {
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.scan-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 14px 28px;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  position: relative;
  overflow: hidden;
}

.scan-btn::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
  transition: none;
}

.scan-btn:hover::after {
  animation: shimmer 0.6s forwards;
}

@keyframes shimmer {
  to { left: 120%; }
}

.scan-btn:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 20px rgba(200, 60, 60, 0.35);
}

.scan-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scan-hint {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 12px;
  letter-spacing: 0.04em;
}

/* ── RESULTS ── */
#results-section {
  display: none;
  padding: 5rem 2rem;
  text-align: center;
}

#results-section.visible {
  display: block;
}

.result-card {
  max-width: 600px;
  margin: 0 auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 36px;
  position: relative;
}

.result-domain {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.score-ring {
  width: 140px;
  height: 140px;
  margin: 0 auto 16px;
  position: relative;
}

.score-ring svg {
  width: 140px;
  height: 140px;
}

.score-val {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 42px;
}

.score-grade {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 8px;
}

.score-summary {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 400px;
  margin: 0 auto 20px;
}

.risk-pills {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.risk-p {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.risk-p.bad {
  background: rgba(200, 60, 60, 0.1);
  color: var(--accent);
}

.risk-p.warn {
  background: rgba(232, 146, 60, 0.1);
  color: var(--amber);
}

.risk-p.ok {
  background: rgba(40, 160, 80, 0.1);
  color: var(--green);
}

.gate-divider {
  border-top: 1px solid var(--border);
  margin: 24px 0;
  padding-top: 20px;
}

.gate-title {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 4px;
}

.gate-sub {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-bottom: 16px;
}

.gate-form {
  display: flex;
  gap: 8px;
  max-width: 400px;
  margin: 0 auto;
}

.gate-input {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.gate-input:focus {
  border-color: var(--accent);
}

.gate-input::placeholder {
  color: var(--text-tertiary);
}

.gate-btn {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.gate-btn:hover {
  background: var(--accent-hover);
}

.gate-note {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-tertiary);
  margin-top: 8px;
}

.gate-error {
  color: var(--accent);
}

/* ── SCANNING ANIMATION ── */
.scanning {
  text-align: center;
  padding: 60px;
}

.scan-ring-anim {
  width: 100px;
  height: 100px;
  margin: 0 auto 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.scan-label {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.scan-detail {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

/* ── AGENT SQUADRON ── */
.squadron {
  padding: 5rem 2rem;
  max-width: 960px;
  margin: 0 auto;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--accent);
  text-transform: uppercase;
  margin-bottom: 10px;
}

.squadron-title {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.squadron-subtitle {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 40px;
  line-height: 1.5;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 720px) {
  .agent-grid {
    grid-template-columns: 1fr;
  }
}

.agent-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 20px 20px 20px 24px;
  border-left: 3px solid var(--agent-color, var(--border));
  transition: transform 0.2s, box-shadow 0.2s;
}

.agent-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
}

.agent-name {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.agent-role {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.agent-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* ── HOW IT WORKS ── */
.how-it-works {
  padding: 5rem 2rem;
  max-width: 960px;
  margin: 0 auto;
}

.steps-row {
  display: flex;
  align-items: flex-start;
  gap: 0;
  margin-top: 40px;
}

@media (max-width: 720px) {
  .steps-row {
    flex-direction: column;
    gap: 32px;
  }
  .step-arrow {
    display: none;
  }
}

.step {
  flex: 1;
  text-align: center;
}

.step-num {
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
  margin-bottom: 10px;
}

.step-title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.step-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  max-width: 220px;
  margin: 0 auto;
}

.step-arrow {
  display: flex;
  align-items: center;
  padding-top: 12px;
  color: var(--text-tertiary);
  font-size: 24px;
  flex-shrink: 0;
  width: 40px;
  justify-content: center;
}
</style>`;

  const content = `
${pageStyles}

<!-- HERO -->
<section class="hero">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <div class="hero-tag">Threat Interceptor</div>
    <h1 class="hero-h1">Canada's most advanced interceptor.<br>Designed for AI&#8209;powered threats.</h1>
    <p class="hero-p">Averrow defends your digital airspace — detecting phishing kits, lookalike domains, and brand impersonation before they reach their target.</p>
    <form class="scan-box" id="scanForm" action="/assess" method="POST">
      <input class="scan-input" id="domainInput" name="domain" placeholder="Enter any domain" autocomplete="off">
      <button class="scan-btn" type="submit" id="scanBtn">Launch Sortie</button>
    </form>
    <div class="scan-hint">Enter any domain &mdash; no signup required</div>
  </div>
</section>

<hr class="tr-divider-animated">

<!-- AGENT SQUADRON -->
<section class="squadron">
  <div class="section-label">Agent Squadron</div>
  <h2 class="squadron-title">Six AI agents. One mission.</h2>
  <p class="squadron-subtitle">Continuous autonomous defense across every threat vector — scanning, classifying, and intercepting around the clock.</p>
  <div class="agent-grid">
    <div class="agent-card" style="--agent-color: #C83C3C;">
      <div class="agent-name">Sentinel</div>
      <div class="agent-role">Threat Detection</div>
      <div class="agent-desc">Continuous radar sweep across all feeds</div>
    </div>
    <div class="agent-card" style="--agent-color: #E8923C;">
      <div class="agent-name">ASTRA</div>
      <div class="agent-role">Fire Control</div>
      <div class="agent-desc">Classifies, scores, and prioritizes threat severity</div>
    </div>
    <div class="agent-card" style="--agent-color: #78A0C8;">
      <div class="agent-name">Observer</div>
      <div class="agent-role">Strategic Intel</div>
      <div class="agent-desc">Daily briefings and macro trend analysis</div>
    </div>
    <div class="agent-card" style="--agent-color: #5A80A8;">
      <div class="agent-name">Navigator</div>
      <div class="agent-role">Geo Mapping</div>
      <div class="agent-desc">Plots threat origins and infrastructure</div>
    </div>
    <div class="agent-card" style="--agent-color: #8A8F9C;">
      <div class="agent-name">Blackbox</div>
      <div class="agent-role">Flight Recorder</div>
      <div class="agent-desc">Captures threat timelines and narratives</div>
    </div>
    <div class="agent-card" style="--agent-color: #28A050;">
      <div class="agent-name">Pathfinder</div>
      <div class="agent-role">Target Acquisition</div>
      <div class="agent-desc">Identifies prospects and generates outreach</div>
    </div>
  </div>
</section>

<hr class="tr-divider-animated">

<!-- HOW IT WORKS -->
<section class="how-it-works">
  <div class="section-label">How It Works</div>
  <div class="steps-row">
    <div class="step">
      <div class="step-num">01</div>
      <div class="step-title">Enter a domain</div>
      <div class="step-desc">Launch a sortie against any domain — no signup required.</div>
    </div>
    <div class="step-arrow">&#x2192;</div>
    <div class="step">
      <div class="step-num">02</div>
      <div class="step-title">Agents deploy</div>
      <div class="step-desc">Six AI agents scan threat feeds, CT logs, DMARC records, and newly registered domains.</div>
    </div>
    <div class="step-arrow">&#x2192;</div>
    <div class="step">
      <div class="step-num">03</div>
      <div class="step-title">Threats intercepted</div>
      <div class="step-desc">Contacts classified, graded by severity, and queued for takedown.</div>
    </div>
  </div>
</section>

<hr class="tr-divider-animated">

<!-- CAPABILITIES SECTION — Phase 2C -->

<!-- CTA SECTION — Phase 2C -->

<!-- RESULTS (hidden until scan) -->
<section id="results-section">
  <div id="results-content"></div>
</section>

<script>
function scoreColor(s) {
  if (s >= 80) return 'var(--green)';
  if (s >= 60) return 'var(--blue)';
  if (s >= 40) return 'var(--amber)';
  return 'var(--accent)';
}

function gradeFor(s) {
  if (s >= 90) return 'A';
  if (s >= 80) return 'B';
  if (s >= 60) return 'C';
  if (s >= 40) return 'D';
  return 'F';
}

function summaryFor(s, d) {
  if (s >= 80) return d + ' has strong security posture. Email authentication is well-configured and we found minimal threat activity targeting this domain.';
  if (s >= 60) return d + ' has moderate security. Some areas need attention — particularly email authentication and active monitoring for impersonation threats.';
  if (s >= 40) return d + ' has concerning security gaps. We detected active threats and missing security configurations that leave the brand exposed.';
  return d + ' has critical security vulnerabilities. Multiple active threats detected, missing essential email authentication, and significant impersonation risk.';
}

var FREEMAIL_DOMAINS = ['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','mail.com','protonmail.com','proton.me','yandex.com','zoho.com','gmx.com','fastmail.com','tutanota.com','hey.com','live.com','msn.com','me.com','qq.com','163.com'];

document.getElementById('scanForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var domain = document.getElementById('domainInput').value.trim().toLowerCase();
  domain = domain.replace(/^https?:\\/\\//, '').split('/')[0];
  if (!domain || !domain.includes('.')) return;

  var btn = document.getElementById('scanBtn');
  btn.disabled = true;
  btn.textContent = 'SCANNING...';

  var rs = document.getElementById('results-section');
  rs.classList.add('visible');
  rs.scrollIntoView({ behavior: 'smooth' });

  rs.querySelector('#results-content').innerHTML =
    '<div class="scanning"><div class="scan-ring-anim"></div><div class="scan-label">Scanning ' + domain + '</div><div class="scan-detail" id="scan-step">Resolving DNS records...</div></div>';

  var steps = ['Resolving DNS records...','Checking email authentication (SPF/DKIM/DMARC)...','Validating SSL/TLS certificates...','Scanning for active threats...','Checking impersonation domains...','Analyzing hosting infrastructure...','Calculating defense grade...'];
  var si = 0;
  var stepInterval = setInterval(function() {
    si++;
    if (si < steps.length) {
      var el = document.getElementById('scan-step');
      if (el) el.textContent = steps[si];
    }
  }, 600);

  fetch('/api/brand-scan/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: domain })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    clearInterval(stepInterval);
    btn.disabled = false;
    btn.textContent = 'LAUNCH SORTIE';

    if (!data.success) {
      rs.querySelector('#results-content').innerHTML =
        '<div class="result-card"><div class="result-domain">' + domain + '</div><p style="color:var(--accent)">Scan failed: ' + (data.error || 'Unknown error') + '</p></div>';
      return;
    }

    var d = data.data;
    var score = d.trustScore;
    var sc = scoreColor(score);
    var grade = gradeFor(score);

    var risks = [];
    if (d.riskLevel === 'critical' || d.riskLevel === 'high') risks.push({ text: 'Risk: ' + d.riskLevel.toUpperCase(), cls: 'bad' });
    else if (d.riskLevel === 'medium') risks.push({ text: 'Risk: MEDIUM', cls: 'warn' });
    else risks.push({ text: 'Risk: LOW', cls: 'ok' });

    if (d.feedMentions) risks.push({ text: 'Active threats detected', cls: 'bad' });
    else risks.push({ text: 'No active threats', cls: 'ok' });

    if (d.lookalikesPossible > 50) risks.push({ text: d.lookalikesPossible + ' lookalike domains possible', cls: 'warn' });

    rs.querySelector('#results-content').innerHTML =
      '<div class="result-card">' +
        '<div class="result-domain">' + domain + '</div>' +
        '<div class="score-ring">' +
          '<svg viewBox="0 0 140 140">' +
            '<circle cx="70" cy="70" r="60" fill="none" stroke="var(--bg-tertiary)" stroke-width="6"/>' +
            '<circle cx="70" cy="70" r="60" fill="none" stroke="' + sc + '" stroke-width="6" stroke-dasharray="377" stroke-dashoffset="' + (377 * (1 - score / 100)) + '" stroke-linecap="round" transform="rotate(-90 70 70)" style="transition:stroke-dashoffset 1.5s ease"/>' +
          '</svg>' +
          '<div class="score-val" style="color:' + sc + '">' + score + '</div>' +
        '</div>' +
        '<div class="score-grade" style="color:' + sc + '">Defense Grade: ' + grade + '</div>' +
        '<div class="score-summary">' + summaryFor(score, domain) + '</div>' +
        '<div class="risk-pills">' + risks.map(function(r) { return '<span class="risk-p ' + r.cls + '">' + r.text + '</span>'; }).join('') + '</div>' +
        '<div class="gate-divider">' +
          '<div class="gate-title">Get the Full Intercept Report</div>' +
          '<div class="gate-sub">Detailed assessment with threat actor analysis, infrastructure mapping, and specific remediation steps.</div>' +
          '<form class="gate-form" id="gateForm">' +
            '<input class="gate-input" id="emailInput" name="email" placeholder="Business email address" type="email" required>' +
            '<button class="gate-btn" type="submit" id="gateBtn">Get Report</button>' +
          '</form>' +
          '<div class="gate-note" id="gateNote">Business email required &middot; Free &middot; No credit card</div>' +
        '</div>' +
      '</div>';

    document.getElementById('gateForm').addEventListener('submit', function(ev) {
      ev.preventDefault();
      var email = document.getElementById('emailInput').value.trim();
      var emailDomain = (email.split('@')[1] || '').toLowerCase();
      if (!email || !email.includes('@')) return;
      if (FREEMAIL_DOMAINS.indexOf(emailDomain) !== -1) {
        document.getElementById('emailInput').style.borderColor = 'var(--accent)';
        var note = document.getElementById('gateNote');
        note.textContent = 'Please use a business email address (no free email providers)';
        note.className = 'gate-note gate-error';
        return;
      }
      var gbtn = document.getElementById('gateBtn');
      gbtn.textContent = 'Sending...';
      gbtn.disabled = true;
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, name: email.split('@')[0], domain: domain, company: emailDomain })
      })
      .then(function() {
        gbtn.textContent = '\\u2713 Sent!';
        gbtn.style.background = 'var(--green)';
        var note = document.getElementById('gateNote');
        note.textContent = 'Check your inbox. Full intercept report delivered within 2 minutes.';
        note.style.color = 'var(--green)';
        note.className = 'gate-note';
      })
      .catch(function() {
        gbtn.textContent = 'Get Report';
        gbtn.disabled = false;
      });
    });
  })
  .catch(function() {
    clearInterval(stepInterval);
    btn.disabled = false;
    btn.textContent = 'LAUNCH SORTIE';
    rs.querySelector('#results-content').innerHTML =
      '<div class="result-card"><p style="color:var(--accent)">Scan failed. Please check the domain and try again.</p></div>';
  });
});

document.getElementById('domainInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('scanForm').dispatchEvent(new Event('submit'));
  }
});
</script>
${spiderTraps}`;

  return wrapPage(
    "Averrow — AI-Powered Brand Threat Interceptor",
    "Averrow defends your digital airspace. Detect phishing, lookalike domains, and brand impersonation before they reach their target. Free domain scan — no signup required.",
    content
  );
}

// ─── Assessment Results Page (server-rendered) ──────────────────

export function renderAssessResults(scanId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trust Score Results — Trust Radar</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg-void:#040810;--bg-surface:#0a1020;--bg-panel:#0d1528;--bg-elevated:#111d35;--blue-primary:#00d4ff;--blue-muted:#0091b3;--blue-glow:rgba(0,212,255,.08);--blue-border:rgba(0,212,255,.15);--blue-border-bright:rgba(0,212,255,.35);--threat-critical:#ff3b5c;--threat-high:#ff6b35;--threat-medium:#ffb627;--positive:#00e5a0;--positive-muted:rgba(0,229,160,.12);--negative:#ff3b5c;--purple:#b388ff;--text-primary:#e8edf5;--text-secondary:#7a8ba8;--text-tertiary:#4a5a73;--text-accent:#00d4ff;--font-display:'Chakra Petch',sans-serif;--font-body:'Outfit',sans-serif;--font-mono:'IBM Plex Mono',monospace;--radius:6px;--radius-lg:10px}
*{margin:0;padding:0;box-sizing:border-box}html{background:var(--bg-void);color:var(--text-primary);font-family:var(--font-body)}
.pub-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 40px;background:rgba(4,8,16,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--blue-border)}
.pub-logo{font-family:var(--font-display);font-weight:700;font-size:18px;letter-spacing:2px;text-transform:uppercase;display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--text-primary)}
.pub-logo span{color:var(--blue-primary)}
.logo-dot{width:24px;height:24px;border-radius:50%;border:2px solid var(--blue-primary);display:flex;align-items:center;justify-content:center}.logo-dot::after{content:'';width:6px;height:6px;border-radius:50%;background:var(--blue-primary)}
.login-btn{font-family:var(--font-display);font-size:11px;font-weight:600;padding:7px 18px;border-radius:var(--radius);border:1px solid var(--blue-border-bright);background:var(--bg-panel);color:var(--blue-primary);cursor:pointer;text-decoration:none;transition:all .15s}.login-btn:hover{background:var(--bg-elevated)}
.results-page{max-width:640px;margin:0 auto;padding:100px 24px 60px;text-align:center}
.loading{font-family:var(--font-mono);font-size:13px;color:var(--text-secondary);padding:60px 0}
.result-card{background:var(--bg-surface);border:1px solid var(--blue-border);border-radius:var(--radius-lg);padding:36px;margin-bottom:24px}
.result-domain{font-family:var(--font-mono);font-size:16px;color:var(--text-secondary);margin-bottom:20px}
.score-ring{width:160px;height:160px;margin:0 auto 16px;position:relative}
.score-ring svg{width:160px;height:160px}
.score-val{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:var(--font-display);font-weight:700;font-size:48px}
.score-grade{font-family:var(--font-display);font-size:22px;font-weight:700;margin-bottom:10px}
.score-summary{font-size:14px;color:var(--text-secondary);line-height:1.6;max-width:450px;margin:0 auto 24px}
.risk-pills{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
.risk-p{font-family:var(--font-mono);font-size:10px;padding:5px 12px;border-radius:4px}
.risk-p.bad{background:rgba(255,59,92,.1);color:var(--negative)}.risk-p.warn{background:rgba(255,182,39,.1);color:var(--threat-medium)}.risk-p.ok{background:var(--positive-muted);color:var(--positive)}
.gate-divider{border-top:1px solid var(--blue-border);margin:24px 0;padding-top:20px}
.gate-title{font-family:var(--font-display);font-size:14px;font-weight:700;margin-bottom:4px}
.gate-sub{font-size:11px;color:var(--text-tertiary);margin-bottom:16px}
.gate-form{display:flex;gap:8px;max-width:400px;margin:0 auto}
.gate-input{flex:1;font-family:var(--font-body);font-size:13px;padding:10px 14px;border-radius:var(--radius);border:1px solid var(--blue-border);background:var(--bg-panel);color:var(--text-primary);outline:none}
.gate-input:focus{border-color:var(--blue-border-bright)}
.gate-input::placeholder{color:var(--text-tertiary)}
.gate-btn{font-family:var(--font-display);font-size:11px;font-weight:600;padding:10px 20px;border-radius:var(--radius);border:none;background:var(--blue-primary);color:var(--bg-void);cursor:pointer;white-space:nowrap}
.gate-note{font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary);margin-top:8px}
.gate-error{color:var(--negative)}
.back-link{display:inline-block;font-family:var(--font-display);font-size:12px;color:var(--blue-primary);text-decoration:none;margin-top:16px;padding:8px 16px;border:1px solid var(--blue-border);border-radius:var(--radius)}.back-link:hover{background:var(--bg-panel)}
</style>
</head>
<body>
<nav class="pub-nav">
  <a href="/" class="pub-logo"><div class="logo-dot"></div>TRUST <span>RADAR</span></a>
  <a class="login-btn" href="/login">Sign In</a>
</nav>
<div class="results-page">
  <div class="loading" id="loading">Loading assessment results...</div>
  <div id="results"></div>
</div>
<script>
var FREEMAIL_DOMAINS=['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','mail.com','protonmail.com','proton.me','yandex.com','zoho.com','gmx.com','fastmail.com','tutanota.com','hey.com','live.com','msn.com','me.com','qq.com','163.com'];
function scoreColor(s){return s>=80?'var(--positive)':s>=60?'var(--blue-primary)':s>=40?'var(--threat-medium)':s>=25?'var(--threat-high)':'var(--negative)'}
function gradeFor(s){return s>=90?'A':s>=80?'B':s>=60?'C':s>=40?'D':'F'}
function summaryFor(s,d){
  if(s>=80)return d+' has strong security posture. Email authentication is well-configured and we found minimal threat activity.';
  if(s>=60)return d+' has moderate security. Some areas need attention — particularly email authentication and active monitoring for impersonation threats.';
  if(s>=40)return d+' has concerning security gaps. We detected active threats and missing security configurations that leave the brand exposed.';
  return d+' has critical security vulnerabilities. Multiple active threats detected, missing essential email authentication, and significant impersonation risk.';
}

var scanId=${JSON.stringify(scanId)};
fetch('/api/brand-scan/public/'+encodeURIComponent(scanId))
.then(function(r){return r.json()})
.then(function(data){
  document.getElementById('loading').style.display='none';
  if(!data.success){
    document.getElementById('results').innerHTML='<div class="result-card"><p style="color:var(--negative)">'+( data.error||'Assessment not found')+'</p></div><a href="/" class="back-link">\\u2190 Scan another domain</a>';
    return;
  }
  var d=data.data;
  var score=d.trust_score||d.trustScore||50;
  var domain=d.domain||'Unknown';
  var sc=scoreColor(score);
  var grade=gradeFor(score);
  var riskLevel=d.risk_level||d.riskLevel||'medium';

  var risks=[];
  if(riskLevel==='critical'||riskLevel==='high') risks.push({text:'Risk: '+riskLevel.toUpperCase(),cls:'bad'});
  else if(riskLevel==='medium') risks.push({text:'Risk: MEDIUM',cls:'warn'});
  else risks.push({text:'Risk: LOW',cls:'ok'});

  if(d.spf_policy==='hardfail') risks.push({text:'SPF: Enforced',cls:'ok'});
  else if(d.spf_policy) risks.push({text:'SPF: '+d.spf_policy,cls:'warn'});
  else risks.push({text:'SPF: Missing',cls:'bad'});

  if(d.dmarc_policy==='reject') risks.push({text:'DMARC: Enforced',cls:'ok'});
  else if(d.dmarc_policy) risks.push({text:'DMARC: '+d.dmarc_policy,cls:'warn'});
  else risks.push({text:'DMARC: Missing',cls:'bad'});

  if(d.feed_mentions>0) risks.push({text:'Active threats: '+d.feed_mentions,cls:'bad'});
  else risks.push({text:'No active threats',cls:'ok'});

  document.getElementById('results').innerHTML=
    '<div class="result-card">'+
      '<div class="result-domain">'+domain+'</div>'+
      '<div class="score-ring"><svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="68" fill="none" stroke="var(--bg-elevated)" stroke-width="6"/><circle cx="80" cy="80" r="68" fill="none" stroke="'+sc+'" stroke-width="6" stroke-dasharray="427" stroke-dashoffset="'+(427*(1-score/100))+'" stroke-linecap="round" transform="rotate(-90 80 80)" style="transition:stroke-dashoffset 1.5s ease"/></svg><div class="score-val" style="color:'+sc+'">'+score+'</div></div>'+
      '<div class="score-grade" style="color:'+sc+'">Grade: '+grade+'</div>'+
      '<div class="score-summary">'+summaryFor(score,domain)+'</div>'+
      '<div class="risk-pills">'+risks.map(function(r){return '<span class="risk-p '+r.cls+'">'+r.text+'</span>'}).join('')+'</div>'+
      '<div class="gate-divider"><div class="gate-title">Get the Full Report</div><div class="gate-sub">Detailed assessment with threat actor analysis, infrastructure mapping, and remediation steps.</div>'+
        '<form class="gate-form" id="gateForm"><input class="gate-input" id="emailInput" placeholder="Business email address" type="email" required><button class="gate-btn" type="submit" id="gateBtn">Get Report</button></form>'+
        '<div class="gate-note" id="gateNote">Business email required &middot; Free &middot; No credit card</div>'+
      '</div>'+
    '</div>'+
    '<a href="/" class="back-link">\\u2190 Scan another domain</a>';

  document.getElementById('gateForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var email=document.getElementById('emailInput').value.trim();
    var emailDomain=(email.split('@')[1]||'').toLowerCase();
    if(!email||!email.includes('@'))return;
    if(FREEMAIL_DOMAINS.indexOf(emailDomain)!==-1){
      document.getElementById('emailInput').style.borderColor='var(--negative)';
      var note=document.getElementById('gateNote');
      note.textContent='Please use a business email address (no free email providers)';
      note.className='gate-note gate-error';
      return;
    }
    var gbtn=document.getElementById('gateBtn');
    gbtn.textContent='Sending...';gbtn.disabled=true;
    fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,name:email.split('@')[0],domain:domain,company:emailDomain})})
    .then(function(){gbtn.textContent='\\u2713 Sent!';gbtn.style.background='var(--positive)';var n=document.getElementById('gateNote');n.textContent='Check your inbox. Full report delivered within 2 minutes.';n.style.color='var(--positive)';n.className='gate-note';})
    .catch(function(){gbtn.textContent='Get Report';gbtn.disabled=false;});
  });
})
.catch(function(){
  document.getElementById('loading').style.display='none';
  document.getElementById('results').innerHTML='<div class="result-card"><p style="color:var(--negative)">Failed to load assessment results.</p></div><a href="/" class="back-link">\\u2190 Scan another domain</a>';
});
</script>
</body>
</html>`;
}
