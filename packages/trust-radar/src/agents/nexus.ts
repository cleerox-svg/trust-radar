/**
 * NEXUS Agent — Infrastructure Correlation Engine (v1, SQL-only).
 *
 * Runs every 4 hours (Flight Control will trigger more often later).
 * Finds patterns humans can't see — clustering threats by ASN, subnet,
 * temporal window, and cross-brand targeting.
 *
 * SQL does correlation. AI does narrative. Never pay AI to do what GROUP BY can do.
 *
 * Outputs:
 * - infrastructure_clusters table rows
 * - hosting_providers trend_7d/30d/active counts updated
 * - pivot alerts emitted to agent_events for Observer
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import type { Env } from "../types";

// ─── NEXUS core correlation logic ─────────────────────────────────

export async function runNexus(db: D1Database, _env: Env): Promise<{
  clustersWritten: number;
  providersUpdated: number;
  pivotsDetected: number;
  outputs: AgentOutputEntry[];
}> {
  const outputs: AgentOutputEntry[] = [];
  let clustersWritten = 0;
  let pivotsDetected = 0;

  // --- Correlation 1: ASN + threat_type clustering ---
  const asnClusters = await db.prepare(`
    SELECT
      asn,
      threat_type,
      COUNT(DISTINCT campaign_id) as campaigns,
      COUNT(DISTINCT target_brand_id) as brands,
      COUNT(*) as threats,
      GROUP_CONCAT(DISTINCT country_code) as countries,
      GROUP_CONCAT(DISTINCT target_brand_id) as brand_ids,
      GROUP_CONCAT(DISTINCT hosting_provider_id) as provider_ids,
      MIN(first_seen) as first_seen,
      MAX(first_seen) as last_seen,
      -- Pivot detection: activity in last 7d vs previous 7d
      SUM(CASE WHEN first_seen >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as last_7d,
      SUM(CASE WHEN first_seen < datetime('now', '-7 days') AND first_seen >= datetime('now', '-14 days') THEN 1 ELSE 0 END) as prev_7d
    FROM threats
    WHERE asn IS NOT NULL
    GROUP BY asn, threat_type
    HAVING threats >= 10
    ORDER BY threats DESC
    LIMIT 100
  `).all<{
    asn: string;
    threat_type: string;
    campaigns: number;
    brands: number;
    threats: number;
    countries: string | null;
    brand_ids: string | null;
    provider_ids: string | null;
    first_seen: string | null;
    last_seen: string | null;
    last_7d: number;
    prev_7d: number;
  }>();

  // --- Write clusters ---
  for (const cluster of asnClusters.results) {
    const isPivoting = cluster.prev_7d > 10 && cluster.last_7d < cluster.prev_7d * 0.2;
    const isAccelerating = cluster.last_7d > cluster.prev_7d * 1.5;

    // Confidence: more campaigns + brands + types = higher confidence
    const confidence = Math.min(100,
      (cluster.campaigns * 10) +
      (cluster.brands * 5) +
      (cluster.threats > 100 ? 20 : cluster.threats > 50 ? 10 : 5)
    );

    const clusterId = crypto.randomUUID();
    const clusterName = generateClusterName(cluster);

    try {
      await db.prepare(`
        INSERT INTO infrastructure_clusters (
          id, cluster_name, asns, countries, attack_types, brand_ids,
          campaign_ids, hosting_provider_ids, threat_count, confidence_score,
          first_detected, last_seen, status, agent_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).bind(
        clusterId,
        clusterName,
        JSON.stringify([cluster.asn]),
        JSON.stringify((cluster.countries ?? '').split(',').filter(Boolean)),
        JSON.stringify([cluster.threat_type]),
        JSON.stringify((cluster.brand_ids ?? '').split(',').filter(Boolean)),
        JSON.stringify([]), // campaign_ids not aggregated with GROUP_CONCAT here
        JSON.stringify((cluster.provider_ids ?? '').split(',').filter(Boolean)),
        cluster.threats,
        confidence,
        cluster.first_seen,
        cluster.last_seen,
        isPivoting ? 'dormant' : 'active',
        isPivoting ? 'PIVOT DETECTED: activity dropped >80% in last 7 days'
          : isAccelerating ? 'ACCELERATING: activity up >50% vs prior week'
          : null
      ).run();
      clustersWritten++;
    } catch (err) {
      console.error(`[nexus] cluster write error for ${clusterName}:`, err);
      continue;
    }

    // Update threats with cluster_id
    try {
      await db.prepare(`
        UPDATE threats SET cluster_id = ?
        WHERE asn = ? AND threat_type = ? AND cluster_id IS NULL
      `).bind(clusterId, cluster.asn, cluster.threat_type).run();
    } catch (err) {
      console.error(`[nexus] cluster_id update error:`, err);
    }

    // Emit pivot alert to Observer
    if (isPivoting && confidence > 40) {
      pivotsDetected++;
      try {
        await db.prepare(`
          INSERT INTO agent_events (id, event_type, source_agent, target_agent, payload_json, priority)
          VALUES (?, 'pivot_detected', 'nexus', 'observer', ?, 1)
        `).bind(
          crypto.randomUUID(),
          JSON.stringify({ cluster_id: clusterId, asn: cluster.asn, cluster_name: clusterName })
        ).run();
      } catch (err) {
        console.error('[nexus] pivot event emit error:', err);
      }

      outputs.push({
        type: "correlation",
        summary: `PIVOT DETECTED: ${clusterName} — activity dropped >80% in 7 days (was ${cluster.prev_7d}, now ${cluster.last_7d})`,
        severity: "high",
        details: {
          cluster_id: clusterId,
          asn: cluster.asn,
          prev_7d: cluster.prev_7d,
          last_7d: cluster.last_7d,
          confidence,
        },
      });
    }

    // Report accelerating clusters
    if (isAccelerating && cluster.last_7d > 20) {
      outputs.push({
        type: "correlation",
        summary: `ACCELERATING: ${clusterName} — ${cluster.last_7d} threats in 7d (up from ${cluster.prev_7d})`,
        severity: cluster.last_7d > 50 ? "high" : "medium",
        details: {
          cluster_id: clusterId,
          asn: cluster.asn,
          last_7d: cluster.last_7d,
          prev_7d: cluster.prev_7d,
          confidence,
        },
      });
    }
  }

  // --- Correlation 2: Update hosting_providers trend data ---
  let providersUpdated = 0;
  try {
    await db.prepare(`
      UPDATE hosting_providers SET
        trend_7d = (
          SELECT COUNT(*) FROM threats
          WHERE hosting_provider_id = hosting_providers.id
            AND first_seen >= datetime('now', '-7 days')
        ),
        trend_30d = (
          SELECT COUNT(*) FROM threats
          WHERE hosting_provider_id = hosting_providers.id
            AND first_seen >= datetime('now', '-30 days')
        ),
        active_threat_count = (
          SELECT COUNT(*) FROM threats
          WHERE hosting_provider_id = hosting_providers.id
            AND status = 'active'
        ),
        total_threat_count = (
          SELECT COUNT(*) FROM threats
          WHERE hosting_provider_id = hosting_providers.id
        )
      WHERE id IN (SELECT DISTINCT hosting_provider_id FROM threats WHERE hosting_provider_id IS NOT NULL)
    `).run();

    const updatedCount = await db.prepare(
      "SELECT COUNT(*) as n FROM hosting_providers WHERE trend_7d > 0 OR total_threat_count > 0"
    ).first<{ n: number }>();
    providersUpdated = updatedCount?.n ?? 0;
  } catch (err) {
    console.error('[nexus] provider trend update error:', err);
  }

  // --- Correlation 3: App-store developer clusters ---
  // Same developer_id (or developer_name when dev_id is null) pushing
  // impersonations against multiple brands = campaign. Skip silently if
  // the table is absent in this deployment.
  let appStoreClustersWritten = 0;
  try {
    const devClusters = await db.prepare(`
      SELECT
        store,
        COALESCE(developer_id, LOWER(TRIM(developer_name))) AS dev_key,
        MAX(developer_name) AS developer_name,
        MAX(developer_id) AS developer_id,
        COUNT(DISTINCT brand_id) AS brands,
        COUNT(*) AS rows_,
        GROUP_CONCAT(DISTINCT brand_id) AS brand_ids,
        MIN(first_seen) AS first_seen,
        MAX(COALESCE(last_checked, first_seen)) AS last_seen
      FROM app_store_listings
      WHERE status = 'active'
        AND classification IN ('impersonation', 'suspicious')
        AND COALESCE(developer_id, developer_name) IS NOT NULL
      GROUP BY store, dev_key
      HAVING brands >= 2 AND rows_ >= 2
      ORDER BY brands DESC, rows_ DESC
      LIMIT 50
    `).all<{
      store: string;
      dev_key: string;
      developer_name: string | null;
      developer_id: string | null;
      brands: number;
      rows_: number;
      brand_ids: string | null;
      first_seen: string | null;
      last_seen: string | null;
    }>();

    for (const cluster of devClusters.results) {
      const clusterId = crypto.randomUUID();
      const devLabel = cluster.developer_name ?? cluster.dev_key;
      const clusterName = `${cluster.store} dev "${devLabel}" (${cluster.brands} brands targeted)`;

      // Confidence scales with brands + row count — brand diversity matters most.
      const confidence = Math.min(100,
        (cluster.brands * 15) +
        (cluster.rows_ > 10 ? 20 : cluster.rows_ > 5 ? 10 : 5)
      );

      try {
        await db.prepare(`
          INSERT INTO infrastructure_clusters (
            id, cluster_name, asns, countries, attack_types, brand_ids,
            campaign_ids, hosting_provider_ids, threat_count, confidence_score,
            first_detected, last_seen, status, agent_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
          ON CONFLICT(id) DO NOTHING
        `).bind(
          clusterId,
          clusterName,
          JSON.stringify([]),
          JSON.stringify([]),
          JSON.stringify(['app_store_impersonation']),
          JSON.stringify((cluster.brand_ids ?? '').split(',').filter(Boolean)),
          JSON.stringify([]),
          JSON.stringify([]),
          cluster.rows_,
          confidence,
          cluster.first_seen,
          cluster.last_seen,
          JSON.stringify({
            cluster_type: 'app_store_developer',
            store: cluster.store,
            developer_id: cluster.developer_id,
            developer_name: cluster.developer_name,
            dev_key: cluster.dev_key,
            brands_targeted: cluster.brands,
            listings_count: cluster.rows_,
          }),
        ).run();
        appStoreClustersWritten++;
        clustersWritten++;
      } catch (err) {
        console.error(`[nexus] app-store cluster write error for ${clusterName}:`, err);
        continue;
      }

      outputs.push({
        type: "correlation",
        summary: `App-store campaign: ${clusterName} — ${cluster.rows_} listing(s) across ${cluster.brands} brands on ${cluster.store}.`,
        severity: cluster.brands >= 4 ? "high" : "medium",
        details: {
          cluster_id: clusterId,
          cluster_type: 'app_store_developer',
          store: cluster.store,
          developer_id: cluster.developer_id,
          developer_name: cluster.developer_name,
          brands_targeted: cluster.brands,
          listings: cluster.rows_,
          confidence,
        },
      });
    }
  } catch (err) {
    // app_store_listings missing → skip silently
    console.warn('[nexus] app-store cluster pass skipped:', err instanceof Error ? err.message : String(err));
  }

  // --- Correlation 4: Dark-web actor clusters ---
  // Same source_author (or source_channel) posting brand mentions across
  // multiple brands = organized threat actor. Same structural approach.
  let darkWebClustersWritten = 0;
  try {
    const actorClusters = await db.prepare(`
      SELECT
        source,
        COALESCE(source_author, source_channel) AS actor_key,
        MAX(source_author) AS source_author,
        MAX(source_channel) AS source_channel,
        COUNT(DISTINCT brand_id) AS brands,
        COUNT(*) AS mentions,
        GROUP_CONCAT(DISTINCT brand_id) AS brand_ids,
        MIN(first_seen) AS first_seen,
        MAX(COALESCE(last_seen, first_seen)) AS last_seen
      FROM dark_web_mentions
      WHERE status = 'active'
        AND classification IN ('confirmed', 'suspicious')
        AND COALESCE(source_author, source_channel) IS NOT NULL
      GROUP BY source, actor_key
      HAVING brands >= 2 AND mentions >= 2
      ORDER BY brands DESC, mentions DESC
      LIMIT 50
    `).all<{
      source: string;
      actor_key: string;
      source_author: string | null;
      source_channel: string | null;
      brands: number;
      mentions: number;
      brand_ids: string | null;
      first_seen: string | null;
      last_seen: string | null;
    }>();

    for (const cluster of actorClusters.results) {
      const clusterId = crypto.randomUUID();
      const actorLabel = cluster.source_author
        ?? cluster.source_channel
        ?? cluster.actor_key;
      const clusterName = `${cluster.source} actor "${actorLabel}" (${cluster.brands} brands)`;

      const confidence = Math.min(100,
        (cluster.brands * 15) +
        (cluster.mentions > 10 ? 20 : cluster.mentions > 5 ? 10 : 5)
      );

      try {
        await db.prepare(`
          INSERT INTO infrastructure_clusters (
            id, cluster_name, asns, countries, attack_types, brand_ids,
            campaign_ids, hosting_provider_ids, threat_count, confidence_score,
            first_detected, last_seen, status, agent_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
          ON CONFLICT(id) DO NOTHING
        `).bind(
          clusterId,
          clusterName,
          JSON.stringify([]),
          JSON.stringify([]),
          JSON.stringify(['dark_web_actor']),
          JSON.stringify((cluster.brand_ids ?? '').split(',').filter(Boolean)),
          JSON.stringify([]),
          JSON.stringify([]),
          cluster.mentions,
          confidence,
          cluster.first_seen,
          cluster.last_seen,
          JSON.stringify({
            cluster_type: 'dark_web_actor',
            source: cluster.source,
            source_author: cluster.source_author,
            source_channel: cluster.source_channel,
            actor_key: cluster.actor_key,
            brands_targeted: cluster.brands,
            mentions_count: cluster.mentions,
          }),
        ).run();
        darkWebClustersWritten++;
        clustersWritten++;
      } catch (err) {
        console.error(`[nexus] dark-web cluster write error for ${clusterName}:`, err);
        continue;
      }

      outputs.push({
        type: "correlation",
        summary: `Dark-web actor: ${clusterName} — ${cluster.mentions} mention(s) across ${cluster.brands} brands on ${cluster.source}.`,
        severity: cluster.brands >= 4 ? "high" : "medium",
        details: {
          cluster_id: clusterId,
          cluster_type: 'dark_web_actor',
          source: cluster.source,
          source_author: cluster.source_author,
          source_channel: cluster.source_channel,
          brands_targeted: cluster.brands,
          mentions: cluster.mentions,
          confidence,
        },
      });
    }
  } catch (err) {
    // dark_web_mentions missing → skip silently
    console.warn('[nexus] dark-web cluster pass skipped:', err instanceof Error ? err.message : String(err));
  }

  // --- Emit completion event ---
  try {
    await db.prepare(`
      INSERT INTO agent_events (id, event_type, source_agent, payload_json)
      VALUES (?, 'nexus_complete', 'nexus', ?)
    `).bind(
      crypto.randomUUID(),
      JSON.stringify({
        clusters_written: clustersWritten,
        providers_updated: providersUpdated,
        pivots_detected: pivotsDetected,
        app_store_clusters: appStoreClustersWritten,
        dark_web_clusters: darkWebClustersWritten,
      })
    ).run();
  } catch (err) {
    console.error('[nexus] completion event error:', err);
  }

  outputs.push({
    type: "diagnostic",
    summary: `NEXUS: ${clustersWritten} clusters written (${asnClusters.results.length} ASN groups analyzed, ${appStoreClustersWritten} app-store dev clusters, ${darkWebClustersWritten} dark-web actor clusters), ${providersUpdated} providers trend-updated, ${pivotsDetected} pivots detected`,
    severity: pivotsDetected > 0 ? "high" : "info",
    details: {
      clusters_written: clustersWritten,
      providers_updated: providersUpdated,
      pivots_detected: pivotsDetected,
      asn_clusters_analyzed: asnClusters.results.length,
      app_store_clusters: appStoreClustersWritten,
      dark_web_clusters: darkWebClustersWritten,
    },
  });

  return { clustersWritten, providersUpdated, pivotsDetected, outputs };
}

function generateClusterName(cluster: { countries?: string | null; threat_type?: string | null; asn?: string | null }): string {
  const country = cluster.countries?.split(',')?.[0] ?? 'Unknown';
  const type = cluster.threat_type?.replace(/_/g, ' ') ?? 'threat';
  const asnRaw = cluster.asn ?? '';
  const asn = asnRaw.replace(/^AS\d+\s*/, '').trim() || asnRaw;
  return `${country} ${asn} ${type} cluster`.trim();
}

// ─── Agent Module Definition ──────────────────────────────────────

export const nexusAgent: AgentModule = {
  name: "nexus",
  displayName: "NEXUS",
  description: "Infrastructure correlation engine — clusters threats by ASN, subnet, and temporal patterns",
  color: "#00d4ff",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;
    const startedAt = new Date().toISOString();

    const result = await runNexus(env.DB, env);

    // Log run to agent_runs (handled by agentRunner, but also log to agent_events)
    try {
      await env.DB.prepare(`
        INSERT INTO agent_runs (id, agent_id, started_at, completed_at, status, records_processed)
        VALUES (?, 'nexus', ?, datetime('now'), 'success', ?)
      `).bind(crypto.randomUUID(), startedAt, result.clustersWritten).run();
    } catch {
      // agentRunner already tracks this — ignore duplicate
    }

    return {
      itemsProcessed: result.clustersWritten + result.providersUpdated,
      itemsCreated: result.clustersWritten,
      itemsUpdated: result.providersUpdated,
      output: {
        clusters_written: result.clustersWritten,
        providers_updated: result.providersUpdated,
        pivots_detected: result.pivotsDetected,
      },
      agentOutputs: result.outputs,
    };
  },
};
