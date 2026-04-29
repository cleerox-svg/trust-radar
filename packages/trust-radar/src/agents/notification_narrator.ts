/**
 * Notification Narrator Agent — Q5b backlog.
 *
 * Per-user daily digest builder. For each active user with
 * `notification_preferences_v2.digest_mode='daily'`, this agent:
 *
 *   1. Queries the user's notifications from the last 24h that are
 *      at or above their `digest_severity_floor`.
 *   2. If ≥1 row exists, calls Haiku with a compact context to
 *      produce a 1–3 sentence narrative summary (cost-guard
 *      gated; falls back to a static template when AI is paused).
 *   3. Inserts a single `notification_digest` envelope row in the
 *      user's inbox with `metadata.notification_ids[]` listing the
 *      underlying rows + the narrative as the message body.
 *
 * Schedule: hour===13 from the orchestrator (alongside the legacy
 * briefing email cron, which we leave in place — the digest is
 * additive in the bell). Single-tenant deployments will have a
 * small fan-out; multi-tenant will scale with active users.
 *
 * Per audit doc §11.4 — narrator is the AI-summarised path to
 * complement the static intel_* templates.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { generateInsight, checkCostGuard } from "../lib/haiku";
import { createNotification } from "../lib/notifications";

interface UserDigestPref {
  user_id: string;
  digest_severity_floor: 'high' | 'medium' | 'low' | 'info';
  email_severity_floor: string;
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
};

function severityAtLeast(have: string, floor: string): boolean {
  return (SEVERITY_RANK[have] ?? 0) >= (SEVERITY_RANK[floor] ?? 0);
}

export const notificationNarratorAgent: AgentModule = {
  name: "notification_narrator",
  displayName: "Notification Narrator",
  description: "Per-user daily digest builder (Q5b)",
  color: "#A8C878",
  trigger: "scheduled",
  requiresApproval: false,
  stallThresholdMinutes: 30,
  parallelMax: 1,
  costGuard: "enforced",
  budget: { monthlyTokenCap: 200_000 },
  reads: [
    { kind: "d1_table", name: "notification_preferences_v2" },
    { kind: "d1_table", name: "notifications" },
    { kind: "d1_table", name: "users" },
  ],
  // Note: writes to `notifications` go through the createNotification
  // helper which the static drift extractor doesn't see. Convention
  // matches observer/cartographer — declare only direct SQL.
  writes: [],
  outputs: [{ type: "diagnostic" }],
  status: "active",
  category: "intelligence",
  pipelinePosition: 36,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env, runId } = ctx;
    const callCtx = { agentId: "notification_narrator", runId };
    const outputs: AgentOutputEntry[] = [];

    // Cost guard: digests are non-critical — pause when budget is hot.
    const blocked = await checkCostGuard(env, false);
    const aiPaused = !!blocked;

    // Find every user with daily digest mode opted in.
    const users = await env.DB.prepare(
      `SELECT u.id AS user_id, p.digest_severity_floor, p.email_severity_floor
         FROM users u
         JOIN notification_preferences_v2 p ON p.user_id = u.id
        WHERE u.status = 'active'
          AND p.digest_mode = 'daily'`
    ).all<UserDigestPref>();

    let digestsCreated = 0;
    let usersSkipped = 0;
    let totalTokens = 0;
    let model: string | undefined;

    for (const user of users.results) {
      // Pull eligible notifications from the last 24h, at or above
      // the user's digest floor, excluding the digest envelope itself.
      const rows = await env.DB.prepare(
        `SELECT id, type, severity, title, message
           FROM notifications
          WHERE user_id = ?
            AND created_at >= datetime('now', '-24 hours')
            AND type != 'notification_digest'
            AND state != 'done'
          ORDER BY created_at DESC LIMIT 100`
      ).bind(user.user_id).all<{
        id: string; type: string; severity: string; title: string; message: string;
      }>();

      const eligible = rows.results.filter((r) =>
        severityAtLeast(r.severity, user.digest_severity_floor)
      );
      if (eligible.length === 0) {
        usersSkipped++;
        continue;
      }

      // Severity bucket counts for the static title.
      const counts: { critical: number; high: number; medium: number; low: number; info: number } =
        { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const r of eligible) {
        if (r.severity === 'critical' || r.severity === 'high' || r.severity === 'medium' ||
            r.severity === 'low' || r.severity === 'info') {
          counts[r.severity]++;
        }
      }
      const topSeverity =
        counts.critical > 0 ? 'critical'
        : counts.high > 0 ? 'high'
        : counts.medium > 0 ? 'medium'
        : counts.low > 0 ? 'low' : 'info';

      // Static title — concise summary line.
      const total = eligible.length;
      const title = `Daily digest: ${total} event${total === 1 ? '' : 's'} need${total === 1 ? 's' : ''} review`;
      const staticMessage = `${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.info} info — last 24h.`;

      // Optional Haiku narrative — paused under cost guard, falls
      // back to staticMessage. Compact context (max 12 items) to
      // keep token spend predictable.
      let narrative = staticMessage;
      if (!aiPaused) {
        try {
          const top = eligible.slice(0, 12).map((r) => `[${r.severity}] ${r.title}: ${r.message}`).join('\n');
          const ai = await generateInsight(env, callCtx, {
            period: 'daily',
            threats_summary: { total_24h: total, ...counts },
            top_brands: [],
            top_providers: [],
            // Reuse the existing insight schema by stuffing items into
            // type_distribution — generateInsight handles loose context.
            type_distribution: eligible.slice(0, 12).map((r) => ({ threat_type: r.type, count: 1 })),
            trend_data: { items: top },
          });
          if (ai.success && ai.data?.items?.length) {
            // Take the first item's summary as the narrative.
            const first = ai.data.items[0];
            if (first?.summary) {
              narrative = first.summary;
              if (ai.tokens_used) totalTokens += ai.tokens_used;
              if (ai.model) model = ai.model;
            }
          }
        } catch {
          // Static fallback already in place.
        }
      }

      // Emit the digest envelope. group_key dedups against re-runs
      // within the same day. metadata carries the underlying ids.
      try {
        await createNotification(env, {
          userId: user.user_id,
          type: 'notification_digest',
          severity: topSeverity as 'critical' | 'high' | 'medium' | 'low' | 'info',
          title,
          message: narrative,
          reasonText: `Your digest mode is set to daily.`,
          recommendedAction: total > 5
            ? `Review the inbox; bulk-action the lower-severity rows.`
            : `Open the inbox to triage.`,
          link: '/notifications',
          audience: 'tenant',
          groupKey: `notification_digest:${user.user_id}:${new Date().toISOString().slice(0, 10)}`,
          metadata: {
            digest_window: '24h',
            ai_paused: aiPaused,
            notification_ids: eligible.map((r) => r.id),
            counts,
          },
        });
        digestsCreated++;
      } catch (err) {
        console.error('[notification_narrator] envelope insert error:', err);
      }
    }

    outputs.push({
      type: 'diagnostic',
      summary: `Daily digests: ${digestsCreated} created, ${usersSkipped} users skipped (no eligible notifications). AI ${aiPaused ? 'paused' : 'enabled'}.`,
      severity: 'info',
      details: { digests_created: digestsCreated, users_skipped: usersSkipped, ai_paused: aiPaused, tokens: totalTokens, model },
    });

    return {
      itemsProcessed: users.results.length,
      itemsCreated: digestsCreated,
      itemsUpdated: 0,
      output: {
        digests_created: digestsCreated,
        users_skipped: usersSkipped,
        ai_paused: aiPaused,
      },
      tokensUsed: totalTokens,
      model,
      agentOutputs: outputs,
    };
  },
};
