/**
 * Observer Agent — Trend analysis & daily intelligence synthesis.
 *
 * Runs daily. Generates narrative intelligence briefings by analyzing threat
 * trends, brand targeting patterns, provider behavior, and recent agent outputs.
 * Sends context to Haiku for 3-5 professional intelligence briefing items.
 * Writes to agent_outputs for analyst consumption on the HUD and insights panel.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { generateInsight, checkCostGuard } from "../lib/haiku";
import { createNotification } from "../lib/notifications";

export const observerAgent: AgentModule = {
  name: "observer",
  displayName: "Observer",
  description: "Trend analysis & daily intelligence synthesis",
  color: "#78A0C8",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    // Cost guard: observer is non-critical
    const blocked = await checkCostGuard(env, false);
    if (blocked) {
      return { itemsProcessed: 0, itemsCreated: 0, itemsUpdated: 0, output: { skipped: true, reason: blocked } };
    }

    let totalTokens = 0;
    let model: string | undefined;
    const outputs: AgentOutputEntry[] = [];

    // ─── Gather threat summary (last 24h) ────────────────────────
    const summary = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_24h,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        COUNT(DISTINCT source_feed) as feed_count,
        COUNT(DISTINCT threat_type) as type_count,
        COUNT(DISTINCT country_code) as country_count
      FROM threats WHERE created_at >= datetime('now', '-24 hours')
    `).first<{
      total_24h: number; critical: number; high: number;
      feed_count: number; type_count: number; country_count: number;
    }>();

    // ─── Enrichment validation summary (SURBL + VT + GSB + DBL, last 24h) ────
    const enrichmentSummary = await env.DB.prepare(`
      SELECT
        SUM(CASE WHEN surbl_listed = 1 THEN 1 ELSE 0 END) as surbl_confirmed_today,
        SUM(CASE WHEN vt_malicious > 0 THEN 1 ELSE 0 END) as vt_flagged_today,
        SUM(CASE WHEN vt_malicious > 5 THEN 1 ELSE 0 END) as vt_critical_today,
        SUM(CASE WHEN gsb_flagged = 1 AND first_seen >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) as gsb_24h,
        SUM(CASE WHEN dbl_listed = 1 AND first_seen >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) as dbl_24h
      FROM threats
      WHERE first_seen >= datetime('now', '-24 hours')
    `).first<{
      surbl_confirmed_today: number;
      vt_flagged_today: number;
      vt_critical_today: number;
      gsb_24h: number;
      dbl_24h: number;
    }>();

    const surblConfirmed = enrichmentSummary?.surbl_confirmed_today ?? 0;
    const vtFlagged = enrichmentSummary?.vt_flagged_today ?? 0;
    const vtCritical = enrichmentSummary?.vt_critical_today ?? 0;
    const gsb24h = enrichmentSummary?.gsb_24h ?? 0;
    const dbl24h = enrichmentSummary?.dbl_24h ?? 0;
    const enrichmentParts: string[] = [];
    if (surblConfirmed > 0) enrichmentParts.push(`${surblConfirmed} confirmed by SURBL`);
    if (vtFlagged > 0) enrichmentParts.push(`${vtFlagged} flagged by VirusTotal (${vtCritical} critical)`);
    if (gsb24h > 0) enrichmentParts.push(`${gsb24h} confirmed by Google Safe Browsing`);
    if (dbl24h > 0) enrichmentParts.push(`${dbl24h} confirmed by Spamhaus DBL`);
    const enrichmentContext = enrichmentParts.length > 0
      ? `External validation: ${enrichmentParts.join(', ')}.`
      : '';

    // ─── Top targeted brands (with IDs for linking) ──────────────
    const topBrands = await env.DB.prepare(`
      SELECT b.id, b.name, COUNT(*) as count
      FROM threats t JOIN brands b ON t.target_brand_id = b.id
      WHERE t.created_at >= datetime('now', '-24 hours')
      GROUP BY b.id ORDER BY count DESC LIMIT 10
    `).all<{ id: string; name: string; count: number }>();

    // ─── Top hosting providers ───────────────────────────────────
    const topProviders = await env.DB.prepare(`
      SELECT hp.name, COUNT(*) as count
      FROM threats t JOIN hosting_providers hp ON t.hosting_provider_id = hp.id
      WHERE t.created_at >= datetime('now', '-24 hours')
      GROUP BY hp.name ORDER BY count DESC LIMIT 10
    `).all<{ name: string; count: number }>();

    // ─── Threat type distribution ────────────────────────────────
    const typeBreakdown = await env.DB.prepare(`
      SELECT threat_type, COUNT(*) as count
      FROM threats WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY threat_type ORDER BY count DESC
    `).all<{ threat_type: string; count: number }>();

    // ─── Compare with previous day ───────────────────────────────
    const prevSummary = await env.DB.prepare(`
      SELECT COUNT(*) as total_prev
      FROM threats WHERE created_at >= datetime('now', '-48 hours') AND created_at < datetime('now', '-24 hours')
    `).first<{ total_prev: number }>();

    const totalNow = summary?.total_24h ?? 0;
    const totalPrev = prevSummary?.total_prev ?? 0;
    const changePercent = totalPrev > 0 ? Math.round(((totalNow - totalPrev) / totalPrev) * 100) : 0;

    // ─── Recent campaigns ────────────────────────────────────────
    const recentCampaigns = await env.DB.prepare(
      `SELECT id, name, threat_count FROM campaigns
       WHERE last_seen >= datetime('now', '-48 hours') AND status = 'active'
       ORDER BY threat_count DESC LIMIT 10`
    ).all<{ id: string; name: string; threat_count: number }>();

    // ─── Recent agent outputs for context ────────────────────────
    const recentOutputs = await env.DB.prepare(`
      SELECT agent_id as agent, summary
      FROM agent_outputs
      WHERE agent_id != 'observer' AND created_at >= datetime('now', '-24 hours')
      ORDER BY created_at DESC LIMIT 10
    `).all<{ agent: string; summary: string }>();

    // ─── Email security posture ───────────────────────────────────
    const emailGradeDistribution = await env.DB.prepare(`
      SELECT email_security_grade AS grade, COUNT(*) AS count
      FROM brands
      WHERE email_security_grade IS NOT NULL
      GROUP BY email_security_grade
      ORDER BY count DESC
    `).all<{ grade: string; count: number }>();

    const emailAtRiskBrands = await env.DB.prepare(`
      SELECT b.name, b.email_security_grade, COUNT(t.id) AS threat_count
      FROM brands b
      JOIN threats t ON t.target_brand_id = b.id AND t.status = 'active'
      WHERE b.email_security_grade IN ('F', 'D')
      GROUP BY b.id
      ORDER BY threat_count DESC
      LIMIT 5
    `).all<{ name: string; email_security_grade: string; threat_count: number }>();

    // ─── Email grade changes since last briefing ────────────────
    const emailGradeChanges = await env.DB.prepare(`
      SELECT b.name, b.email_security_grade AS current_grade,
             ess.email_security_grade AS previous_grade
      FROM brands b
      JOIN email_security_scans ess ON ess.brand_id = b.id
      WHERE b.email_security_grade IS NOT NULL
        AND ess.email_security_grade IS NOT NULL
        AND b.email_security_grade != ess.email_security_grade
        AND ess.scanned_at < b.email_security_scanned_at
        AND ess.scanned_at >= datetime('now', '-24 hours')
      ORDER BY b.name
      LIMIT 20
    `).all<{ name: string; current_grade: string; previous_grade: string }>();

    const totalEmailScanned = emailGradeDistribution.results.reduce((s, r) => s + r.count, 0);
    const gradeDistStr = emailGradeDistribution.results.map(r => `${r.grade}: ${r.count}`).join(', ');
    const gradeChangesStr = emailGradeChanges.results.length > 0
      ? ` Grade changes (last 24h): ${emailGradeChanges.results.map(c => `${c.name}: ${c.previous_grade} -> ${c.current_grade}`).join(', ')}.`
      : '';
    const emailSecurityContext = `Email Security: ${totalEmailScanned} brands scanned. Grade distribution: ${gradeDistStr || 'none yet'}.${gradeChangesStr} At-risk brands (weak email + active threats): ${emailAtRiskBrands.results.map(b => `${b.name} (${b.email_security_grade}, ${b.threat_count} threats)`).join(', ') || 'none'}.`;

    // ─── Recent threat narratives ──────────────────────────────────
    let narrativeContext = "";
    try {
      const recentNarratives = await env.DB.prepare(`
        SELECT tn.title, tn.severity, tn.attack_stage, tn.summary, tn.signal_types,
               tn.confidence, b.name AS brand_name
        FROM threat_narratives tn
        JOIN brands b ON b.id = tn.brand_id
        WHERE tn.created_at >= datetime('now', '-24 hours') AND tn.status = 'active'
        ORDER BY CASE tn.severity
          WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4
        END, tn.created_at DESC
        LIMIT 10
      `).all<{
        title: string; severity: string; attack_stage: string; summary: string;
        signal_types: string; confidence: number; brand_name: string;
      }>();

      if (recentNarratives.results.length > 0) {
        narrativeContext = `Threat Narratives (last 24h): ${recentNarratives.results.length} generated. ` +
          recentNarratives.results.map(n =>
            `${n.brand_name}: "${n.title}" (${n.severity}, stage: ${n.attack_stage}, confidence: ${n.confidence}%)`
          ).join("; ") + ".";
      }
    } catch { /* threat_narratives table may not exist yet */ }

    // ─── Social monitoring findings summary (unified model) ─────────
    let socialMonitorContext = "";
    let socialSummaryData: {
      impersonations: number; suspicious: number; platforms: number;
      brands_affected: number; takedown_recommended: number; new_24h: number;
    } | null = null;
    try {
      const socialSummary = await env.DB.prepare(`
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT sp.brand_id) AS brands_affected,
          COUNT(DISTINCT sp.platform) AS platforms,
          SUM(CASE WHEN sp.classification = 'impersonation' AND sp.status = 'active' THEN 1 ELSE 0 END) AS impersonations,
          SUM(CASE WHEN sp.classification = 'suspicious' AND sp.status = 'active' THEN 1 ELSE 0 END) AS suspicious,
          SUM(CASE WHEN sp.ai_action = 'takedown' AND sp.status = 'active' THEN 1 ELSE 0 END) AS takedown_recommended,
          SUM(CASE WHEN sp.created_at >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS new_24h
        FROM social_profiles sp
        WHERE sp.status = 'active'
          AND sp.classification IN ('suspicious', 'impersonation')
      `).first<{
        total: number; brands_affected: number; platforms: number;
        impersonations: number; suspicious: number; takedown_recommended: number; new_24h: number;
      }>();

      if (socialSummary && (socialSummary.impersonations > 0 || socialSummary.suspicious > 0)) {
        socialSummaryData = socialSummary;

        const topImpersonations = await env.DB.prepare(`
          SELECT sp.platform, sp.handle, sp.severity, sp.ai_confidence,
                 sp.classification_reason, b.name AS brand_name
          FROM social_profiles sp
          JOIN brands b ON b.id = sp.brand_id
          WHERE sp.status = 'active'
            AND sp.classification IN ('suspicious', 'impersonation')
          ORDER BY
            CASE sp.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
            sp.ai_confidence DESC
          LIMIT 5
        `).all<{
          platform: string; handle: string; severity: string;
          ai_confidence: number | null; classification_reason: string | null; brand_name: string;
        }>();

        socialMonitorContext = `Social Impersonation Monitoring: ${socialSummary.impersonations} confirmed impersonation accounts and ${socialSummary.suspicious} suspicious profiles detected across ${socialSummary.platforms} platforms targeting ${socialSummary.brands_affected} brands. ${socialSummary.takedown_recommended} profiles recommended for takedown. ${socialSummary.new_24h} new detections in the last 24 hours.`;

        if (topImpersonations.results.length > 0) {
          socialMonitorContext += ` Top alerts: ${topImpersonations.results.map(s =>
            `@${s.handle} on ${s.platform} targeting ${s.brand_name} [${s.severity}]`
          ).join('; ')}.`;
        }
      }
    } catch (err) {
      console.warn("[observer] social query error:", String(err));
    }

    // ─── Lookalike domain changes ────────────────────────────────
    let lookalikeContext = "";
    try {
      const lookalikeSummary = await env.DB.prepare(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN registered = 1 THEN 1 ELSE 0 END) as registered,
          SUM(CASE WHEN has_content = 1 THEN 1 ELSE 0 END) as with_content,
          SUM(CASE WHEN mx_records IS NOT NULL AND mx_records != '' THEN 1 ELSE 0 END) as with_mx,
          COUNT(DISTINCT brand_id) as brands
        FROM lookalike_domains
        WHERE created_at >= datetime('now', '-24 hours')
      `).first<{ total: number; registered: number; with_content: number; with_mx: number; brands: number }>();

      if (lookalikeSummary && lookalikeSummary.total > 0) {
        const newRegistered = await env.DB.prepare(`
          SELECT ld.domain, b.name AS brand_name
          FROM lookalike_domains ld
          JOIN brands b ON b.id = ld.brand_id
          WHERE ld.created_at >= datetime('now', '-24 hours') AND ld.registered = 1
          ORDER BY ld.created_at DESC
          LIMIT 10
        `).all<{ domain: string; brand_name: string }>();

        lookalikeContext = `Lookalike Domains (24h): ${lookalikeSummary.total} checked, ${lookalikeSummary.registered} registered, ` +
          `${lookalikeSummary.with_content} with content, ${lookalikeSummary.with_mx} with MX records, targeting ${lookalikeSummary.brands} brands.`;
        if (newRegistered.results.length > 0) {
          lookalikeContext += ` Newly registered: ${newRegistered.results.map(d =>
            `${d.domain} (${d.brand_name})`
          ).join(", ")}.`;
        }
      }
    } catch { /* lookalike_domains table may not exist yet */ }

    // ─── CT certificate findings ──────────────────────────────────
    let ctCertContext = "";
    try {
      const ctSummary = await env.DB.prepare(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN suspicious = 1 THEN 1 ELSE 0 END) as suspicious,
          COUNT(DISTINCT brand_id) as brands
        FROM ct_certificates
        WHERE not_before >= datetime('now', '-24 hours')
      `).first<{ total: number; suspicious: number; brands: number }>();

      if (ctSummary && ctSummary.suspicious > 0) {
        const suspiciousCerts = await env.DB.prepare(`
          SELECT ct.domain, ct.issuer, ct.san_count, b.name AS brand_name
          FROM ct_certificates ct
          JOIN brands b ON b.id = ct.brand_id
          WHERE ct.suspicious = 1 AND ct.not_before >= datetime('now', '-24 hours')
          ORDER BY ct.san_count DESC
          LIMIT 5
        `).all<{ domain: string; issuer: string; san_count: number; brand_name: string }>();

        ctCertContext = `Certificate Transparency (24h): ${ctSummary.total} certificates observed, ${ctSummary.suspicious} suspicious across ${ctSummary.brands} brands.`;
        if (suspiciousCerts.results.length > 0) {
          ctCertContext += ` Suspicious: ${suspiciousCerts.results.map(c =>
            `${c.domain} (issuer: ${c.issuer}, SANs: ${c.san_count}, brand: ${c.brand_name})`
          ).join("; ")}.`;
        }
      }
    } catch { /* ct_certificates table may not exist yet */ }

    // ─── Spam trap network summary ──────────────────────────────
    let spamTrapContext = "";
    try {
      const trapSummary = await env.DB.prepare(`
        SELECT COUNT(*) as total,
          COUNT(DISTINCT spoofed_brand_id) as brands,
          COUNT(DISTINCT sending_ip) as ips
        FROM spam_trap_captures
        WHERE captured_at > datetime('now', '-24 hours')
      `).first<{ total: number; brands: number; ips: number }>();
      if (trapSummary && trapSummary.total > 0) {
        spamTrapContext = `Spam trap network: Caught ${trapSummary.total} emails targeting ${trapSummary.brands} brands from ${trapSummary.ips} unique IPs in the last 24 hours.`;
      }
    } catch { /* spam trap tables may not exist yet */ }

    // ─── Threat feed signals (from threat_signals table) ──────────
    let threatFeedContext = "";
    try {
      const feedSignals24h = await env.DB.prepare(`
        SELECT source, COUNT(*) as count
        FROM threat_signals
        WHERE created_at >= datetime('now', '-24 hours')
        GROUP BY source
        ORDER BY count DESC
      `).all<{ source: string; count: number }>();

      const feedMatches24h = await env.DB.prepare(`
        SELECT COUNT(*) as n FROM threat_signals
        WHERE brand_match_id IS NOT NULL AND created_at >= datetime('now', '-24 hours')
      `).first<{ n: number }>();

      if (feedSignals24h.results.length > 0) {
        const feedBreakdown = feedSignals24h.results.map(r => `${r.source}: ${r.count}`).join(", ");
        threatFeedContext = `Threat feed signals (24h): ${feedBreakdown}. Brand matches: ${feedMatches24h?.n ?? 0}.`;
      }
    } catch { /* threat_signals table may not exist yet */ }

    // ─── High-risk brand assessments ─────────────────────────────
    let highRiskContext = "";
    try {
      const highRiskBrands = await env.DB.prepare(`
        SELECT bta.brand_id, b.name, bta.composite_risk_score, bta.risk_level, bta.threat_summary
        FROM brand_threat_assessments bta
        JOIN brands b ON b.id = bta.brand_id
        WHERE bta.composite_risk_score > 60
          AND bta.assessed_at >= datetime('now', '-48 hours')
        ORDER BY bta.composite_risk_score DESC
        LIMIT 5
      `).all<{
        brand_id: string; name: string; composite_risk_score: number;
        risk_level: string; threat_summary: string | null;
      }>();

      if (highRiskBrands.results.length > 0) {
        highRiskContext = `High-risk brands: ${highRiskBrands.results.map(b =>
          `${b.name} (score: ${b.composite_risk_score}, ${b.risk_level})`
        ).join(", ")}.`;
      }
    } catch { /* brand_threat_assessments table may not exist yet */ }

    // ─── Send to Haiku for intelligence briefing ─────────────────
    const insightResult = await generateInsight(env, {
      period: "daily",
      threats_summary: {
        total_24h: totalNow,
        critical: summary?.critical ?? 0,
        high: summary?.high ?? 0,
        change_percent: changePercent,
        previous_day_total: totalPrev,
        feed_count: summary?.feed_count ?? 0,
        country_count: summary?.country_count ?? 0,
      },
      top_brands: topBrands.results,
      top_providers: topProviders.results,
      trend_data: { prev_day_total: totalPrev, change_percent: changePercent },
      type_distribution: typeBreakdown.results,
      recent_campaigns: recentCampaigns.results,
      agent_context: recentOutputs.results,
      email_security_summary: emailSecurityContext,
      spam_trap_summary: spamTrapContext,
      threat_feed_summary: threatFeedContext,
      high_risk_brands_summary: highRiskContext,
      narrative_summary: narrativeContext,
      social_monitor_summary: socialMonitorContext,
      lookalike_domain_summary: lookalikeContext,
      ct_certificate_summary: ctCertContext,
      enrichment_validation_summary: enrichmentContext,
    });

    if (insightResult.success && insightResult.data?.items?.length) {
      if (insightResult.tokens_used) totalTokens += insightResult.tokens_used;
      if (insightResult.model) model = insightResult.model;

      // Each briefing item becomes a separate agent_output with type='insight'
      for (const item of insightResult.data.items) {
        const severity = (["critical", "high", "medium", "low", "info"].includes(item.severity)
          ? item.severity : "medium") as "critical" | "high" | "medium" | "low" | "info";

        const output: AgentOutputEntry = {
          type: "insight",
          summary: `**${item.title}** — ${item.summary}`,
          severity,
          details: { title: item.title },
        };

        if (item.related_brand_id) {
          output.relatedBrandIds = [item.related_brand_id];
        }
        if (item.related_campaign_id) {
          output.relatedCampaignId = item.related_campaign_id;
        }

        outputs.push(output);
      }
    } else {
      // Fallback: generate rule-based briefing items when Haiku is unavailable
      const trendLabel = changePercent > 20 ? "Significant increase" :
        changePercent > 0 ? "Slight increase" :
        changePercent < -20 ? "Notable decrease" :
        changePercent < 0 ? "Slight decrease" : "Stable";

      const topBrand = topBrands.results[0];
      const topProvider = topProviders.results[0];

      // Item 1: Overall threat landscape
      outputs.push({
        type: "insight",
        summary: `**Daily Threat Landscape** — ${totalNow} threats detected in the last 24 hours (${trendLabel}, ${changePercent > 0 ? "+" : ""}${changePercent}% vs previous day). ${summary?.critical ?? 0} critical and ${summary?.high ?? 0} high severity threats identified across ${summary?.feed_count ?? 0} feed sources and ${summary?.country_count ?? 0} countries.`,
        severity: (summary?.critical ?? 0) > 0 ? "high" : "medium",
        details: {
          title: "Daily Threat Landscape",
          total_threats: totalNow,
          change_percent: changePercent,
        },
      });

      // Item 2: Top targeted brand (if any)
      if (topBrand) {
        outputs.push({
          type: "insight",
          summary: `**${topBrand.name} Under Active Targeting** — ${topBrand.count} new threats targeting ${topBrand.name} in the last 24 hours, making it the most-targeted brand this period.${topProvider ? ` Primary hosting infrastructure: ${topProvider.name}.` : ""}`,
          severity: topBrand.count >= 10 ? "high" : "medium",
          details: { title: `${topBrand.name} Under Active Targeting` },
          relatedBrandIds: [topBrand.id],
        });
      }

      // Item 3: New campaigns
      for (const campaign of recentCampaigns.results.slice(0, 2)) {
        outputs.push({
          type: "insight",
          summary: `**Campaign: ${campaign.name}** — Active campaign with ${campaign.threat_count} associated threats. Infrastructure analysis suggests coordinated targeting activity.`,
          severity: campaign.threat_count >= 10 ? "high" : "medium",
          details: { title: `Campaign: ${campaign.name}` },
          relatedCampaignId: campaign.id,
        });
      }

      // Item: Enrichment validation (SURBL + VT)
      if (enrichmentContext) {
        outputs.push({
          type: 'insight',
          summary: `**Enrichment Validation** — ${enrichmentContext}`,
          severity: vtCritical > 0 ? 'high' : 'medium',
          details: {
            title: 'Enrichment Validation',
            surbl_confirmed: surblConfirmed,
            vt_flagged: vtFlagged,
            vt_critical: vtCritical,
          },
        });
      }

      // Item: Threat feed signals
      if (threatFeedContext) {
        outputs.push({
          type: 'insight',
          summary: `**Threat Feed Intelligence** — ${threatFeedContext}${highRiskContext ? ` ${highRiskContext}` : ''}`,
          severity: highRiskContext ? 'high' : 'info',
          details: { title: 'Threat Feed Intelligence' },
        });
      }

      // Item: Threat narratives summary
      if (narrativeContext) {
        outputs.push({
          type: 'insight',
          summary: `**Threat Narratives** — ${narrativeContext}`,
          severity: narrativeContext.includes('CRITICAL') ? 'critical' : narrativeContext.includes('HIGH') ? 'high' : 'medium',
          details: { title: 'Threat Narratives' },
        });
      }

      // Item: Social impersonation findings
      if (socialMonitorContext) {
        const socialSev = socialSummaryData
          ? (socialSummaryData.impersonations >= 5 ? 'critical'
            : socialSummaryData.impersonations >= 2 ? 'high' : 'medium')
          : 'medium';
        outputs.push({
          type: 'insight',
          summary: `**Social Impersonation Activity** — ${socialMonitorContext}`,
          severity: socialSev as "critical" | "high" | "medium",
          details: {
            title: 'Social Impersonation Activity',
            category: 'social_impersonation',
            impersonation_count: socialSummaryData?.impersonations ?? 0,
            suspicious_count: socialSummaryData?.suspicious ?? 0,
            brands_affected: socialSummaryData?.brands_affected ?? 0,
            takedown_recommended: socialSummaryData?.takedown_recommended ?? 0,
            recommendations: [
              'Review flagged impersonation accounts in the Social Profiles panel',
              'File takedown requests for AI-confirmed impersonation accounts',
              'Verify official handles are registered on all major platforms',
            ],
          },
        });
      }

      // Item: Lookalike domain changes
      if (lookalikeContext) {
        outputs.push({
          type: 'insight',
          summary: `**Lookalike Domain Activity** — ${lookalikeContext}`,
          severity: lookalikeContext.includes('with content') ? 'high' : 'medium',
          details: { title: 'Lookalike Domain Activity' },
        });
      }

      // Item: CT certificate findings
      if (ctCertContext) {
        outputs.push({
          type: 'insight',
          summary: `**Certificate Transparency Findings** — ${ctCertContext}`,
          severity: 'medium',
          details: { title: 'Certificate Transparency Findings' },
        });
      }

      // Item: Email security posture
      if (totalEmailScanned > 0) {
        const atRisk = emailAtRiskBrands.results;
        const changes = emailGradeChanges.results;
        outputs.push({
          type: 'insight',
          summary: `**Email Security Posture** — ${emailSecurityContext}${atRisk.length > 0 ? ` Top at-risk: ${atRisk.map(b => `${b.name} (${b.email_security_grade})`).join(', ')}.` : ''}`,
          severity: atRisk.length > 0 ? 'high' : 'info',
          details: {
            title: 'Email Security Posture',
            grade_distribution: emailGradeDistribution.results,
            at_risk_brands: atRisk,
            grade_changes: changes,
          },
        });
      }
    }

    // Send intelligence digest notification (rate-limited: 1 per day)
    if (outputs.length > 0) {
      const firstInsight = outputs[0]!;
      const summaryText = firstInsight.summary.replace(/\*\*/g, '').substring(0, 100);
      try {
        await createNotification(env.DB, {
          type: 'intelligence_digest',
          severity: 'info',
          title: 'New intelligence briefing',
          message: summaryText + '...',
          link: '/agents',
        });
      } catch (e) {
        console.error(`[observer] notification error:`, e);
      }
    }

    // ─── Weekly Strategic Intelligence Report (Sunday 6am UTC) ───
    const now = new Date();
    const isSunday = now.getUTCDay() === 0;
    const isMorning = now.getUTCHours() < 7;
    let weeklyGenerated = false;

    if (isSunday && isMorning) {
      try {
        // Check if we already generated one this week
        const existingWeekly = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM agent_outputs
           WHERE agent_id = 'observer' AND type = 'weekly_intel'
           AND created_at >= datetime('now', '-6 days')`
        ).first<{ n: number }>();

        if ((existingWeekly?.n ?? 0) === 0) {
          // Gather weekly data
          const weeklyThreats = await env.DB.prepare(`
            SELECT COUNT(*) as total,
              SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
              SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high
            FROM threats WHERE created_at >= datetime('now', '-7 days')
          `).first<{ total: number; critical: number; high: number }>();

          const weeklyTopBrands = await env.DB.prepare(`
            SELECT b.name, COUNT(*) as count
            FROM threats t JOIN brands b ON t.target_brand_id = b.id
            WHERE t.created_at >= datetime('now', '-7 days')
            GROUP BY b.id ORDER BY count DESC LIMIT 5
          `).all<{ name: string; count: number }>();

          const weeklyTopSectors = await env.DB.prepare(`
            SELECT b.sector, COUNT(*) as count
            FROM threats t JOIN brands b ON t.target_brand_id = b.id
            WHERE t.created_at >= datetime('now', '-7 days') AND b.sector IS NOT NULL
            GROUP BY b.sector ORDER BY count DESC LIMIT 5
          `).all<{ sector: string; count: number }>();

          const newCampaigns = await env.DB.prepare(
            `SELECT COUNT(*) as n FROM campaigns WHERE created_at >= datetime('now', '-7 days')`
          ).first<{ n: number }>();

          const { generateInsight: genInsight } = await import("../lib/haiku");
          const weeklyResult = await genInsight(env, {
            period: "weekly",
            threats_summary: {
              total_7d: weeklyThreats?.total ?? 0,
              critical: weeklyThreats?.critical ?? 0,
              high: weeklyThreats?.high ?? 0,
              new_campaigns: newCampaigns?.n ?? 0,
            },
            top_brands: weeklyTopBrands.results,
            top_providers: topProviders.results,
            trend_data: { weekly_total: weeklyThreats?.total ?? 0 },
            type_distribution: typeBreakdown.results,
            recent_campaigns: recentCampaigns.results,
            email_security_summary: emailSecurityContext,
            spam_trap_summary: spamTrapContext,
            threat_feed_summary: threatFeedContext,
            high_risk_brands_summary: highRiskContext,
            narrative_summary: narrativeContext,
            social_monitor_summary: socialMonitorContext,
            lookalike_domain_summary: lookalikeContext,
            ct_certificate_summary: ctCertContext,
            enrichment_validation_summary: enrichmentContext,
          });

          if (weeklyResult.success && weeklyResult.data?.items?.length) {
            if (weeklyResult.tokens_used) totalTokens += weeklyResult.tokens_used;
            if (weeklyResult.model) model = weeklyResult.model;

            const weeklyItems = weeklyResult.data.items;
            const topSeverity = weeklyItems.some(i => i.severity === 'critical') ? 'critical'
              : weeklyItems.some(i => i.severity === 'high') ? 'high' : 'medium';

            // Combine into one weekly intel output
            const weeklySummary = weeklyItems.map(i => `**${i.title}** — ${i.summary}`).join('\n\n');
            outputs.push({
              type: "insight",
              summary: `**Weekly Strategic Intelligence Report**\n\n${weeklySummary}`,
              severity: topSeverity as "critical" | "high" | "medium",
              details: {
                title: 'Weekly Strategic Intelligence Report',
                type: 'weekly_intel',
                top_brands: weeklyTopBrands.results,
                top_sectors: weeklyTopSectors.results,
                total_threats_7d: weeklyThreats?.total ?? 0,
                new_campaigns: newCampaigns?.n ?? 0,
              },
            });
            weeklyGenerated = true;

            // Also save directly as type='weekly_intel' for easy querying
            await env.DB.prepare(
              `INSERT INTO agent_outputs (id, agent_id, type, summary, severity, details, created_at)
               VALUES (?, 'observer', 'weekly_intel', ?, ?, ?, datetime('now'))`
            ).bind(
              crypto.randomUUID(),
              `Weekly Intel: ${weeklyThreats?.total ?? 0} threats, ${newCampaigns?.n ?? 0} new campaigns, top target: ${weeklyTopBrands.results[0]?.name ?? 'none'}`,
              topSeverity,
              JSON.stringify({ items: weeklyItems, top_brands: weeklyTopBrands.results, top_sectors: weeklyTopSectors.results }),
            ).run();
          }
        }
      } catch (weeklyErr) {
        console.error("[observer] weekly intel error:", weeklyErr);
      }
    }

    return {
      itemsProcessed: 1,
      itemsCreated: outputs.length,
      itemsUpdated: 0,
      output: {
        total_threats_24h: totalNow,
        change_percent: changePercent,
        insights_generated: outputs.length,
        weekly_report_generated: weeklyGenerated,
      },
      model,
      tokensUsed: totalTokens,
      agentOutputs: outputs,
    };
  },
};
