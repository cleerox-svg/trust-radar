export function renderImprsn8Dashboard(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Dashboard — imprsn8</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"/>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.0.0/dist/fonts/geist-sans/style.css"/>
  <style>
    :root {
      --black:    #0A0A0A;
      --surface:  #111111;
      --surface2: #1A1A1A;
      --surface3: #222222;
      --border:   rgba(212,175,55,0.15);
      --border2:  rgba(212,175,55,0.08);
      --gold:     #D4AF37;
      --purple:   #7C3AED;
      --red:      #EF4444;
      --green:    #22C55E;
      --text:     #F5F5F5;
      --subtext:  #71717A;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: var(--black); color: var(--text);
      font-family: 'Geist Sans', 'Inter', sans-serif;
      height: 100%; overflow: hidden;
    }

    /* ── LAYOUT ── */
    .app { display: flex; height: 100vh; overflow: hidden; }

    /* ── SIDEBAR ── */
    .sidebar {
      width: 220px; flex-shrink: 0;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
      padding: 0;
      overflow-y: auto;
    }
    .sidebar-logo {
      padding: 20px 20px 0;
      font-family: 'Clash Display', sans-serif;
      font-size: 18px; font-weight: 700;
      color: var(--text); text-decoration: none;
      display: block;
    }
    .sidebar-logo span { color: var(--gold); }
    .sidebar-user {
      padding: 16px 20px 20px;
      border-bottom: 1px solid var(--border2);
      margin-bottom: 8px;
    }
    .sidebar-email { font-size: 12px; color: var(--subtext); }
    .sidebar-plan {
      display: inline-block; margin-top: 4px;
      font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
      background: rgba(212,175,55,0.12); color: var(--gold);
      border-radius: 4px; padding: 2px 8px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 11px 20px; cursor: pointer;
      font-size: 14px; color: var(--subtext);
      border-left: 3px solid transparent;
      transition: all 0.15s; text-decoration: none;
      border-radius: 0;
      background: none; border-top: none; border-right: none; border-bottom: none;
      width: 100%; text-align: left; font-family: inherit;
    }
    .nav-item:hover { color: var(--text); background: var(--surface2); }
    .nav-item.active {
      color: var(--gold);
      border-left-color: var(--gold);
      background: rgba(212,175,55,0.05);
    }
    .nav-icon { font-size: 16px; width: 20px; flex-shrink: 0; }
    .sidebar-footer {
      margin-top: auto;
      padding: 16px 20px;
      border-top: 1px solid var(--border2);
    }
    .btn-logout {
      font-size: 12px; color: var(--subtext);
      background: none; border: none; cursor: pointer;
      font-family: inherit; padding: 0;
      transition: color 0.2s;
    }
    .btn-logout:hover { color: var(--red); }

    /* ── MAIN CONTENT ── */
    .main { flex: 1; overflow-y: auto; }
    .page-header {
      padding: 28px 32px 0;
      border-bottom: 1px solid var(--border2);
      margin-bottom: 0;
    }
    .page-title {
      font-family: 'Clash Display', sans-serif;
      font-size: 22px; font-weight: 700;
      letter-spacing: -0.5px; margin-bottom: 4px;
    }
    .page-sub { font-size: 13px; color: var(--subtext); padding-bottom: 20px; }
    .page-content { padding: 28px 32px; }

    /* ── SECTIONS ── */
    .section { display: none; }
    .section.active { display: block; }

    /* ── SCORE RING (Overview) ── */
    .overview-top {
      display: grid; grid-template-columns: auto 1fr;
      gap: 32px; align-items: center; margin-bottom: 28px;
    }
    .impression-ring-wrap { position: relative; }
    .impression-ring {
      width: 140px; height: 140px;
      border-radius: 50%; position: relative;
      display: flex; align-items: center; justify-content: center;
      flex-direction: column;
    }
    .ring-svg {
      position: absolute; inset: 0;
      transform: rotate(-90deg);
    }
    .ring-track { fill: none; stroke: rgba(212,175,55,0.12); stroke-width: 8; }
    .ring-fill {
      fill: none; stroke: var(--gold); stroke-width: 8;
      stroke-linecap: round;
      stroke-dasharray: 408; stroke-dashoffset: 408;
      transition: stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .ring-value {
      font-family: 'Clash Display', sans-serif;
      font-size: 38px; font-weight: 700;
      color: var(--gold); line-height: 1; z-index: 1;
    }
    .ring-label { font-size: 11px; color: var(--subtext); z-index: 1; }
    .score-meta h2 {
      font-family: 'Clash Display', sans-serif;
      font-size: 20px; font-weight: 700; margin-bottom: 6px;
    }
    .score-meta p { font-size: 13px; color: var(--subtext); margin-bottom: 16px; }
    .component-grid {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .comp-card {
      background: var(--surface2);
      border-radius: 8px; padding: 10px 14px;
    }
    .comp-label { font-size: 11px; color: var(--subtext); margin-bottom: 3px; }
    .comp-val {
      font-family: 'Clash Display', sans-serif;
      font-size: 20px; font-weight: 600;
    }

    /* ── ALERT BANNER ── */
    .alert-banner {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.25);
      border-radius: 8px; padding: 12px 16px;
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 24px; font-size: 13px;
    }
    .alert-banner.hidden { display: none; }

    /* ── CARDS ── */
    .card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 20px 22px;
      margin-bottom: 16px;
    }
    .card-title {
      font-family: 'Clash Display', sans-serif;
      font-size: 11px; letter-spacing: 1.5px;
      text-transform: uppercase; color: var(--subtext);
      margin-bottom: 16px;
    }

    /* ── RECENT ANALYSES ── */
    .analysis-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 0; border-bottom: 1px solid var(--border2);
      font-size: 13px;
    }
    .analysis-row:last-child { border-bottom: none; }
    .analysis-score {
      font-family: 'Clash Display', sans-serif;
      font-size: 18px; font-weight: 600; color: var(--gold);
      min-width: 40px;
    }
    .analysis-meta { flex: 1; }
    .analysis-date { font-size: 11px; color: var(--subtext); }

    /* ── WAR ROOM (Analyze) ── */
    .war-room-header {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 24px;
    }
    .war-room-badge {
      font-family: 'Clash Display', sans-serif;
      font-size: 10px; letter-spacing: 2px;
      text-transform: uppercase;
      background: rgba(124,58,237,0.15); color: var(--purple);
      border: 1px solid rgba(124,58,237,0.3);
      border-radius: 4px; padding: 3px 10px;
    }
    .progress-bar-wrap {
      background: var(--surface2); border-radius: 4px;
      height: 4px; margin-bottom: 20px; overflow: hidden;
    }
    .progress-bar {
      height: 100%; background: var(--gold);
      border-radius: 4px; width: 0%;
      transition: width 0.5s ease;
    }
    .wr-agent-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface2);
      border-radius: 8px; padding: 12px 16px;
      border: 1px solid transparent;
      transition: border-color 0.3s; margin-bottom: 8px;
    }
    .wr-agent-card.scanning { border-color: var(--purple); }
    .wr-agent-card.done     { border-color: rgba(34,197,94,0.3); }
    .wr-agent-icon { font-size: 20px; }
    .wr-agent-info { flex: 1; }
    .wr-agent-name { font-size: 13px; font-weight: 500; color: var(--text); }
    .wr-agent-desc { font-size: 11px; color: var(--subtext); margin-top: 2px; }
    .wr-agent-status { font-size: 12px; }
    .wr-agent-status.scanning { color: var(--purple); animation: pulse-text 1s ease-in-out infinite; }
    .wr-agent-status.done { color: var(--green); }
    .wr-agent-status.idle { color: var(--subtext); }
    @keyframes pulse-text { 0%,100%{opacity:1} 50%{opacity:0.4} }

    /* ── RESULTS PANEL ── */
    .results-panel { display: none; margin-top: 20px; }
    .results-panel.visible { display: block; }
    .results-score-row {
      display: flex; align-items: center; gap: 16px;
      margin-bottom: 20px;
    }
    .results-score-big {
      font-family: 'Clash Display', sans-serif;
      font-size: 48px; font-weight: 700; color: var(--gold); line-height: 1;
    }
    .results-delta {
      font-family: 'Clash Display', sans-serif;
      font-size: 14px; font-weight: 600;
      background: rgba(34,197,94,0.12);
      color: var(--green); border-radius: 6px;
      padding: 4px 10px;
    }
    .results-narrative {
      font-size: 14px; color: var(--subtext); line-height: 1.7;
      margin-bottom: 16px;
    }
    .signal-list { display: flex; flex-direction: column; gap: 8px; }
    .signal-item {
      display: flex; align-items: center; gap: 10px;
      font-size: 13px; padding: 8px 12px;
      background: var(--surface2); border-radius: 6px;
    }
    .signal-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

    /* ── SOCIAL PROFILES ── */
    .social-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px; margin-bottom: 20px;
    }
    .social-card {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px; padding: 16px;
    }
    .social-card.connected { border-color: rgba(212,175,55,0.4); }
    .social-platform {
      font-family: 'Clash Display', sans-serif;
      font-size: 13px; font-weight: 600;
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 8px;
    }
    .social-handle { font-size: 12px; color: var(--gold); margin-bottom: 6px; }
    .social-meta { font-size: 11px; color: var(--subtext); }
    .social-empty {
      font-size: 13px; color: var(--subtext);
      text-align: center; padding: 32px 0;
    }

    /* ── REPORTS ── */
    .report-row {
      display: flex; align-items: center; gap: 16px;
      padding: 12px 0; border-bottom: 1px solid var(--border2);
      font-size: 13px;
    }
    .report-row:last-child { border-bottom: none; }
    .report-date {
      font-family: 'Clash Display', sans-serif;
      font-size: 14px; font-weight: 600; min-width: 140px;
    }
    .report-score { color: var(--gold); min-width: 60px; }
    .report-delta {
      font-size: 12px; padding: 2px 8px;
      border-radius: 4px; min-width: 60px; text-align: center;
    }
    .report-delta.up { background: rgba(34,197,94,0.1); color: var(--green); }
    .report-delta.down { background: rgba(239,68,68,0.1); color: var(--red); }
    .report-empty {
      font-size: 13px; color: var(--subtext);
      text-align: center; padding: 32px 0;
    }

    /* ── SPARKLINE ── */
    .sparkline-wrap { margin-bottom: 20px; }
    .sparkline-svg { width: 100%; height: 80px; }

    /* ── BUTTONS ── */
    .btn-gold {
      padding: 12px 24px; border-radius: 8px;
      border: none; background: var(--gold);
      color: #0A0A0A;
      font-family: 'Clash Display', sans-serif;
      font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-gold:hover { filter: brightness(1.1); }
    .btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-outline {
      padding: 10px 20px; border-radius: 8px;
      border: 1px solid var(--border);
      background: transparent; color: var(--text);
      font-family: 'Clash Display', sans-serif;
      font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-outline:hover { border-color: var(--gold); color: var(--gold); }

    /* ── LOADING ── */
    .loading { color: var(--subtext); font-size: 13px; padding: 20px 0; }
    .skeleton {
      background: var(--surface2);
      border-radius: 6px; height: 16px;
      animation: shimmer 1.5s ease-in-out infinite;
    }
    @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }

    /* ── MOBILE NAV ── */
    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main { overflow-y: auto; }
      .mobile-nav {
        display: flex; position: fixed; bottom: 0; left: 0; right: 0;
        background: var(--surface); border-top: 1px solid var(--border);
        z-index: 100; padding: 8px 0;
      }
      .mobile-nav-item {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; gap: 2px;
        font-size: 10px; color: var(--subtext);
        cursor: pointer; padding: 4px 0;
        background: none; border: none; font-family: inherit;
        transition: color 0.15s;
      }
      .mobile-nav-item.active { color: var(--gold); }
      .mobile-nav-item .nav-icon { font-size: 20px; }
      .page-content { padding-bottom: 80px; }
    }
    @media (min-width: 769px) {
      .mobile-nav { display: none; }
    }
  </style>
</head>
<body>

<div class="app">

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <a href="/" class="sidebar-logo">imprsn<span>8</span></a>
    <div class="sidebar-user">
      <div class="sidebar-email" id="sb-email">Loading...</div>
      <div class="sidebar-plan" id="sb-plan">free</div>
    </div>

    <button class="nav-item active" data-page="overview">
      <span class="nav-icon">◉</span> Overview
    </button>
    <button class="nav-item" data-page="analyze">
      <span class="nav-icon">⚡</span> War Room
    </button>
    <button class="nav-item" data-page="socials">
      <span class="nav-icon">◈</span> Social Profiles
    </button>
    <button class="nav-item" data-page="threats">
      <span class="nav-icon">⚠</span> Threat Feed
    </button>
    <button class="nav-item" data-page="reports">
      <span class="nav-icon">▤</span> Reports
    </button>
    <button class="nav-item" data-page="settings">
      <span class="nav-icon">⚙</span> Settings
    </button>

    <div class="sidebar-footer">
      <button class="btn-logout" onclick="logout()">Log out</button>
    </div>
  </aside>

  <!-- MAIN -->
  <main class="main">

    <!-- ── OVERVIEW ── -->
    <section id="page-overview" class="section active">
      <div class="page-header">
        <div class="page-title">Overview</div>
        <div class="page-sub" id="overview-sub">Your digital impression at a glance</div>
      </div>
      <div class="page-content">

        <div class="alert-banner hidden" id="threat-alert">
          <span>⚠️</span>
          <span id="threat-alert-text"></span>
        </div>

        <div class="overview-top">
          <div class="impression-ring-wrap">
            <div class="impression-ring">
              <svg class="ring-svg" viewBox="0 0 140 140">
                <circle class="ring-track" cx="70" cy="70" r="65"/>
                <circle class="ring-fill" id="ring-fill" cx="70" cy="70" r="65"/>
              </svg>
              <div class="ring-value" id="ring-value">—</div>
              <div class="ring-label">/ 100</div>
            </div>
          </div>
          <div class="score-meta">
            <h2>Impression Score</h2>
            <p id="score-caption">Run an analysis to see your score.</p>
            <div class="component-grid">
              <div class="comp-card">
                <div class="comp-label">Authenticity</div>
                <div class="comp-val" style="color:var(--purple)" id="comp-authenticity">—</div>
              </div>
              <div class="comp-card">
                <div class="comp-label">Reach Quality</div>
                <div class="comp-val" style="color:var(--gold)" id="comp-reach">—</div>
              </div>
              <div class="comp-card">
                <div class="comp-label">Threat Exposure</div>
                <div class="comp-val" style="color:var(--red)" id="comp-threat">—</div>
              </div>
              <div class="comp-card">
                <div class="comp-label">Sentiment</div>
                <div class="comp-val" style="color:var(--green)" id="comp-sentiment">—</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Recent Analyses</div>
          <div id="recent-analyses"><div class="loading">Loading...</div></div>
        </div>

      </div>
    </section>

    <!-- ── WAR ROOM ── -->
    <section id="page-analyze" class="section">
      <div class="page-header">
        <div class="war-room-header">
          <div class="page-title">War Room</div>
          <div class="war-room-badge">AI Analysis</div>
        </div>
        <div class="page-sub">Deploy five intelligence agents simultaneously against your profile.</div>
      </div>
      <div class="page-content">

        <div class="progress-bar-wrap">
          <div class="progress-bar" id="wr-progress"></div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Intelligence Agents</div>
          <div id="wr-agents">
            <div class="wr-agent-card" id="wra-0">
              <div class="wr-agent-icon">🔍</div>
              <div class="wr-agent-info">
                <div class="wr-agent-name">Impersonation Agent</div>
                <div class="wr-agent-desc">Scans all platforms for fake accounts</div>
              </div>
              <div class="wr-agent-status idle" id="wrs-0">Standby</div>
            </div>
            <div class="wr-agent-card" id="wra-1">
              <div class="wr-agent-icon">🎭</div>
              <div class="wr-agent-info">
                <div class="wr-agent-name">Phishing Agent</div>
                <div class="wr-agent-desc">Detects phishing domains and scam sites</div>
              </div>
              <div class="wr-agent-status idle" id="wrs-1">Standby</div>
            </div>
            <div class="wr-agent-card" id="wra-2">
              <div class="wr-agent-icon">📰</div>
              <div class="wr-agent-info">
                <div class="wr-agent-name">Brand Reputation Agent</div>
                <div class="wr-agent-desc">Monitors news and media mentions</div>
              </div>
              <div class="wr-agent-status idle" id="wrs-2">Standby</div>
            </div>
            <div class="wr-agent-card" id="wra-3">
              <div class="wr-agent-icon">🌑</div>
              <div class="wr-agent-info">
                <div class="wr-agent-name">Dark Web Agent</div>
                <div class="wr-agent-desc">Checks underground forums for your data</div>
              </div>
              <div class="wr-agent-status idle" id="wrs-3">Standby</div>
            </div>
            <div class="wr-agent-card" id="wra-4">
              <div class="wr-agent-icon">📊</div>
              <div class="wr-agent-info">
                <div class="wr-agent-name">Sentiment Agent</div>
                <div class="wr-agent-desc">Aggregates audience sentiment signals</div>
              </div>
              <div class="wr-agent-status idle" id="wrs-4">Standby</div>
            </div>
          </div>
        </div>

        <button class="btn-gold" id="btn-analyze" onclick="runAnalysis()">
          ⚡ Run Full Analysis
        </button>

        <!-- RESULTS -->
        <div class="card results-panel" id="results-panel">
          <div class="card-title">Analysis Complete</div>
          <div class="results-score-row">
            <div class="results-score-big" id="res-score">—</div>
            <div class="results-delta" id="res-delta" style="display:none"></div>
          </div>
          <div class="results-narrative" id="res-narrative"></div>
          <div class="signal-list" id="res-signals"></div>
        </div>

      </div>
    </section>

    <!-- ── SOCIAL PROFILES ── -->
    <section id="page-socials" class="section">
      <div class="page-header">
        <div class="page-title">Social Profiles</div>
        <div class="page-sub">Connected platforms feed your Impression Score</div>
      </div>
      <div class="page-content">
        <div id="social-grid" class="social-grid">
          <div class="loading">Loading...</div>
        </div>
        <div style="margin-top:8px;">
          <div class="card-title" style="margin-bottom:12px;">Connect a Profile</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;" id="platform-connect-row">
            ${["Twitter/X","Instagram","LinkedIn","TikTok","YouTube","Bluesky"].map((p) => `
            <button class="btn-outline" onclick="connectPlatform('${p.toLowerCase().replace("/","_")}')">${p}</button>`).join("")}
          </div>
        </div>
      </div>
    </section>

    <!-- ── THREAT FEED ── */
    <section id="page-threats" class="section">
      <div class="page-header">
        <div class="page-title">Threat Feed</div>
        <div class="page-sub">Active impersonations and threats detected by your agents</div>
      </div>
      <div class="page-content">
        <div class="card">
          <div id="threat-list"><div class="loading">Loading threats...</div></div>
        </div>
      </div>
    </section>

    <!-- ── REPORTS ── -->
    <section id="page-reports" class="section">
      <div class="page-header">
        <div class="page-title">Reports</div>
        <div class="page-sub">Score history and monthly intelligence briefings</div>
      </div>
      <div class="page-content">

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Score History</div>
          <div class="sparkline-wrap">
            <svg class="sparkline-svg" id="sparkline-svg" viewBox="0 0 600 80" preserveAspectRatio="none">
              <text x="300" y="45" text-anchor="middle" fill="var(--subtext)" font-size="12">Loading...</text>
            </svg>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Analysis History</div>
          <div id="report-list"><div class="loading">Loading...</div></div>
        </div>

      </div>
    </section>

    <!-- ── SETTINGS ── -->
    <section id="page-settings" class="section">
      <div class="page-header">
        <div class="page-title">Settings</div>
        <div class="page-sub">Account and notification preferences</div>
      </div>
      <div class="page-content">
        <div class="card">
          <div class="card-title">Account</div>
          <div style="display:grid;gap:16px;max-width:400px;">
            <div>
              <div style="font-size:12px;color:var(--subtext);margin-bottom:6px;">Display Name</div>
              <input id="set-display-name" type="text"
                style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px 12px;color:var(--text);font-size:14px;font-family:inherit;"
                placeholder="Your name"/>
            </div>
            <div>
              <div style="font-size:12px;color:var(--subtext);margin-bottom:6px;">Email</div>
              <input id="set-email" type="email" disabled
                style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:10px 12px;color:var(--subtext);font-size:14px;font-family:inherit;cursor:not-allowed;"
                placeholder=""/>
            </div>
            <button class="btn-gold" style="width:fit-content;" onclick="saveProfile()">Save Changes</button>
          </div>
        </div>

        <div class="card" style="margin-top:16px;">
          <div class="card-title">Plan</div>
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div style="font-size:14px;font-weight:500;" id="plan-label">Free Plan</div>
              <div style="font-size:12px;color:var(--subtext);margin-top:4px;">Upgrade for unlimited analyses and priority monitoring.</div>
            </div>
            <a href="/upgrade" class="btn-gold" style="text-decoration:none;">Upgrade to Pro →</a>
          </div>
        </div>
      </div>
    </section>

  </main>
</div>

<!-- MOBILE NAV -->
<nav class="mobile-nav">
  <button class="mobile-nav-item active" data-page="overview"><span class="nav-icon">◉</span>Overview</button>
  <button class="mobile-nav-item" data-page="analyze"><span class="nav-icon">⚡</span>War Room</button>
  <button class="mobile-nav-item" data-page="socials"><span class="nav-icon">◈</span>Socials</button>
  <button class="mobile-nav-item" data-page="threats"><span class="nav-icon">⚠</span>Threats</button>
  <button class="mobile-nav-item" data-page="reports"><span class="nav-icon">▤</span>Reports</button>
</nav>

<script>
// ── AUTH CHECK ────────────────────────────────────────────────────────────
var token = localStorage.getItem('imprsn8_token') || localStorage.getItem('token');
if (!token) { window.location.href = '/login'; }

var API = '';

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

function logout() {
  localStorage.removeItem('imprsn8_token');
  localStorage.removeItem('token');
  window.location.href = '/login';
}

// ── NAVIGATION ────────────────────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(function(b) { b.classList.remove('active'); });
  var section = document.getElementById('page-' + page);
  if (section) section.classList.add('active');
  document.querySelectorAll('[data-page="' + page + '"]').forEach(function(b) { b.classList.add('active'); });
  history.replaceState(null, '', '#' + page);
  if (page === 'socials') loadSocials();
  else if (page === 'reports') loadReports();
  else if (page === 'threats') loadThreats();
}

document.querySelectorAll('[data-page]').forEach(function(btn) {
  btn.addEventListener('click', function() { showPage(btn.getAttribute('data-page')); });
});

// ── PAGE LOAD ─────────────────────────────────────────────────────────────
(async function init() {
  // Restore from hash
  var hash = location.hash.replace('#', '');
  if (hash && document.getElementById('page-' + hash)) showPage(hash);

  // Load user info
  try {
    var r = await fetch(API + '/api/auth/me', { headers: authHeaders() });
    if (r.status === 401) { logout(); return; }
    var d = await r.json();
    if (d.success && d.data) {
      var u = d.data;
      document.getElementById('sb-email').textContent = u.display_name || u.email || '';
      document.getElementById('sb-plan').textContent = (u.plan || 'free').toUpperCase();
      document.getElementById('set-display-name').value = u.display_name || '';
      document.getElementById('set-email').value = u.email || '';
      document.getElementById('plan-label').textContent =
        u.plan === 'pro' ? 'Pro Plan' : u.plan === 'enterprise' ? 'Enterprise Plan' : 'Free Plan';
    }
  } catch(e) {}

  // Load overview data
  loadOverview();
})();

// ── OVERVIEW ──────────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    var r = await fetch(API + '/api/analyses/score-history?limit=10', { headers: authHeaders() });
    var d = await r.json();
    if (d.success && d.data && d.data.length > 0) {
      var latest = d.data[0];
      var prev = d.data[1];
      var score = latest.impression_score || latest.score || 0;
      animateScoreRing(score);
      document.getElementById('score-caption').textContent =
        'Based on your last analysis on ' + new Date(latest.created_at || latest.analyzed_at).toLocaleDateString();
      if (latest.scores) {
        var s = typeof latest.scores === 'string' ? JSON.parse(latest.scores) : latest.scores;
        document.getElementById('comp-authenticity').textContent = s.authenticity || s.clarity || '—';
        document.getElementById('comp-reach').textContent = s.reach_quality || s.professionalism || '—';
        document.getElementById('comp-sentiment').textContent = s.sentiment || s.impact || '—';
        document.getElementById('comp-threat').textContent = s.threat_exposure || 'Low';
      }
    } else {
      document.getElementById('ring-value').textContent = '—';
    }
  } catch(e) {}

  // Load recent analyses
  try {
    var r2 = await fetch(API + '/api/analyses?limit=5', { headers: authHeaders() });
    var d2 = await r2.json();
    var el = document.getElementById('recent-analyses');
    if (d2.success && d2.data && d2.data.length > 0) {
      el.innerHTML = d2.data.map(function(a) {
        var score = a.impression_score || a.score || '—';
        var date = new Date(a.created_at || a.analyzed_at).toLocaleDateString();
        var type = a.analysis_type || a.type || 'profile';
        return '<div class="analysis-row">' +
          '<div class="analysis-score">' + score + '</div>' +
          '<div class="analysis-meta"><div>' + type.charAt(0).toUpperCase() + type.slice(1) + ' Analysis</div>' +
          '<div class="analysis-date">' + date + '</div></div>' +
          '</div>';
      }).join('');
    } else {
      el.innerHTML = '<div style="font-size:13px;color:var(--subtext);padding:20px 0;">No analyses yet. Head to War Room to run your first.</div>';
    }
  } catch(e) {
    document.getElementById('recent-analyses').innerHTML = '<div style="font-size:13px;color:var(--subtext);">Could not load analyses.</div>';
  }

  // Check threats
  try {
    var r3 = await fetch(API + '/api/threats?status=new&limit=5', { headers: authHeaders() });
    var d3 = await r3.json();
    if (d3.success && d3.data && d3.data.length > 0) {
      var banner = document.getElementById('threat-alert');
      banner.classList.remove('hidden');
      document.getElementById('threat-alert-text').textContent =
        '⚠️ ' + d3.data.length + ' new threat' + (d3.data.length > 1 ? 's' : '') + ' detected this week. Check the Threat Feed.';
    }
  } catch(e) {}
}

function animateScoreRing(score) {
  var circumference = 408; // 2 * pi * 65
  var fill = document.getElementById('ring-fill');
  var valueEl = document.getElementById('ring-value');
  var offset = circumference - (score / 100) * circumference;
  setTimeout(function() {
    fill.style.strokeDashoffset = offset;
  }, 100);
  var v = 0;
  var step = Math.max(1, Math.ceil(score / 60));
  var interval = setInterval(function() {
    v = Math.min(v + step, score);
    valueEl.textContent = v;
    if (v >= score) clearInterval(interval);
  }, 16);
}

// ── WAR ROOM ──────────────────────────────────────────────────────────────
var wrRunning = false;

async function runAnalysis() {
  if (wrRunning) return;
  wrRunning = true;

  var btn = document.getElementById('btn-analyze');
  btn.disabled = true;
  btn.textContent = 'Running...';
  document.getElementById('results-panel').classList.remove('visible');

  var agentLabels = [
    ['Scanning platforms...', '✓ Complete'],
    ['Detecting phishing...', '✓ Complete'],
    ['Reading press...', '✓ Complete'],
    ['Searching dark web...', '✓ Complete'],
    ['Measuring sentiment...', '✓ Complete'],
  ];

  // Animate agents
  var progressEl = document.getElementById('wr-progress');
  for (var i = 0; i < 5; i++) {
    if (i > 0) {
      var prevCard = document.getElementById('wra-' + (i-1));
      var prevStatus = document.getElementById('wrs-' + (i-1));
      prevCard.className = 'wr-agent-card done';
      prevStatus.className = 'wr-agent-status done';
      prevStatus.textContent = agentLabels[i-1][1];
    }
    var card = document.getElementById('wra-' + i);
    var status = document.getElementById('wrs-' + i);
    card.className = 'wr-agent-card scanning';
    status.className = 'wr-agent-status scanning';
    status.textContent = agentLabels[i][0];
    progressEl.style.width = ((i + 1) / 5 * 80) + '%';
    await sleep(1200);
  }

  // Fire actual API call while agents animate
  var analysisResult = null;
  try {
    var r = await fetch(API + '/api/analyze', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ type: 'profile' }),
    });
    var d = await r.json();
    if (d.success && d.data) analysisResult = d.data;
  } catch(e) {}

  // Complete last agent
  var lastCard = document.getElementById('wra-4');
  var lastStatus = document.getElementById('wrs-4');
  lastCard.className = 'wr-agent-card done';
  lastStatus.className = 'wr-agent-status done';
  lastStatus.textContent = agentLabels[4][1];
  progressEl.style.width = '100%';

  // Show results
  showResults(analysisResult);
  wrRunning = false;
  btn.disabled = false;
  btn.textContent = '⚡ Run Full Analysis';

  // Reload overview silently
  loadOverview();
}

function showResults(data) {
  var panel = document.getElementById('results-panel');
  panel.classList.add('visible');

  if (data) {
    var score = data.impression_score || data.score || 0;
    document.getElementById('res-score').textContent = score;
    var deltaEl = document.getElementById('res-delta');
    if (data.score_delta != null) {
      deltaEl.style.display = '';
      deltaEl.textContent = (data.score_delta >= 0 ? '↑ +' : '↓ ') + data.score_delta + ' pts';
    }
    document.getElementById('res-narrative').textContent =
      data.ai_summary || data.summary || 'Analysis complete. Your scores have been updated.';
    var signals = data.signals || data.flags || [];
    document.getElementById('res-signals').innerHTML = signals.map(function(s) {
      var color = s.status === 'pass' ? 'var(--green)' : s.status === 'fail' ? 'var(--red)' : 'var(--gold)';
      return '<div class="signal-item"><div class="signal-dot" style="background:' + color + '"></div>' +
             '<div>' + (s.label || s.type || '') + '</div>' +
             '<div style="margin-left:auto;font-size:12px;color:var(--subtext)">' + (s.value || s.detail || '') + '</div>' +
             '</div>';
    }).join('');
  } else {
    document.getElementById('res-score').textContent = '—';
    document.getElementById('res-narrative').textContent = 'Analysis complete. Check your Overview for updated scores.';
    document.getElementById('res-signals').innerHTML = '';
  }
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

// ── SOCIAL PROFILES ───────────────────────────────────────────────────────
async function loadSocials() {
  var grid = document.getElementById('social-grid');
  try {
    var r = await fetch(API + '/api/socials', { headers: authHeaders() });
    var d = await r.json();
    if (d.success && d.data && d.data.length > 0) {
      var platformIcons = { twitter_x: '𝕏', instagram: '📸', linkedin: '💼', tiktok: '🎵', youtube: '▶️', bluesky: '🦋', github: '🐙' };
      grid.innerHTML = d.data.map(function(s) {
        var icon = platformIcons[s.platform] || '◈';
        return '<div class="social-card connected">' +
          '<div class="social-platform"><span>' + icon + '</span>' + s.platform.charAt(0).toUpperCase() + s.platform.slice(1) + '</div>' +
          '<div class="social-handle">@' + (s.handle || s.username || '') + '</div>' +
          '<div class="social-meta">' +
            (s.follower_count ? formatNum(s.follower_count) + ' followers · ' : '') +
            'Last scanned ' + (s.last_scanned_at ? new Date(s.last_scanned_at).toLocaleDateString() : 'never') +
          '</div>' +
        '</div>';
      }).join('');
    } else {
      grid.innerHTML = '<div class="social-empty" style="grid-column:1/-1;">No profiles connected yet. Connect a platform below to start monitoring.</div>';
    }
  } catch(e) {
    grid.innerHTML = '<div class="social-empty" style="grid-column:1/-1;">Could not load social profiles.</div>';
  }
}

function connectPlatform(platform) {
  var handle = prompt('Enter your ' + platform + ' handle (without @):');
  if (!handle) return;
  fetch(API + '/api/socials', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ platform: platform, handle: handle }),
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) loadSocials();
    else alert(d.error || 'Could not connect profile.');
  }).catch(function() { alert('Network error.'); });
}

function formatNum(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return String(n);
}

// ── THREATS ───────────────────────────────────────────────────────────────
async function loadThreats() {
  var el = document.getElementById('threat-list');
  try {
    var r = await fetch(API + '/api/threats?limit=20', { headers: authHeaders() });
    var d = await r.json();
    if (d.success && d.data && d.data.length > 0) {
      var sevColor = { critical: 'var(--red)', high: '#f97316', medium: '#eab308', low: 'var(--green)' };
      el.innerHTML = d.data.map(function(t) {
        var color = sevColor[t.severity] || 'var(--subtext)';
        return '<div class="analysis-row">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;margin-top:4px;"></div>' +
          '<div style="flex:1;">' +
            '<div style="font-size:13px;">@' + (t.suspect_handle || '') + ' on ' + (t.platform || '') + '</div>' +
            '<div style="font-size:11px;color:var(--subtext);">' + (t.threat_type || '').replace('_',' ') + ' · ' + (t.status || '') + '</div>' +
          '</div>' +
          '<div style="font-size:11px;color:' + color + ';text-transform:uppercase;letter-spacing:0.5px;">' + (t.severity || '') + '</div>' +
        '</div>';
      }).join('');
    } else {
      el.innerHTML = '<div style="font-size:13px;color:var(--subtext);padding:20px 0;">No active threats detected. Your agents are watching.</div>';
    }
  } catch(e) {
    el.innerHTML = '<div style="font-size:13px;color:var(--subtext);">Could not load threat feed.</div>';
  }
}

// ── REPORTS ───────────────────────────────────────────────────────────────
async function loadReports() {
  try {
    var r = await fetch(API + '/api/analyses/score-history?limit=30', { headers: authHeaders() });
    var d = await r.json();
    if (d.success && d.data && d.data.length > 0) {
      drawSparkline(d.data);
    }
  } catch(e) {}

  try {
    var r2 = await fetch(API + '/api/analyses?limit=20', { headers: authHeaders() });
    var d2 = await r2.json();
    var el = document.getElementById('report-list');
    if (d2.success && d2.data && d2.data.length > 0) {
      el.innerHTML = d2.data.map(function(a, i) {
        var score = a.impression_score || a.score || '—';
        var prev = d2.data[i+1] ? (d2.data[i+1].impression_score || d2.data[i+1].score) : null;
        var delta = (prev != null && score !== '—') ? (score - prev) : null;
        var date = new Date(a.created_at || a.analyzed_at).toLocaleDateString('en-US', { month:'long', year:'numeric', day:'numeric' });
        return '<div class="report-row">' +
          '<div class="report-date">' + date + '</div>' +
          '<div class="report-score">' + score + ' / 100</div>' +
          (delta != null ? '<div class="report-delta ' + (delta >= 0 ? 'up' : 'down') + '">' + (delta >= 0 ? '↑ +' : '↓ ') + delta + '</div>' : '<div class="report-delta"></div>') +
        '</div>';
      }).join('');
    } else {
      el.innerHTML = '<div class="report-empty">No analysis history yet.</div>';
    }
  } catch(e) {
    document.getElementById('report-list').innerHTML = '<div class="report-empty">Could not load history.</div>';
  }
}

function drawSparkline(data) {
  var svg = document.getElementById('sparkline-svg');
  if (!data || data.length < 2) { svg.innerHTML = '<text x="300" y="45" text-anchor="middle" fill="var(--subtext)" font-size="12">Not enough data</text>'; return; }

  var scores = data.slice().reverse().map(function(d) { return d.impression_score || d.score || 0; });
  var min = Math.min.apply(null, scores);
  var max = Math.max.apply(null, scores);
  var range = max - min || 1;
  var W = 600, H = 80, pad = 8;

  var pts = scores.map(function(s, i) {
    var x = pad + (i / (scores.length - 1)) * (W - pad*2);
    var y = H - pad - ((s - min) / range) * (H - pad*2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  });

  svg.innerHTML =
    '<polyline fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round" points="' + pts.join(' ') + '"/>' +
    '<polyline fill="rgba(212,175,55,0.08)" stroke="none" points="' + pad + ',' + (H-pad) + ' ' + pts.join(' ') + ' ' + (W-pad) + ',' + (H-pad) + '"/>';
}

// ── SETTINGS ──────────────────────────────────────────────────────────────
async function saveProfile() {
  var name = document.getElementById('set-display-name').value.trim();
  try {
    var r = await fetch(API + '/api/profile', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ display_name: name }),
    });
    var d = await r.json();
    if (d.success) {
      document.getElementById('sb-email').textContent = name || document.getElementById('set-email').value;
      alert('Profile updated.');
    } else {
      alert(d.error || 'Could not save profile.');
    }
  } catch(e) {
    alert('Network error.');
  }
}
</script>

</body></html>`;
}
