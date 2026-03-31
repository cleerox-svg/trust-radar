/**
 * Briefing Email Service — sends styled HTML briefing emails via Resend API.
 *
 * Used by the daily cron (8 AM ET / 12:00 UTC) and the manual trigger endpoint.
 */
import { logger } from './logger';
import type { Env } from '../types';

const RECIPIENT = 'claude.leroux@averrow.com';
const FROM_ADDRESS = 'Averrow Platform <briefing@averrow.com>';

// ─── Resend API ────────────────────────────────────────────────

interface ResendResponse {
  id?: string;
  error?: string;
  message?: string;
  statusCode?: number;
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    }),
  });

  const body = await res.json() as ResendResponse;

  if (!res.ok) {
    return { ok: false, error: body.message ?? body.error ?? `HTTP ${res.status}` };
  }

  return { ok: true, id: body.id };
}

// ─── Briefing data types (mirrors briefing.ts GeneratedBriefing) ──

interface BriefingSummary {
  totalThreats: number;
  bySeverity: Record<string, number>;
  activeSources: number;
  resolved: number;
  newLast24h: number;
  riskLevel: string;
}

interface BriefingPayload {
  summary: BriefingSummary;
  topBrands: Array<{ brand: string; threatCount: number; severity: string }>;
  campaigns: Array<{ name: string; domainCount: number; severity: string }>;
  topRisks: Array<{ title: string; priority: string; description: string; actions: string[] }>;
  trends: Array<{ direction: string; observation: string }>;
  feedHealth: { healthyCount: number; staleFeeds: string[] };
  recommendations: string[];
  topThreatTypes: Array<{ type: string; cnt: number }>;
  criticalHighlights: Array<{ title: string; type: string; source: string; domain?: string }>;
  riskLevel: string;
  generatedAt: string;
}

// ─── HTML Template ─────────────────────────────────────────────

function riskBadge(level: string): string {
  const colors: Record<string, { bg: string; text: string }> = {
    ELEVATED: { bg: '#f87171', text: '#ffffff' },
    GUARDED: { bg: '#fb923c', text: '#ffffff' },
    NORMAL: { bg: '#4ade80', text: '#080E18' },
  };
  const c = colors[level] ?? colors['NORMAL'];
  return `<span style="display:inline-block;padding:4px 12px;border-radius:6px;background:${c!.bg};color:${c!.text};font-weight:700;font-size:13px;letter-spacing:0.5px;">${level}</span>`;
}

function sevDot(severity: string): string {
  const colors: Record<string, string> = {
    critical: '#f87171',
    high: '#fb923c',
    medium: '#fbbf24',
    low: '#78A0C8',
    info: '#4ade80',
  };
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[severity] ?? '#78A0C8'};margin-right:6px;"></span>`;
}

function buildBriefingHtml(briefing: BriefingPayload, title: string): string {
  const s = briefing.summary;
  const dateStr = new Date(briefing.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Top risks section
  const risksHtml = briefing.topRisks.length > 0
    ? briefing.topRisks.map(r => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #1a2332;">
            <div style="font-weight:600;color:#F8F7F5;font-size:14px;margin-bottom:4px;">${r.title}</div>
            <div style="color:#78A0C8;font-size:12px;margin-bottom:6px;">${r.description}</div>
            ${r.actions.length > 0 ? `<div style="font-size:11px;color:#7aeaff;">${r.actions.map(a => `&#8227; ${a}`).join('<br>')}</div>` : ''}
          </td>
        </tr>`).join('')
    : '<tr><td style="padding:12px 16px;color:#78A0C8;font-size:13px;">No elevated risks detected.</td></tr>';

  // Top targeted brands
  const brandsHtml = briefing.topBrands.slice(0, 5).map(b => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #1a2332;color:#F8F7F5;font-size:13px;">
        ${sevDot(b.severity)}${b.brand}
      </td>
      <td style="padding:8px 16px;border-bottom:1px solid #1a2332;color:#78A0C8;font-size:13px;text-align:right;font-family:monospace;">
        ${b.threatCount}
      </td>
    </tr>`).join('');

  // Threat types breakdown
  const typesHtml = briefing.topThreatTypes.slice(0, 6).map(t => `
    <tr>
      <td style="padding:6px 16px;border-bottom:1px solid #1a2332;color:#F8F7F5;font-size:12px;">${t.type}</td>
      <td style="padding:6px 16px;border-bottom:1px solid #1a2332;color:#78A0C8;font-size:12px;text-align:right;font-family:monospace;">${t.cnt}</td>
    </tr>`).join('');

  // Campaigns
  const campaignsHtml = briefing.campaigns.length > 0
    ? briefing.campaigns.slice(0, 3).map(c => `
        <div style="padding:8px 0;border-bottom:1px solid #1a2332;">
          ${sevDot(c.severity)}<span style="color:#F8F7F5;font-size:13px;font-weight:500;">${c.name}</span>
          <span style="color:#78A0C8;font-size:11px;margin-left:8px;">${c.domainCount} domains</span>
        </div>`).join('')
    : '<div style="color:#78A0C8;font-size:13px;padding:8px 0;">No active campaigns detected.</div>';

  // Trends
  const trendsHtml = briefing.trends.length > 0
    ? briefing.trends.map(t => {
      const arrow = t.direction === 'increasing' ? '&#9650;' : t.direction === 'decreasing' ? '&#9660;' : '&#9644;';
      const color = t.direction === 'increasing' ? '#f87171' : t.direction === 'decreasing' ? '#4ade80' : '#78A0C8';
      return `<div style="padding:6px 0;color:#F8F7F5;font-size:12px;"><span style="color:${color};margin-right:6px;">${arrow}</span>${t.observation}</div>`;
    }).join('')
    : '';

  // Feed health
  const feedColor = briefing.feedHealth.staleFeeds.length > 0 ? '#fb923c' : '#4ade80';
  const feedStatus = briefing.feedHealth.staleFeeds.length > 0
    ? `${briefing.feedHealth.staleFeeds.length} stale: ${briefing.feedHealth.staleFeeds.slice(0, 3).join(', ')}`
    : 'All feeds healthy';

  // Recommendations
  const recsHtml = briefing.recommendations.map(r =>
    `<li style="padding:4px 0;color:#F8F7F5;font-size:12px;">${r}</li>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#050a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050a12;">
<tr><td align="center" style="padding:24px 16px;">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

  <!-- Header -->
  <tr><td style="padding:24px 24px 16px;background:#080E18;border-radius:12px 12px 0 0;border-bottom:1px solid #1a2332;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#00d4ff;text-transform:uppercase;font-family:monospace;">AVERROW INTELLIGENCE</div>
          <div style="font-size:20px;font-weight:700;color:#F8F7F5;margin-top:4px;">${title}</div>
          <div style="font-size:12px;color:#78A0C8;margin-top:4px;">${dateStr}</div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          ${riskBadge(briefing.riskLevel)}
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Summary stats -->
  <tr><td style="background:#080E18;padding:0 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a2332;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:16px;text-align:center;width:25%;border-right:1px solid #1a2332;">
          <div style="font-size:28px;font-weight:700;color:#F8F7F5;font-family:monospace;">${s.totalThreats}</div>
          <div style="font-size:10px;color:#78A0C8;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Threats</div>
        </td>
        <td style="padding:16px;text-align:center;width:25%;border-right:1px solid #1a2332;">
          <div style="font-size:28px;font-weight:700;color:#f87171;font-family:monospace;">${s.bySeverity.critical ?? 0}</div>
          <div style="font-size:10px;color:#78A0C8;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Critical</div>
        </td>
        <td style="padding:16px;text-align:center;width:25%;border-right:1px solid #1a2332;">
          <div style="font-size:28px;font-weight:700;color:#fb923c;font-family:monospace;">${s.bySeverity.high ?? 0}</div>
          <div style="font-size:10px;color:#78A0C8;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">High</div>
        </td>
        <td style="padding:16px;text-align:center;width:25%;">
          <div style="font-size:28px;font-weight:700;color:#78A0C8;font-family:monospace;">${s.activeSources}</div>
          <div style="font-size:10px;color:#78A0C8;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Sources</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Top Risks -->
  <tr><td style="background:#080E18;padding:20px 24px 0;">
    <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#78A0C8;text-transform:uppercase;font-family:monospace;margin-bottom:8px;">Priority Risks</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a2332;border-radius:8px;overflow:hidden;">
      ${risksHtml}
    </table>
  </td></tr>

  <!-- Two-column: Brands + Threat Types -->
  <tr><td style="background:#080E18;padding:20px 24px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:8px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#78A0C8;text-transform:uppercase;font-family:monospace;margin-bottom:8px;">Top Targeted Brands</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a2332;border-radius:8px;overflow:hidden;">
            ${brandsHtml || '<tr><td style="padding:12px 16px;color:#78A0C8;font-size:12px;">None</td></tr>'}
          </table>
        </td>
        <td style="width:50%;vertical-align:top;padding-left:8px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#78A0C8;text-transform:uppercase;font-family:monospace;margin-bottom:8px;">Threat Types</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a2332;border-radius:8px;overflow:hidden;">
            ${typesHtml || '<tr><td style="padding:12px 16px;color:#78A0C8;font-size:12px;">None</td></tr>'}
          </table>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Campaigns -->
  ${briefing.campaigns.length > 0 ? `
  <tr><td style="background:#080E18;padding:20px 24px 0;">
    <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#78A0C8;text-transform:uppercase;font-family:monospace;margin-bottom:8px;">Active Campaigns</div>
    <div style="border:1px solid #1a2332;border-radius:8px;padding:8px 16px;">
      ${campaignsHtml}
    </div>
  </td></tr>` : ''}

  <!-- Trends -->
  ${trendsHtml ? `
  <tr><td style="background:#080E18;padding:20px 24px 0;">
    <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#78A0C8;text-transform:uppercase;font-family:monospace;margin-bottom:8px;">Trends</div>
    <div style="border:1px solid #1a2332;border-radius:8px;padding:8px 16px;">
      ${trendsHtml}
    </div>
  </td></tr>` : ''}

  <!-- Feed Health -->
  <tr><td style="background:#080E18;padding:20px 24px 0;">
    <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#78A0C8;text-transform:uppercase;font-family:monospace;margin-bottom:8px;">Feed Health</div>
    <div style="border:1px solid #1a2332;border-radius:8px;padding:12px 16px;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${feedColor};margin-right:6px;"></span>
      <span style="color:#F8F7F5;font-size:13px;">${briefing.feedHealth.healthyCount} healthy</span>
      <span style="color:#78A0C8;font-size:12px;margin-left:12px;">${feedStatus}</span>
    </div>
  </td></tr>

  <!-- Recommendations -->
  ${briefing.recommendations.length > 0 ? `
  <tr><td style="background:#080E18;padding:20px 24px 0;">
    <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#78A0C8;text-transform:uppercase;font-family:monospace;margin-bottom:8px;">Recommendations</div>
    <div style="border:1px solid #1a2332;border-radius:8px;padding:8px 16px;">
      <ul style="margin:0;padding-left:16px;">${recsHtml}</ul>
    </div>
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="background:#080E18;padding:24px;border-radius:0 0 12px 12px;border-top:1px solid #1a2332;margin-top:16px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:11px;color:#78A0C8;">
          Averrow Threat Intelligence Platform<br>
          <span style="color:#4a5568;">Generated ${new Date(briefing.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} ET</span>
        </td>
        <td style="text-align:right;">
          <a href="https://averrow.com/v2/briefings" style="color:#00d4ff;font-size:11px;text-decoration:none;">View in Dashboard &#8594;</a>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Public API ────────────────────────────────────────────────

export async function sendBriefingEmail(
  env: Env,
  briefing: BriefingPayload,
  title: string,
): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) {
    logger.warn('briefing_email_skip', { reason: 'RESEND_API_KEY not configured' });
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  const subject = `${briefing.riskLevel === 'ELEVATED' ? '[ELEVATED] ' : ''}${title}`;
  const html = buildBriefingHtml(briefing, title);

  const result = await sendViaResend(env.RESEND_API_KEY, RECIPIENT, subject, html);

  if (result.ok) {
    logger.info('briefing_email_sent', { to: RECIPIENT, resendId: result.id });
  } else {
    logger.error('briefing_email_failed', { to: RECIPIENT, error: result.error });
  }

  return { sent: result.ok, id: result.id, error: result.error };
}
