import { HEATMAP_CSS, HEATMAP_HTML, HEATMAP_SCRIPTS } from "./heatmap-component";

export function renderHomepage(): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Trust Radar — Know Before You Click</title>
  <meta name="description" content="Real-time trust scoring for URLs, domains, and digital identities. Powered by AI. No account required to try."/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  ${HEATMAP_CSS}
  <style>
    :root {
      --cyan:     #00F5FF;
      --amber:    #F59E0B;
      --red:      #EF4444;
      --green:    #22C55E;
      --navy:     #0A0E1A;
      --surface:  #0F1628;
      --surface2: #1A2340;
      --border:   rgba(0,245,255,0.12);
      --text:     #E2E8F0;
      --subtext:  #64748B;
    }
    [data-theme="light"] {
      --navy:     #F0F4F8;
      --surface:  #FFFFFF;
      --surface2: #E2E8F0;
      --border:   rgba(15,30,80,0.12);
      --text:     #0F1628;
      --subtext:  #475569;
      --cyan:     #0066CC;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: var(--navy); color: var(--text); font-family: 'Inter', sans-serif; min-height: 100vh; }

    /* ── NAV ── */
    nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 32px; height: 60px;
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
      background: var(--navy);
      backdrop-filter: blur(12px);
    }
    .nav-logo {
      font-family: 'JetBrains Mono', monospace;
      font-size: 17px; font-weight: 700; color: var(--text);
      text-decoration: none;
    }
    .nav-logo span { color: var(--cyan); }
    .nav-actions { display: flex; gap: 10px; align-items: center; }
    .btn-ghost {
      padding: 7px 14px; border-radius: 6px;
      border: 1px solid var(--border); background: transparent; color: var(--text);
      font-family: 'Inter', sans-serif; font-size: 13px;
      cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
      transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: var(--cyan); color: var(--cyan); }
    .btn-primary {
      padding: 7px 16px; border-radius: 6px;
      border: none; background: var(--cyan); color: #0A0E1A;
      font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
      cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
      transition: all 0.15s;
    }
    .btn-primary:hover { opacity: 0.88; }

    /* ── HERO ── */
    .hero {
      max-width: 760px; margin: 0 auto;
      padding: 80px 24px 60px; text-align: center;
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 4px 12px; border-radius: 20px;
      border: 1px solid var(--border);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; letter-spacing: 1px; color: var(--cyan);
      text-transform: uppercase; margin-bottom: 28px;
    }
    .live-dot {
      width: 7px; height: 7px; background: var(--red);
      border-radius: 50%;
      animation: blink 1.5s ease-in-out infinite;
    }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    .hero h1 {
      font-family: 'JetBrains Mono', monospace;
      font-size: clamp(32px, 5vw, 52px); font-weight: 700;
      line-height: 1.1; letter-spacing: -1px; margin-bottom: 18px;
    }
    .hero p { font-size: 17px; color: var(--subtext); line-height: 1.65; margin-bottom: 36px; }

    /* ── SCAN BAR ── */
    .scan-bar {
      display: flex; background: var(--surface);
      border: 1px solid var(--border); border-radius: 10px;
      overflow: hidden; max-width: 600px; margin: 0 auto 12px;
      transition: border-color 0.2s;
    }
    .scan-bar:focus-within { border-color: var(--cyan); }
    .scan-bar input {
      flex: 1; padding: 14px 18px; background: transparent;
      border: none; outline: none; color: var(--text);
      font-family: 'JetBrains Mono', monospace; font-size: 14px;
    }
    .scan-bar input::placeholder { color: var(--subtext); }
    .scan-bar button {
      padding: 14px 22px; background: var(--cyan);
      border: none; cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px; font-weight: 700; color: #0A0E1A;
      letter-spacing: 0.5px; transition: opacity 0.15s; white-space: nowrap;
    }
    .scan-bar button:hover { opacity: 0.88; }
    .scan-bar button:disabled { opacity: 0.5; cursor: not-allowed; }
    .scan-hint { font-size: 12px; color: var(--subtext); font-family: 'JetBrains Mono', monospace; }

    /* ── SCAN RESULT ── */
    #scan-result {
      max-width: 600px; margin: 20px auto 0;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 20px 24px; display: none; text-align: left;
    }
    #scan-result.visible { display: block; animation: slide-in 0.3s ease; }
    @keyframes slide-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .result-score-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .score-ring {
      width: 72px; height: 72px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700;
      border: 3px solid; flex-shrink: 0;
    }
    .score-ring.safe   { border-color: #22c55e; color: #22c55e; }
    .score-ring.warn   { border-color: #f59e0b; color: #f59e0b; }
    .score-ring.danger { border-color: #ef4444; color: #ef4444; }
    .result-verdict { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .result-domain  { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--subtext); }
    .result-actions { margin-top: 12px; }
    .result-signals { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .signal-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--subtext); }
    .signal-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .signal-dot.pass { background: #22c55e; }
    .signal-dot.warn { background: #f59e0b; }
    .signal-dot.fail { background: #ef4444; }

    /* ── MAP SECTION ── */
    .map-section { max-width: 1280px; margin: 0 auto; padding: 0 24px 48px; }
    .section-label {
      font-family: 'JetBrains Mono', monospace; font-size: 10px;
      letter-spacing: 2px; text-transform: uppercase;
      color: var(--subtext); margin-bottom: 8px;
    }
    .section-title {
      font-family: 'JetBrains Mono', monospace; font-size: 22px;
      font-weight: 700; margin-bottom: 20px; color: var(--text);
    }
    .map-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .map-mode-toggle {
      display: flex; background: var(--surface); border: 1px solid var(--border);
      border-radius: 6px; padding: 3px; gap: 2px;
    }
    .map-mode-btn {
      padding: 5px 10px; border-radius: 4px; border: none; cursor: pointer;
      font-family: 'JetBrains Mono', monospace; font-size: 10px;
      letter-spacing: 0.5px; text-transform: uppercase;
      background: transparent; color: var(--subtext); transition: all 0.2s;
    }
    .map-mode-btn.active { background: var(--surface2); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.3); }

    /* ── HOW IT WORKS ── */
    .how-section { max-width: 960px; margin: 0 auto; padding: 48px 24px; text-align: center; }
    .how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 36px; }
    @media (max-width: 640px) { .how-grid { grid-template-columns: 1fr; } }
    .how-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 28px 22px; text-align: left;
    }
    .how-num {
      font-family: 'JetBrains Mono', monospace; font-size: 32px;
      font-weight: 700; color: var(--cyan); opacity: 0.3; margin-bottom: 12px;
    }
    .how-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: var(--text); }
    .how-body { font-size: 13px; color: var(--subtext); line-height: 1.6; }

    /* ── PRICING ── */
    .pricing-strip {
      background: var(--surface); border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border); padding: 48px 24px;
    }
    .pricing-grid { max-width: 720px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 560px) { .pricing-grid { grid-template-columns: 1fr; } }
    .pricing-card { background: var(--navy); border: 1px solid var(--border); border-radius: 10px; padding: 24px; }
    .pricing-card.featured { border-color: var(--cyan); }
    .pricing-tier {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      letter-spacing: 1.5px; text-transform: uppercase; color: var(--subtext); margin-bottom: 8px;
    }
    .pricing-price { font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
    .pricing-price span { font-size: 14px; color: var(--subtext); }
    .pricing-features { margin: 16px 0; }
    .pricing-feature {
      font-size: 13px; color: var(--subtext); padding: 4px 0;
      display: flex; gap: 8px; align-items: flex-start;
    }
    .pricing-feature::before { content: '✓'; color: var(--green); flex-shrink: 0; }

    /* ── FOOTER ── */
    footer {
      border-top: 1px solid var(--border); padding: 24px 32px;
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 12px;
    }
    footer .brand { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: var(--text); }
    footer .brand span { color: var(--cyan); }
    footer .footer-links { display: flex; gap: 16px; }
    footer .footer-links a { font-size: 12px; color: var(--subtext); text-decoration: none; transition: color 0.2s; }
    footer .footer-links a:hover { color: var(--text); }
  </style>
</head>
<body>

<nav>
  <a href="/" class="nav-logo">Trust<span>Radar</span></a>
  <div class="nav-actions">
    <a href="/login" class="btn-ghost">Log in</a>
    <a href="/register" class="btn-primary">Get Started Free</a>
    <div class="map-mode-toggle">
      <button class="map-mode-btn active" id="btn-dark" onclick="setPageTheme('dark')">Dark</button>
      <button class="map-mode-btn" id="btn-light" onclick="setPageTheme('light')">Light</button>
    </div>
  </div>
</nav>

<section class="hero">
  <div class="hero-badge">
    <div class="live-dot"></div>
    Real-time threat intelligence
  </div>
  <h1>Know Before<br/>You Click.</h1>
  <p>Real-time trust scoring for URLs, domains, and digital identities.<br/>
  Powered by AI. No account required to try.</p>

  <div class="scan-bar">
    <input type="text" id="scan-input"
           placeholder="paste any URL — e.g. https://suspicious-site.xyz"
           onkeydown="if(event.key==='Enter') runScan()"/>
    <button id="scan-btn" onclick="runScan()">SCAN →</button>
  </div>
  <div class="scan-hint">Free · No signup required · Results in &lt;2s</div>

  <div id="scan-result"></div>
</section>

<section class="map-section">
  <div class="section-label">Live Intelligence</div>
  <div class="section-title">Global Threat Activity</div>
  <div class="map-card">
    ${HEATMAP_HTML}
  </div>
</section>

<section class="how-section">
  <div class="section-label">How It Works</div>
  <div class="section-title">Three steps to a trust verdict</div>
  <div class="how-grid">
    <div class="how-card">
      <div class="how-num">01</div>
      <div class="how-title">Paste Any URL</div>
      <div class="how-body">Drop in any link — a phishing attempt, a suspicious email redirect, or a domain you've never seen before.</div>
    </div>
    <div class="how-card">
      <div class="how-num">02</div>
      <div class="how-title">AI Agents Analyze</div>
      <div class="how-body">Five specialized agents check domain age, SSL cert, redirect chains, VirusTotal hits, and registrar reputation — simultaneously.</div>
    </div>
    <div class="how-card">
      <div class="how-num">03</div>
      <div class="how-title">Verdict in Seconds</div>
      <div class="how-body">Get a trust score 0–100, a plain-English explanation, and actionable signal breakdown. Share the report with one click.</div>
    </div>
  </div>
</section>

<section class="pricing-strip">
  <div style="text-align:center;margin-bottom:32px;">
    <div class="section-label">Pricing</div>
    <div class="section-title">Start free. Scale when ready.</div>
  </div>
  <div class="pricing-grid">
    <div class="pricing-card">
      <div class="pricing-tier">Free</div>
      <div class="pricing-price">$0 <span>/ month</span></div>
      <div class="pricing-features">
        <div class="pricing-feature">10 scans per day</div>
        <div class="pricing-feature">Basic trust score</div>
        <div class="pricing-feature">Scan history (7 days)</div>
        <div class="pricing-feature">Global threat map</div>
      </div>
      <a href="/register" class="btn-ghost" style="width:100%;justify-content:center;margin-top:8px;">Start Free</a>
    </div>
    <div class="pricing-card featured">
      <div class="pricing-tier" style="color:var(--cyan)">Pro</div>
      <div class="pricing-price">$12 <span>/ month</span></div>
      <div class="pricing-features">
        <div class="pricing-feature">Unlimited scans</div>
        <div class="pricing-feature">Full signal breakdown</div>
        <div class="pricing-feature">AI scan insights</div>
        <div class="pricing-feature">API access</div>
        <div class="pricing-feature">Team dashboard</div>
        <div class="pricing-feature">History forever</div>
      </div>
      <a href="/register?plan=pro" class="btn-primary" style="width:100%;justify-content:center;margin-top:8px;">Start Pro Trial</a>
    </div>
  </div>
</section>

<footer>
  <div class="brand">Trust<span>Radar</span></div>
  <div class="footer-links">
    <a href="/login">Log in</a>
    <a href="/register">Sign up</a>
    <a href="https://lrxradar.com">lrxradar.com</a>
  </div>
  <div style="font-size:12px;color:var(--subtext)">© 2026 Trust Radar</div>
</footer>

${HEATMAP_SCRIPTS}
<script>
// ── SCAN ──────────────────────────────────────────────────────────────────────
async function runScan() {
  const input = document.getElementById('scan-input');
  const result = document.getElementById('scan-result');
  const btn = document.getElementById('scan-btn');
  const url = input.value.trim();
  if (!url) { input.focus(); return; }

  btn.disabled = true;
  btn.textContent = 'SCANNING...';
  result.className = 'visible';
  result.innerHTML = '<div style="text-align:center;padding:20px;font-family:JetBrains Mono,monospace;color:var(--subtext)">Analyzing...</div>';

  try {
    const res = await fetch('/api/scan/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    const scan = data.data || data;
    const score = scan.trust_score ?? scan.score ?? 50;
    const cls = score >= 70 ? 'safe' : score >= 40 ? 'warn' : 'danger';
    const verdict = score >= 70 ? '✓ Appears Safe' : score >= 40 ? '⚠ Suspicious' : '✗ High Risk';
    const verdictColor = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
    const domain = url.replace(/^https?:\\/\\//, '').split('/')[0];

    const signals = buildSignals(scan);

    result.innerHTML = \`
      <div class="result-score-row">
        <div class="score-ring \${cls}">\${score}</div>
        <div style="flex:1">
          <div class="result-verdict" style="color:\${verdictColor}">\${verdict}</div>
          <div class="result-domain">\${domain}</div>
        </div>
      </div>
      <div class="result-signals">\${signals}</div>
      \${scan.id ? \`<div class="result-actions"><a href="/scan/\${scan.id}" class="btn-ghost" style="font-size:12px;margin-top:12px;display:inline-flex">View Full Report →</a></div>\` : ''}
    \`;
  } catch (err) {
    result.innerHTML = '<div style="color:var(--red);font-size:13px;padding:4px 0;">Scan failed — check the URL and try again.</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'SCAN →';
  }
}

function buildSignals(scan) {
  const flags = scan.flags || [];
  const meta = scan.metadata || {};
  const hasFlag = (type) => flags.some(f => f.type === type);

  const rows = [
    { label: 'SSL / HTTPS', status: (meta.ssl_valid !== false && !hasFlag('no_ssl')) ? 'pass' : 'fail' },
    { label: 'VirusTotal',  status: hasFlag('malicious_url') ? 'fail' : hasFlag('suspicious_url') ? 'warn' : 'pass' },
    { label: 'Domain check', status: hasFlag('typosquatting') ? 'fail' : hasFlag('ip_domain') ? 'warn' : 'pass' },
    { label: 'Threat feeds', status: (scan.trust_score >= 70) ? 'pass' : (scan.trust_score >= 40) ? 'warn' : 'fail' },
  ];
  return rows.map(r => \`
    <div class="signal-row">
      <div class="signal-dot \${r.status}"></div>
      \${r.label}
    </div>
  \`).join('');
}

// ── THEME ────────────────────────────────────────────────────────────────────
function setPageTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('btn-dark').classList.toggle('active', theme === 'dark');
  document.getElementById('btn-light').classList.toggle('active', theme === 'light');
  if (typeof window.heatmapSetTheme === 'function') window.heatmapSetTheme(theme);
}

</script>
</body></html>`;
}
