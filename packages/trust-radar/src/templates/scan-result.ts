export interface ScanRecord {
  id: string;
  url: string;
  domain: string;
  trust_score: number;
  risk_level: string;
  flags: Array<{ type: string; severity: string; detail: string }>;
  metadata: {
    ssl_valid?: boolean;
    virustotal?: { malicious: number; suspicious: number; harmless: number; undetected: number };
    ai_insight?: { summary?: string; explanation?: string; recommendations?: string[] };
  };
  geo_city?: string | null;
  geo_country?: string | null;
  cached: number | boolean;
  created_at: string;
}

function hasFlag(flags: ScanRecord["flags"], type: string): boolean {
  return flags.some((f) => f.type === type);
}

function getFlag(flags: ScanRecord["flags"], type: string) {
  return flags.find((f) => f.type === type);
}

export function renderScanResult(scan: ScanRecord): string {
  const score = scan.trust_score;
  const cls = score >= 70 ? "safe" : score >= 40 ? "warn" : "danger";
  const verdict = score >= 70 ? "Appears Safe" : score >= 40 ? "Suspicious" : "High Risk";
  const verdictColor = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const verdictIcon = score >= 70 ? "✓" : score >= 40 ? "⚠" : "✗";

  const vtData = scan.metadata?.virustotal;
  const vtDetections = vtData?.malicious ?? 0;
  const vtSuspicious = vtData?.suspicious ?? 0;
  const aiInsight = scan.metadata?.ai_insight;

  const signals = [
    {
      label: "SSL / HTTPS",
      value: scan.metadata?.ssl_valid !== false && !hasFlag(scan.flags, "no_ssl") ? "Valid" : "Invalid or missing",
      status: scan.metadata?.ssl_valid !== false && !hasFlag(scan.flags, "no_ssl") ? "pass" : "fail",
      detail: hasFlag(scan.flags, "no_ssl") ? "Site does not use HTTPS" : "",
    },
    {
      label: "VirusTotal",
      value: vtDetections > 0 ? `${vtDetections} detection${vtDetections > 1 ? "s" : ""}` : vtSuspicious > 0 ? `${vtSuspicious} suspicious` : "Clean",
      status: vtDetections > 0 ? "fail" : vtSuspicious > 0 ? "warn" : vtData ? "pass" : "info",
      detail: vtDetections > 0 ? `Flagged as malicious by ${vtDetections} engine${vtDetections > 1 ? "s" : ""}` :
              vtSuspicious > 0 ? `Flagged as suspicious by ${vtSuspicious} engine${vtSuspicious > 1 ? "s" : ""}` : "",
    },
    {
      label: "Domain Pattern",
      value: hasFlag(scan.flags, "typosquatting") ? "Typosquatting detected" :
             hasFlag(scan.flags, "ip_domain") ? "IP address URL" : "Normal",
      status: hasFlag(scan.flags, "typosquatting") ? "fail" : hasFlag(scan.flags, "ip_domain") ? "warn" : "pass",
      detail: getFlag(scan.flags, "typosquatting")?.detail ?? getFlag(scan.flags, "ip_domain")?.detail ?? "",
    },
    {
      label: "Threat Intelligence",
      value: hasFlag(scan.flags, "malicious_url") ? "Known malicious" :
             hasFlag(scan.flags, "suspicious_url") ? "Flagged suspicious" : "No matches",
      status: hasFlag(scan.flags, "malicious_url") ? "fail" : hasFlag(scan.flags, "suspicious_url") ? "warn" : "pass",
      detail: getFlag(scan.flags, "malicious_url")?.detail ?? getFlag(scan.flags, "suspicious_url")?.detail ?? "",
    },
    {
      label: "Scan Origin",
      value: scan.geo_city && scan.geo_country ? `${scan.geo_city}, ${scan.geo_country}` : "Unknown",
      status: "info",
      detail: "",
    },
    {
      label: "Cached Result",
      value: scan.cached ? "Yes (within 24h)" : "Fresh scan",
      status: "info",
      detail: "",
    },
  ];

  const signalDotColor: Record<string, string> = {
    pass: "#22c55e", fail: "#ef4444", warn: "#f59e0b", info: "#64748b",
  };

  const allFlags = scan.flags.filter(
    (f) => !["no_ssl", "malicious_url", "suspicious_url", "ip_domain", "typosquatting"].includes(f.type)
  );

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Scan Report: ${scan.domain} — Trust Radar</title>
  <meta name="description" content="Trust score ${score}/100 for ${scan.domain}. ${verdict}."/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --cyan: #00F5FF; --amber: #F59E0B; --red: #EF4444; --green: #22C55E;
      --navy: #0A0E1A; --surface: #0F1628; --surface2: #1A2340;
      --border: rgba(0,245,255,0.12); --text: #E2E8F0; --subtext: #64748B;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: var(--navy); color: var(--text); font-family: 'Inter', sans-serif; min-height: 100vh; }

    nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 32px; height: 60px; border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100; background: var(--navy);
    }
    .nav-logo { font-family: 'JetBrains Mono', monospace; font-size: 17px; font-weight: 700; color: var(--text); text-decoration: none; }
    .nav-logo span { color: var(--cyan); }
    .nav-back { font-size: 13px; color: var(--subtext); text-decoration: none; transition: color 0.2s; }
    .nav-back:hover { color: var(--text); }

    .page { max-width: 760px; margin: 0 auto; padding: 48px 24px; }

    /* ── HEADER ── */
    .report-header { margin-bottom: 32px; }
    .report-label {
      font-family: 'JetBrains Mono', monospace; font-size: 10px;
      letter-spacing: 2px; text-transform: uppercase; color: var(--subtext); margin-bottom: 12px;
    }
    .report-url {
      font-family: 'JetBrains Mono', monospace; font-size: 13px;
      color: var(--cyan); word-break: break-all; margin-bottom: 6px;
    }
    .report-meta { font-size: 12px; color: var(--subtext); }

    /* ── SCORE CARD ── */
    .score-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 28px 24px;
      display: flex; align-items: center; gap: 24px;
      margin-bottom: 20px;
    }
    .score-ring {
      width: 100px; height: 100px; border-radius: 50%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      border: 4px solid; flex-shrink: 0;
    }
    .score-ring.safe   { border-color: #22c55e; }
    .score-ring.warn   { border-color: #f59e0b; }
    .score-ring.danger { border-color: #ef4444; }
    .score-num {
      font-family: 'JetBrains Mono', monospace; font-size: 32px;
      font-weight: 700; line-height: 1;
    }
    .score-ring.safe   .score-num { color: #22c55e; }
    .score-ring.warn   .score-num { color: #f59e0b; }
    .score-ring.danger .score-num { color: #ef4444; }
    .score-denom { font-size: 12px; color: var(--subtext); }
    .score-meta { flex: 1; }
    .score-verdict { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .score-domain { font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--subtext); }

    /* ── AI INSIGHT ── */
    .ai-insight {
      background: var(--surface); border: 1px solid rgba(0,245,255,0.2);
      border-radius: 10px; padding: 20px 22px; margin-bottom: 20px;
    }
    .ai-label {
      font-family: 'JetBrains Mono', monospace; font-size: 10px;
      letter-spacing: 2px; text-transform: uppercase; color: var(--cyan);
      margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
    }
    .ai-summary { font-size: 14px; line-height: 1.65; color: var(--text); margin-bottom: 10px; }
    .ai-explanation { font-size: 13px; line-height: 1.6; color: var(--subtext); }
    .ai-recs { margin-top: 12px; }
    .ai-recs-label { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
    .ai-rec {
      font-size: 12px; color: var(--subtext); padding: 4px 0;
      display: flex; gap: 8px; align-items: flex-start;
    }
    .ai-rec::before { content: '→'; color: var(--cyan); flex-shrink: 0; }

    /* ── SIGNALS ── */
    .signals-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 20px 22px; margin-bottom: 20px;
    }
    .signals-title {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      letter-spacing: 1.5px; text-transform: uppercase; color: var(--subtext);
      margin-bottom: 16px;
    }
    .signal-row {
      display: grid; grid-template-columns: 8px 140px 1fr;
      align-items: center; gap: 12px;
      padding: 9px 0; border-bottom: 1px solid var(--border);
    }
    .signal-row:last-child { border-bottom: none; }
    .signal-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .signal-label { font-size: 13px; font-weight: 500; color: var(--text); }
    .signal-value-wrap { display: flex; flex-direction: column; gap: 2px; }
    .signal-value { font-size: 13px; color: var(--subtext); font-family: 'JetBrains Mono', monospace; }
    .signal-detail { font-size: 11px; color: var(--subtext); opacity: 0.7; }

    /* ── OTHER FLAGS ── */
    .flags-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 20px 22px; margin-bottom: 20px;
    }
    .flag-row {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px;
    }
    .flag-row:last-child { border-bottom: none; }
    .flag-severity {
      font-size: 10px; font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase; letter-spacing: 0.5px;
      padding: 2px 6px; border-radius: 4px; flex-shrink: 0; margin-top: 1px;
    }
    .flag-severity.critical { background: rgba(239,68,68,0.15); color: #ef4444; }
    .flag-severity.high     { background: rgba(249,115,22,0.15); color: #f97316; }
    .flag-severity.medium   { background: rgba(234,179,8,0.15);  color: #eab308; }
    .flag-severity.low      { background: rgba(34,197,94,0.15);  color: #22c55e; }

    /* ── ACTIONS ── */
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
    .btn-ghost {
      padding: 8px 16px; border-radius: 6px;
      border: 1px solid var(--border); background: transparent; color: var(--text);
      font-family: 'Inter', sans-serif; font-size: 13px;
      cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
      transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: var(--cyan); color: var(--cyan); }
    .btn-primary {
      padding: 8px 16px; border-radius: 6px; border: none;
      background: var(--cyan); color: #0A0E1A;
      font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
      cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
      transition: opacity 0.15s;
    }
    .btn-primary:hover { opacity: 0.88; }
  </style>
</head>
<body>

<nav>
  <a href="/" class="nav-logo">Trust<span>Radar</span></a>
  <a href="/" class="nav-back">← Back to scanner</a>
</nav>

<div class="page">

  <div class="report-header">
    <div class="report-label">Scan Report</div>
    <div class="report-url">${scan.url}</div>
    <div class="report-meta">Scanned ${new Date(scan.created_at).toLocaleString()} · ID: ${scan.id.slice(0, 8)}</div>
  </div>

  <div class="score-card">
    <div class="score-ring ${cls}">
      <div class="score-num">${score}</div>
      <div class="score-denom">/ 100</div>
    </div>
    <div class="score-meta">
      <div class="score-verdict" style="color:${verdictColor}">${verdictIcon} ${verdict}</div>
      <div class="score-domain">${scan.domain}</div>
    </div>
  </div>

  ${aiInsight ? `
  <div class="ai-insight">
    <div class="ai-label">⚡ AI Insight</div>
    ${aiInsight.summary ? `<div class="ai-summary">${aiInsight.summary}</div>` : ""}
    ${aiInsight.explanation ? `<div class="ai-explanation">${aiInsight.explanation}</div>` : ""}
    ${aiInsight.recommendations?.length ? `
    <div class="ai-recs">
      <div class="ai-recs-label">Recommendations</div>
      ${aiInsight.recommendations.map((r) => `<div class="ai-rec">${r}</div>`).join("")}
    </div>` : ""}
  </div>` : ""}

  <div class="signals-card">
    <div class="signals-title">Signal Breakdown</div>
    ${signals.map((s) => `
    <div class="signal-row">
      <div class="signal-dot" style="background:${signalDotColor[s.status] ?? "#64748b"}"></div>
      <div class="signal-label">${s.label}</div>
      <div class="signal-value-wrap">
        <div class="signal-value">${s.value}</div>
        ${s.detail ? `<div class="signal-detail">${s.detail}</div>` : ""}
      </div>
    </div>`).join("")}
  </div>

  ${allFlags.length > 0 ? `
  <div class="flags-card">
    <div class="signals-title">Additional Flags</div>
    ${allFlags.map((f) => `
    <div class="flag-row">
      <span class="flag-severity ${f.severity}">${f.severity}</span>
      <span>${f.detail || f.type}</span>
    </div>`).join("")}
  </div>` : ""}

  <div class="actions">
    <a href="/" class="btn-primary">Scan another URL</a>
    <button class="btn-ghost" onclick="copyLink()">Copy Report Link</button>
    <a href="/register" class="btn-ghost">Sign up for full history</a>
  </div>

</div>

<script>
function copyLink() {
  navigator.clipboard.writeText(window.location.href)
    .then(() => { const btn = event.target; btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy Report Link', 2000); })
    .catch(() => {});
}
</script>
</body></html>`;
}
