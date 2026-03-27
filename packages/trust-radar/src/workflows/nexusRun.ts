import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { Env } from '../types';

type NexusWorkflowParams = {
  forceRefresh?: boolean;
};

export class NexusWorkflow extends WorkflowEntrypoint<Env, NexusWorkflowParams> {
  async run(event: WorkflowEvent<NexusWorkflowParams>, step: WorkflowStep) {
    // Step 1: Count clusters before run
    const before = await step.do('count-before', async () => {
      const result = await this.env.DB.prepare(
        'SELECT COUNT(*) as count FROM infrastructure_clusters'
      ).first<{ count: number }>();
      return { clusters_before: result?.count ?? 0 };
    });

    await step.do('log-start', async () => {
      await this.env.DB.prepare(`
        INSERT INTO agent_activity_log (id, agent_id, event_type, message, metadata_json, severity)
        VALUES (?, 'nexus', 'started', ?, ?, 'info')
      `).bind(
        crypto.randomUUID(),
        `NEXUS Workflow started — ${before.clusters_before} existing clusters`,
        JSON.stringify({ clusters_before: before.clusters_before, triggered_by: 'workflow' })
      ).run();
    });

    // Step 2: Run ASN correlation — the core NEXUS query
    const correlation = await step.do('asn-correlation', { retries: { limit: 2, delay: '5 seconds' } }, async () => {
      const asnClusters = await this.env.DB.prepare(`
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
          SUM(CASE WHEN first_seen >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as last_7d,
          SUM(CASE WHEN first_seen < datetime('now', '-7 days') AND first_seen >= datetime('now', '-14 days') THEN 1 ELSE 0 END) as prev_7d
        FROM threats
        WHERE asn IS NOT NULL
        GROUP BY asn, threat_type
        HAVING threats >= 10
        ORDER BY threats DESC
        LIMIT 100
      `).all<Record<string, unknown>>();

      let clustersWritten = 0;
      let pivotsDetected = 0;
      let accelerating = 0;

      for (const cluster of asnClusters.results) {
        const prev7d = cluster.prev_7d as number;
        const last7d = cluster.last_7d as number;
        const threats = cluster.threats as number;
        const campaigns = cluster.campaigns as number;
        const brands = cluster.brands as number;
        const asn = cluster.asn as string;
        const threatType = cluster.threat_type as string;
        const countries = cluster.countries as string | null;
        const brandIds = cluster.brand_ids as string | null;
        const providerIds = cluster.provider_ids as string | null;
        const firstSeen = cluster.first_seen as string;
        const lastSeen = cluster.last_seen as string;

        const isPivoting = prev7d > 10 && last7d < prev7d * 0.2;
        const isAccelerating = last7d > prev7d * 1.5;
        const confidence = Math.min(
          100,
          campaigns * 10 + brands * 5 + (threats > 100 ? 20 : threats > 50 ? 10 : 5)
        );

        const clusterId = crypto.randomUUID();
        const asnParts = (asn ?? '').split(' ');
        const asnNum = asnParts[0] ?? asn;
        const orgName = asnParts.slice(1).join(' ') || asn;
        const clusterName = `${orgName} ${threatType} cluster`;

        try {
          await this.env.DB.prepare(`
            INSERT INTO infrastructure_clusters (
              id, cluster_name, asns, countries, attack_types, brand_ids,
              campaign_ids, hosting_provider_ids, threat_count, confidence_score,
              first_detected, last_seen, status, agent_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
          `).bind(
            clusterId, clusterName,
            JSON.stringify([asn]),
            JSON.stringify((countries ?? '').split(',').filter(Boolean)),
            JSON.stringify([threatType]),
            JSON.stringify((brandIds ?? '').split(',').filter(Boolean)),
            JSON.stringify([]),
            JSON.stringify((providerIds ?? '').split(',').filter(Boolean)),
            threats, confidence,
            firstSeen, lastSeen,
            isPivoting ? 'dormant' : 'active',
            isPivoting ? 'PIVOT DETECTED: activity dropped >80% in last 7 days'
              : isAccelerating ? 'ACCELERATING: activity up >50% vs prior week'
              : null
          ).run();
          clustersWritten++;

          await this.env.DB.prepare(
            `UPDATE threats SET cluster_id = ? WHERE asn = ? AND threat_type = ? AND cluster_id IS NULL`
          ).bind(clusterId, asn, threatType).run();

        } catch { continue; }

        if (isPivoting && confidence > 40) {
          pivotsDetected++;
          await this.env.DB.prepare(`
            INSERT INTO agent_events (id, event_type, source_agent, target_agent, payload_json, priority)
            VALUES (?, 'pivot_detected', 'nexus', 'observer', ?, 1)
          `).bind(crypto.randomUUID(), JSON.stringify({ cluster_id: clusterId, asn })).run();
        }

        if (isAccelerating) accelerating++;
      }

      return { clustersWritten, pivotsDetected, accelerating, asnsAnalyzed: asnClusters.results.length };
    });

    // Step 3: Update hosting provider trends
    const providers = await step.do('update-provider-trends', { retries: { limit: 2, delay: '5 seconds' } }, async () => {
      await this.env.DB.prepare(`
        UPDATE hosting_providers SET
          trend_7d = (SELECT COUNT(*) FROM threats WHERE hosting_provider_id = hosting_providers.id AND first_seen >= datetime('now', '-7 days')),
          trend_30d = (SELECT COUNT(*) FROM threats WHERE hosting_provider_id = hosting_providers.id AND first_seen >= datetime('now', '-30 days')),
          active_threat_count = (SELECT COUNT(*) FROM threats WHERE hosting_provider_id = hosting_providers.id AND status = 'active'),
          total_threat_count = (SELECT COUNT(*) FROM threats WHERE hosting_provider_id = hosting_providers.id)
        WHERE id IN (SELECT DISTINCT hosting_provider_id FROM threats WHERE hosting_provider_id IS NOT NULL)
      `).run();
      const updated = await this.env.DB.prepare(
        'SELECT COUNT(*) as n FROM hosting_providers WHERE trend_7d > 0 OR total_threat_count > 0'
      ).first<{ n: number }>();
      return { providers_updated: updated?.n ?? 0 };
    });

    // Step 4: Log completion
    await step.do('log-complete', async () => {
      await this.env.DB.prepare(`
        INSERT INTO agent_activity_log (id, agent_id, event_type, message, metadata_json, severity)
        VALUES (?, 'nexus', 'batch_complete', ?, ?, 'info')
      `).bind(
        crypto.randomUUID(),
        `NEXUS complete — ${correlation.clustersWritten} clusters written, ${correlation.pivotsDetected} pivots, ${providers.providers_updated} providers updated`,
        JSON.stringify({ ...correlation, ...providers })
      ).run();

      await this.env.DB.prepare(`
        INSERT INTO agent_events (id, event_type, source_agent, payload_json, priority, status)
        VALUES (?, 'nexus_complete', 'nexus', ?, 2, 'pending')
      `).bind(
        crypto.randomUUID(),
        JSON.stringify({ ...correlation, ...providers })
      ).run();
    });

    return { ...correlation, ...providers };
  }
}
