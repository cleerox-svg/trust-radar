import { json } from "../lib/cors";
import type { Env } from "../types";

/**
 * Generate a Daily Briefing by querying 9 data tables in parallel,
 * serializing data into compact pipe-delimited format, and building
 * a structured briefing JSON.
 *
 * This is the non-AI version that aggregates data and produces a structured
 * briefing from the raw data itself. The AI-powered version would pipe this
 * through the Lovable AI Gateway.
 */

interface BriefingData {
  threats: unknown[];
  threatNews: unknown[];
  attackMetrics: unknown[];
  socialIocs: unknown[];
  atoEvents: unknown[];
  breachChecks: unknown[];
  torExitNodes: unknown[];
  erasureActions: unknown[];
  ingestionJobs: unknown[];
}

interface GeneratedBriefing {
  summary: {
    totalThreats: number;
    bySeverity: Record<string, number>;
    activeSources: number;
    resolved: number;
    newLast24h: number;
    riskLevel: string;
  };
  topBrands: Array<{
    brand: string;
    impactType: string;
    threatCount: number;
    severity: string;
    summary: string;
    sources: string[];
  }>;
  campaigns: Array<{
    name: string;
    brands: string[];
    domainCount: number;
    severity: string;
    dataPoints: Array<{ source: string; type: string; value: string; context: string }>;
    correlationLogic: string;
  }>;
  topRisks: Array<{
    title: string;
    priority: string;
    description: string;
    evidence: string[];
    actions: string[];
  }>;
  trends: Array<{
    direction: string;
    observation: string;
    significance: string;
  }>;
  feedHealth: {
    healthyCount: number;
    staleFeeds: string[];
    recommendations: string[];
  };
  recommendations: string[];
  actionPlaybook: Array<{
    category: string;
    action: string;
    target: string;
    priority: string;
    context: string;
  }>;
  topThreatTypes: Array<{ type: string; cnt: number }>;
  topSources: Array<{ source: string; cnt: number }>;
  criticalHighlights: Array<{ title: string; type: string; source: string; domain?: string; ip_address?: string }>;
  period: string;
  riskLevel: string;
  generatedAt: string;
}

// ─── Parallel data fetch from 9 tables ──────────────────────────

async function fetchBriefingData(env: Env, hoursBack: number): Promise<BriefingData> {
  const timeFilter = `datetime('now', '-${hoursBack} hours')`;

  const [threats, threatNews, attackMetrics, socialIocs, atoEvents, breachChecks, torExitNodes, erasureActions, ingestionJobs] = await Promise.all([
    // 1. Threats (150 recent)
    env.DB.prepare(`
      SELECT type, title, severity, confidence, status, source, domain, ip_address, country_code, ioc_type, ioc_value, tags, created_at
      FROM threats WHERE created_at >= ${timeFilter}
      ORDER BY created_at DESC LIMIT 150
    `).all().then(r => r.results),

    // 2. Threat News / CISA KEV (30 recent)
    env.DB.prepare(`
      SELECT id, platform AS vendor, author AS product, ioc_type AS severity, context AS description, captured_at
      FROM social_iocs WHERE platform = 'cisa_kev' AND created_at >= ${timeFilter}
      ORDER BY created_at DESC LIMIT 30
    `).all().then(r => r.results).catch(() => []),

    // 3. Attack Metrics (30 recent)
    env.DB.prepare(`
      SELECT provider AS metric_name, service AS category, severity AS value, status, country_code AS country, created_at
      FROM cloud_incidents WHERE created_at >= ${timeFilter}
      ORDER BY created_at DESC LIMIT 30
    `).all().then(r => r.results).catch(() => []),

    // 4. Social IOCs (50 recent)
    env.DB.prepare(`
      SELECT platform, author, ioc_type, ioc_value, confidence, tags, context, captured_at
      FROM social_iocs WHERE created_at >= ${timeFilter}
      ORDER BY created_at DESC LIMIT 50
    `).all().then(r => r.results).catch(() => []),

    // 5. ATO Events (20 recent)
    env.DB.prepare(`
      SELECT event_type, risk_score, ip_address, country_code, status, source, detected_at
      FROM ato_events WHERE created_at >= ${timeFilter}
      ORDER BY created_at DESC LIMIT 20
    `).all().then(r => r.results).catch(() => []),

    // 6. Breach Checks (20 recent)
    env.DB.prepare(`
      SELECT check_type, target, breach_name, severity, source, resolved, checked_at
      FROM breach_entries WHERE created_at >= ${timeFilter}
      ORDER BY created_at DESC LIMIT 20
    `).all().then(r => r.results).catch(() => []),

    // 7. Tor Exit Nodes (50 active)
    env.DB.prepare(`
      SELECT ip_address, first_seen, last_seen
      FROM tor_exit_nodes WHERE last_seen >= ${timeFilter}
      ORDER BY last_seen DESC LIMIT 50
    `).all().then(r => r.results).catch(() => []),

    // 8. Erasure Actions (15 recent)
    env.DB.prepare(`
      SELECT target_type, target_value, provider, method, status, submitted_at, created_at
      FROM erasure_actions WHERE created_at >= ${timeFilter}
      ORDER BY created_at DESC LIMIT 15
    `).all().then(r => r.results).catch(() => []),

    // 9. Ingestion Jobs / Feed Health (30 recent)
    env.DB.prepare(`
      SELECT feed_name, status, items_fetched, items_new, items_error, duration_ms, started_at
      FROM feed_ingestions ORDER BY started_at DESC LIMIT 30
    `).all().then(r => r.results).catch(() => []),
  ]);

  return { threats, threatNews, attackMetrics, socialIocs, atoEvents, breachChecks, torExitNodes, erasureActions, ingestionJobs };
}

// ─── Build structured briefing from raw data ──────────────────────

function buildBriefing(data: BriefingData, hoursBack: number): GeneratedBriefing {
  const threats = data.threats as Array<Record<string, unknown>>;
  const now = new Date().toISOString();

  // Severity counts
  const bySeverity: { critical: number; high: number; medium: number; low: number; info: number; [key: string]: number } = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byDomain: Record<string, { count: number; types: Set<string>; sources: Set<string>; severity: string }> = {};
  let resolved = 0;

  for (const t of threats) {
    const sev = (t.severity as string) ?? "info";
    bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;

    const type = (t.type as string) ?? "unknown";
    byType[type] = (byType[type] ?? 0) + 1;

    const source = (t.source as string) ?? "unknown";
    bySource[source] = (bySource[source] ?? 0) + 1;

    if (t.status === "resolved") resolved++;

    // Track brand/domain activity
    const domain = (t.domain as string);
    if (domain) {
      if (!byDomain[domain]) byDomain[domain] = { count: 0, types: new Set(), sources: new Set(), severity: "low" };
      byDomain[domain].count++;
      byDomain[domain].types.add(type);
      byDomain[domain].sources.add(source);
      const sevRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
      if ((sevRank[sev as keyof typeof sevRank] ?? 0) > (sevRank[byDomain[domain].severity as keyof typeof sevRank] ?? 0)) {
        byDomain[domain].severity = sev;
      }
    }
  }

  // Determine risk level
  const riskLevel = bySeverity.critical > 5 ? "ELEVATED" : bySeverity.critical > 0 || bySeverity.high > 10 ? "GUARDED" : "NORMAL";

  // Top threat types
  const topThreatTypes = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([type, cnt]) => ({ type, cnt }));

  // Top sources
  const topSources = Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([source, cnt]) => ({ source, cnt }));

  // Top 5 impacted brands (domains)
  const topBrands = Object.entries(byDomain)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([brand, info]) => ({
      brand,
      impactType: info.types.size > 1 ? "multiple" : Array.from(info.types)[0] ?? "targeted",
      threatCount: info.count,
      severity: info.severity,
      summary: `${info.count} threats detected across ${info.sources.size} sources`,
      sources: Array.from(info.sources),
    }));

  // Critical highlights
  const criticalHighlights = threats
    .filter((t) => t.severity === "critical")
    .slice(0, 5)
    .map((t) => ({
      title: (t.title as string) ?? "Critical threat",
      type: (t.type as string) ?? "unknown",
      source: (t.source as string) ?? "unknown",
      domain: (t.domain as string) ?? undefined,
      ip_address: (t.ip_address as string) ?? undefined,
    }));

  // Campaign detection — group threats by source + type combinations
  const campaignMap: Record<string, { threats: Array<Record<string, unknown>>; brands: Set<string> }> = {};
  for (const t of threats) {
    const key = `${t.source}:${t.type}`;
    if (!campaignMap[key]) campaignMap[key] = { threats: [], brands: new Set() };
    campaignMap[key].threats.push(t);
    if (t.domain) campaignMap[key].brands.add(t.domain as string);
  }

  const campaigns = Object.entries(campaignMap)
    .filter(([, v]) => v.threats.length >= 3)
    .sort((a, b) => b[1].threats.length - a[1].threats.length)
    .slice(0, 5)
    .map(([key, v]) => {
      const [source, type] = key.split(":");
      return {
        name: `${source} ${type} campaign`,
        brands: Array.from(v.brands).slice(0, 10),
        domainCount: v.brands.size,
        severity: v.threats.some((t) => t.severity === "critical") ? "critical" : v.threats.some((t) => t.severity === "high") ? "high" : "medium",
        dataPoints: v.threats.slice(0, 5).map((t) => ({
          source: (t.source as string) ?? "",
          type: (t.ioc_type as string) ?? "",
          value: (t.ioc_value as string) ?? (t.domain as string) ?? "",
          context: (t.title as string) ?? "",
        })),
        correlationLogic: `${v.threats.length} threats from ${source} all classified as ${type}, targeting ${v.brands.size} unique domains`,
      };
    });

  // Top risks
  const topRisks = [];
  if (bySeverity.critical > 0) {
    topRisks.push({
      title: `${bySeverity.critical} Critical Threats Active`,
      priority: "immediate",
      description: `${bySeverity.critical} critical severity threats detected in the last ${hoursBack}h requiring immediate attention.`,
      evidence: criticalHighlights.map((h) => `${h.type}: ${h.title}`),
      actions: ["Investigate all critical IOCs", "Check if any match internal infrastructure", "Update blocklists"],
    });
  }
  if ((data.atoEvents as unknown[]).length > 0) {
    topRisks.push({
      title: `${(data.atoEvents as unknown[]).length} Account Takeover Events`,
      priority: "immediate",
      description: "Account takeover attempts detected. Review impacted accounts and enforce credential resets.",
      evidence: (data.atoEvents as Array<Record<string, unknown>>).slice(0, 3).map((e) => `${e.event_type} from ${e.ip_address ?? "unknown IP"} (risk: ${e.risk_score})`),
      actions: ["Force password resets on affected accounts", "Review IP reputation", "Enable MFA if not active"],
    });
  }
  if ((data.breachChecks as unknown[]).length > 0) {
    topRisks.push({
      title: `${(data.breachChecks as unknown[]).length} Breach Exposure Entries`,
      priority: "short-term",
      description: "Credentials or email addresses found in breach databases.",
      evidence: (data.breachChecks as Array<Record<string, unknown>>).slice(0, 3).map((b) => `${b.target}: ${b.breach_name} (${b.severity})`),
      actions: ["Notify affected users", "Monitor for credential stuffing", "Rotate exposed credentials"],
    });
  }

  // Feed health
  const feedRuns = data.ingestionJobs as Array<Record<string, unknown>>;
  const successFeeds = feedRuns.filter((f) => f.status === "success");
  const failedFeeds = feedRuns.filter((f) => f.status === "failed");
  const staleFeeds = failedFeeds.map((f) => (f.feed_name as string) ?? "unknown");

  // Trends
  const trends = [];
  if (threats.length > 50) {
    trends.push({ direction: "increasing", observation: `High threat volume: ${threats.length} threats in ${hoursBack}h`, significance: "Above normal ingestion rate — may indicate active campaigns" });
  }
  if (bySeverity.critical > 3) {
    trends.push({ direction: "increasing", observation: "Elevated critical threat count", significance: "Multiple critical severity IOCs suggest coordinated activity" });
  }
  if ((data.torExitNodes as unknown[]).length > 30) {
    trends.push({ direction: "stable", observation: `${(data.torExitNodes as unknown[]).length} active Tor exit nodes tracked`, significance: "Normal Tor network activity" });
  }

  // Action playbook
  const playbook = [];
  for (const c of criticalHighlights.slice(0, 3)) {
    playbook.push({ category: "Investigate", action: "OSINT lookup", target: c.domain ?? c.ip_address ?? c.title, priority: "high", context: `Critical ${c.type} from ${c.source}` });
  }
  for (const b of topBrands.slice(0, 2)) {
    playbook.push({ category: "Defend", action: "Block domain", target: b.brand, priority: b.severity === "critical" ? "high" : "medium", context: `${b.threatCount} threats across ${b.sources.length} feeds` });
  }
  if ((data.erasureActions as unknown[]).length > 0) {
    playbook.push({ category: "Track", action: "Monitor erasure progress", target: `${(data.erasureActions as unknown[]).length} active erasure actions`, priority: "medium", context: "Ensure takedown requests are progressing" });
  }

  // Recommendations
  const recommendations = [];
  if (bySeverity.critical > 0) recommendations.push("Prioritize investigation of all critical-severity IOCs within 4 hours");
  if (staleFeeds.length > 0) recommendations.push(`Investigate stale feeds: ${staleFeeds.slice(0, 3).join(", ")}`);
  if (topBrands.length > 0) recommendations.push(`Focus brand monitoring on top impacted: ${topBrands.map((b) => b.brand).join(", ")}`);
  recommendations.push("Review and update blocklists with newly identified malicious infrastructure");
  if ((data.atoEvents as unknown[]).length > 0) recommendations.push("Conduct credential hygiene audit for exposed accounts");

  return {
    summary: {
      totalThreats: threats.length,
      bySeverity,
      activeSources: Object.keys(bySource).length,
      resolved,
      newLast24h: threats.length,
      riskLevel,
    },
    topBrands,
    campaigns,
    topRisks,
    trends,
    feedHealth: {
      healthyCount: successFeeds.length,
      staleFeeds,
      recommendations: staleFeeds.length > 0 ? [`${staleFeeds.length} feeds have failed recently — check circuit breakers`] : ["All feeds healthy"],
    },
    recommendations,
    actionPlaybook: playbook,
    topThreatTypes,
    topSources,
    criticalHighlights,
    period: `Last ${hoursBack} hours`,
    riskLevel,
    generatedAt: now,
  };
}

// ─── Generate Briefing Handler ───────────────────────────────────

export async function handleGenerateBriefing(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const hoursBack = Math.min(168, Math.max(1, parseInt(url.searchParams.get("hours") ?? "24", 10)));
    const cached = url.searchParams.get("cached") === "true";

    // Check for cached briefing (12h TTL)
    if (cached) {
      const existing = await env.DB.prepare(`
        SELECT * FROM threat_briefings
        WHERE created_at >= datetime('now', '-12 hours')
        ORDER BY created_at DESC LIMIT 1
      `).first();
      if (existing) {
        return json({ success: true, data: existing, cached: true }, 200, origin);
      }
    }

    // Fetch data from all 9 tables in parallel
    const data = await fetchBriefingData(env, hoursBack);
    const briefing = buildBriefing(data, hoursBack);

    // Determine severity
    const severity = briefing.riskLevel === "ELEVATED" ? "critical" : briefing.riskLevel === "GUARDED" ? "high" : "low";
    const title = `Threat Intelligence Briefing — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    // Persist to threat_briefings
    const briefingId = `brief-${Date.now().toString(36)}`;
    await env.DB.prepare(`
      INSERT INTO threat_briefings (id, title, summary, body, severity, category, status, generated_by, published_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'daily', 'published', ?, datetime('now'), datetime('now'))
    `).bind(
      briefingId,
      title,
      `${briefing.summary.totalThreats} threats analyzed across ${briefing.summary.activeSources} sources. Risk level: ${briefing.riskLevel}. ${briefing.summary.bySeverity.critical} critical, ${briefing.summary.bySeverity.high} high severity.`,
      JSON.stringify(briefing),
      severity,
      `user:${userId}`,
    ).run();

    // Return the full briefing
    const stored = await env.DB.prepare("SELECT * FROM threat_briefings WHERE id = ?").bind(briefingId).first();
    return json({ success: true, data: stored, cached: false }, 201, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Briefing History Handler ─────────────────────────────────────

export async function handleListBriefingHistory(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

    const rows = await env.DB.prepare(`
      SELECT id, title, summary, body, severity, category, status, generated_by, published_at, created_at
      FROM threat_briefings ORDER BY created_at DESC LIMIT ?
    `).bind(limit).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
