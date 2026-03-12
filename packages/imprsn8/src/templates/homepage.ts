export function renderImprsn8Homepage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>imprsn8 — Your Digital Impression Score</title>
  <meta name="description" content="imprsn8 monitors your digital identity across the web — catching fakes, flagging threats, and amplifying your authentic brand."/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"/>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.0.0/dist/fonts/geist-sans/style.css"/>
  <style>
    :root {
      --black:    #0A0A0A;
      --surface:  #111111;
      --surface2: #1A1A1A;
      --border:   rgba(212,175,55,0.15);
      --gold:     #D4AF37;
      --purple:   #7C3AED;
      --red:      #EF4444;
      --green:    #22C55E;
      --text:     #F5F5F5;
      --subtext:  #71717A;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: var(--black);
      color: var(--text);
      font-family: 'Geist Sans', 'Inter', sans-serif;
    }

    /* ── NAV ── */
    nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 40px; height: 64px;
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
      background: rgba(10,10,10,0.9);
      backdrop-filter: blur(16px);
    }
    .imprsn8-logo {
      font-family: 'Clash Display', sans-serif;
      font-size: 20px; font-weight: 700;
      letter-spacing: -0.5px;
      color: var(--text);
      text-decoration: none;
    }
    .imprsn8-logo span { color: var(--gold); }

    /* ── BUTTONS ── */
    .btn-gold {
      padding: 14px 28px; border-radius: 8px;
      border: none; background: var(--gold);
      color: #0A0A0A;
      font-family: 'Clash Display', sans-serif;
      font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none;
      display: inline-flex; align-items: center;
      transition: all 0.15s;
    }
    .btn-gold:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .btn-gold-sm {
      padding: 10px 20px; border-radius: 8px;
      border: none; background: var(--gold);
      color: #0A0A0A;
      font-family: 'Clash Display', sans-serif;
      font-size: 13px; font-weight: 600;
      cursor: pointer; text-decoration: none;
      display: inline-flex; align-items: center;
      transition: all 0.15s;
    }
    .btn-gold-sm:hover { filter: brightness(1.1); }
    .btn-outline-gold {
      padding: 14px 28px; border-radius: 8px;
      border: 1px solid rgba(212,175,55,0.4);
      background: transparent; color: var(--gold);
      font-family: 'Clash Display', sans-serif;
      font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none;
      display: inline-flex; align-items: center;
      transition: all 0.2s;
    }
    .btn-outline-gold:hover { border-color: var(--gold); background: rgba(212,175,55,0.06); }

    /* ── HERO ── */
    .hero {
      min-height: 90vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 80px 24px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 600px 400px at 50% 60%,
          rgba(124,58,237,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 400px 300px at 70% 30%,
          rgba(212,175,55,0.08) 0%, transparent 60%);
      pointer-events: none;
    }
    .hero-eyebrow {
      font-family: 'Clash Display', sans-serif;
      font-size: 11px; letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--gold); opacity: 0.8;
      margin-bottom: 24px;
    }
    .hero h1 {
      font-family: 'Clash Display', sans-serif;
      font-size: clamp(42px, 7vw, 80px);
      font-weight: 700; line-height: 1.05;
      letter-spacing: -2px;
      margin-bottom: 24px;
      max-width: 800px;
    }
    .hero h1 em {
      font-style: normal;
      background: linear-gradient(135deg, var(--gold), #f7d97c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub {
      font-size: 18px; color: var(--subtext);
      line-height: 1.65; max-width: 560px;
      margin-bottom: 40px;
    }
    .hero-cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

    /* ── SCORE DEMO WIDGET ── */
    .score-demo {
      margin-top: 60px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px 36px;
      max-width: 480px;
      width: 100%;
      position: relative;
    }
    .score-demo-label {
      font-family: 'Clash Display', sans-serif;
      font-size: 11px; letter-spacing: 2px;
      text-transform: uppercase; color: var(--subtext);
      margin-bottom: 20px;
    }
    .score-ring-large {
      width: 120px; height: 120px;
      border-radius: 50%;
      border: 4px solid var(--gold);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    .score-num-large {
      font-family: 'Clash Display', sans-serif;
      font-size: 38px; font-weight: 700; color: var(--gold); line-height: 1;
    }
    .score-sub-large { font-size: 11px; color: var(--subtext); }
    .score-components {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .score-comp {
      background: var(--surface2);
      border-radius: 8px; padding: 10px 12px;
    }
    .score-comp-label { font-size: 11px; color: var(--subtext); margin-bottom: 4px; }
    .score-comp-val {
      font-family: 'Clash Display', sans-serif;
      font-size: 18px; font-weight: 600;
    }

    /* ── FEATURE SECTIONS ── */
    .features { padding: 80px 24px; max-width: 1100px; margin: 0 auto; }
    .feature-row {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 60px; align-items: center; margin-bottom: 100px;
    }
    .feature-row.reverse { direction: rtl; }
    .feature-row.reverse > * { direction: ltr; }
    @media (max-width: 768px) {
      .feature-row, .feature-row.reverse { grid-template-columns: 1fr; direction: ltr; }
      nav { padding: 0 20px; }
    }
    .feature-eyebrow {
      font-family: 'Clash Display', sans-serif;
      font-size: 10px; letter-spacing: 2.5px;
      text-transform: uppercase;
      color: var(--gold); margin-bottom: 16px;
    }
    .feature-title {
      font-family: 'Clash Display', sans-serif;
      font-size: clamp(26px, 3vw, 36px);
      font-weight: 700; line-height: 1.15;
      letter-spacing: -0.5px; margin-bottom: 16px;
    }
    .feature-body {
      font-size: 15px; color: var(--subtext);
      line-height: 1.7; margin-bottom: 24px;
    }
    .feature-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 28px;
      min-height: 260px;
      display: flex; flex-direction: column;
      justify-content: space-between;
    }

    /* ── AGENT ANIMATION ── */
    .agent-row { display: flex; flex-direction: column; gap: 10px; }
    .agent-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface2);
      border-radius: 8px; padding: 10px 14px;
      border: 1px solid transparent;
      transition: border-color 0.3s;
    }
    .agent-card.scanning { border-color: var(--purple); }
    .agent-card.done     { border-color: rgba(34,197,94,0.3); }
    .agent-icon { font-size: 18px; }
    .agent-name { flex: 1; font-size: 13px; color: var(--text); }
    .agent-status { font-size: 11px; font-family: 'Geist Sans', monospace; }
    .agent-status.scanning { color: var(--purple); animation: pulse-text 1s ease-in-out infinite; }
    .agent-status.done     { color: var(--green); }
    .agent-status.idle     { color: var(--subtext); }
    @keyframes pulse-text { 0%,100%{opacity:1} 50%{opacity:0.4} }

    /* ── FOOTER ── */
    footer {
      border-top: 1px solid var(--border);
      padding: 40px;
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 16px;
    }
    footer .brand {
      font-family: 'Clash Display', sans-serif;
      font-size: 16px; font-weight: 700; color: var(--text);
      text-decoration: none;
    }
    footer .brand span { color: var(--gold); }
    footer .footer-links { display: flex; gap: 20px; }
    footer .footer-links a {
      font-size: 13px; color: var(--subtext);
      text-decoration: none; transition: color 0.2s;
    }
    footer .footer-links a:hover { color: var(--text); }
    .also-by { font-size: 12px; color: var(--subtext); }
    .also-by a { color: var(--gold); text-decoration: none; }
    .also-by a:hover { text-decoration: underline; }
  </style>
</head>
<body>

<nav>
  <a href="/" class="imprsn8-logo">imprsn<span>8</span></a>
  <div style="display:flex;gap:10px;align-items:center;">
    <a href="/login" style="color:var(--subtext);text-decoration:none;font-size:14px;">Log in</a>
    <a href="/register" class="btn-gold-sm">Get Started</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-eyebrow">AI-Powered Brand Intelligence</div>
  <h1>Your Online Presence<br/>Has a <em>Score.</em></h1>
  <p class="hero-sub">
    imprsn8 monitors your digital identity across the web —
    catching fakes, flagging threats, and amplifying your authentic brand.
  </p>
  <div class="hero-cta-row">
    <a href="/register" class="btn-gold">Analyze My Profile →</a>
    <a href="#how-it-works" class="btn-outline-gold">See How It Works</a>
  </div>

  <div class="score-demo">
    <div class="score-demo-label">Your Impression Score</div>
    <div class="score-ring-large">
      <div class="score-num-large">76</div>
      <div class="score-sub-large">/ 100</div>
    </div>
    <div class="score-components">
      <div class="score-comp">
        <div class="score-comp-label">Authenticity</div>
        <div class="score-comp-val" style="color:var(--purple)">88</div>
      </div>
      <div class="score-comp">
        <div class="score-comp-label">Reach Quality</div>
        <div class="score-comp-val" style="color:var(--gold)">71</div>
      </div>
      <div class="score-comp">
        <div class="score-comp-label">Threat Exposure</div>
        <div class="score-comp-val" style="color:var(--red)">Low</div>
      </div>
      <div class="score-comp">
        <div class="score-comp-label">Sentiment</div>
        <div class="score-comp-val" style="color:var(--green)">82</div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURES -->
<section class="features" id="how-it-works">

  <!-- Feature 1: Impersonation Detection -->
  <div class="feature-row">
    <div>
      <div class="feature-eyebrow">Protection</div>
      <h2 class="feature-title">We found 3 accounts pretending to be you.</h2>
      <p class="feature-body">
        Our impersonation agent scans every major platform continuously —
        detecting fake accounts that use your name, likeness, or brand
        before they damage your reputation or deceive your audience.
      </p>
      <a href="/register" class="btn-gold">Start Monitoring</a>
    </div>
    <div class="feature-card">
      <div style="font-family:'Clash Display',sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--subtext);margin-bottom:16px;">Detected This Week</div>
      ${["@yourname_official · Instagram · 12.4K followers", "@yourname.real · TikTok · 3.1K followers", "yourname-verified.com · Phishing site"].map((item) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:8px;margin-bottom:8px;border-left:3px solid var(--red);">
        <div style="font-size:18px;">⚠️</div>
        <div style="font-size:12px;color:var(--text);">${item}</div>
      </div>`).join("")}
    </div>
  </div>

  <!-- Feature 2: War Room Agent Simulation -->
  <div class="feature-row reverse">
    <div>
      <div class="feature-eyebrow">Intelligence</div>
      <h2 class="feature-title">Five AI agents scanning for you, simultaneously.</h2>
      <p class="feature-body">
        Every analysis runs a coordinated sweep across impersonation, phishing,
        brand reputation, dark web mentions, and sentiment — giving you a
        complete picture in under 30 seconds.
      </p>
      <a href="/register" class="btn-outline-gold">Try an Analysis</a>
    </div>
    <div class="feature-card">
      <div style="font-family:'Clash Display',sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--subtext);margin-bottom:16px;">Live Analysis</div>
      <div class="agent-row" id="agent-demo">
        <div class="agent-card done">
          <div class="agent-icon">🔍</div>
          <div class="agent-name">Impersonation Agent</div>
          <div class="agent-status done">✓ Complete — 3 found</div>
        </div>
        <div class="agent-card scanning">
          <div class="agent-icon">🎭</div>
          <div class="agent-name">Phishing Agent</div>
          <div class="agent-status scanning">Scanning...</div>
        </div>
        <div class="agent-card">
          <div class="agent-icon">📰</div>
          <div class="agent-name">Brand Reputation Agent</div>
          <div class="agent-status idle">Queued</div>
        </div>
        <div class="agent-card">
          <div class="agent-icon">🌑</div>
          <div class="agent-name">Dark Web Agent</div>
          <div class="agent-status idle">Queued</div>
        </div>
        <div class="agent-card">
          <div class="agent-icon">📊</div>
          <div class="agent-name">Sentiment Agent</div>
          <div class="agent-status idle">Queued</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Feature 3: Reports -->
  <div class="feature-row">
    <div>
      <div class="feature-eyebrow">Intelligence Reports</div>
      <h2 class="feature-title">Your monthly brand briefing, written by AI.</h2>
      <p class="feature-body">
        Every month, imprsn8 compiles everything it found into a formatted
        intelligence report — score movements, threat summaries, media mentions,
        and recommendations. Download as PDF. Share with your team.
      </p>
      <a href="/register" class="btn-gold">Get Your First Report</a>
    </div>
    <div class="feature-card" style="justify-content:flex-start;gap:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-family:'Clash Display',sans-serif;font-size:18px;font-weight:600;">March 2026 Report</div>
          <div style="font-size:12px;color:var(--subtext);margin-top:4px;">Generated March 1 · PDF · 12 pages</div>
        </div>
        <div style="background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:6px;padding:4px 10px;font-size:11px;color:var(--gold);">↑ +4 pts</div>
      </div>
      <div style="height:1px;background:var(--border);"></div>
      <div style="font-size:13px;color:var(--subtext);line-height:1.7;">
        Your Impression Score improved by 4 points this month following the
        successful removal of 2 phishing domains. One new impersonation account
        was detected on Instagram and flagged for reporting. Sentiment trending positive
        across 47 media mentions.
      </div>
    </div>
  </div>

</section>

<!-- FOOTER -->
<footer>
  <div>
    <a href="/" class="brand">imprsn<span>8</span></a>
    <div class="also-by" style="margin-top:6px;">
      Also by LRX: <a href="https://lrxradar.com">Trust Radar →</a>
    </div>
  </div>
  <div class="footer-links">
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="mailto:hello@imprsn8.com">Contact</a>
  </div>
</footer>

<script>
// ── AGENT DEMO ANIMATION ──────────────────────────────────────────────────
(function() {
  var states = [
    ['done','scanning','idle','idle','idle'],
    ['done','done','scanning','idle','idle'],
    ['done','done','done','scanning','idle'],
    ['done','done','done','done','scanning'],
    ['done','done','done','done','done'],
  ];
  var labels = [
    null,
    '✓ Complete — 0 threats',
    '✓ Complete — 2 mentions',
    '✓ Complete — 1 reference',
    '✓ Complete — Positive',
  ];
  var step = 0;
  var cards = document.querySelectorAll('.agent-card');
  var statuses = document.querySelectorAll('.agent-status');

  function advance() {
    if (step >= states.length) return;
    var s = states[step];
    cards.forEach(function(c, i) {
      c.className = 'agent-card ' + (s[i] !== 'idle' ? s[i] : '');
      statuses[i].className = 'agent-status ' + s[i];
      if (s[i] === 'scanning') statuses[i].textContent = 'Scanning...';
      else if (s[i] === 'done' && labels[i]) statuses[i].textContent = labels[i];
      else if (s[i] === 'idle') statuses[i].textContent = 'Queued';
    });
    step++;
    if (step < states.length) setTimeout(advance, 1400);
    else setTimeout(function() { step = 0; advance(); }, 3000);
  }
  setTimeout(advance, 1200);
})();
</script>

</body></html>`;
}
