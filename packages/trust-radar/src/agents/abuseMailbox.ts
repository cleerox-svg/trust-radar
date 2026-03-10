/**
 * Abuse Mailbox Agent — Triage phishing report emails.
 * Processes incoming abuse reports and creates threat entries.
 */

import type { AgentModule, AgentContext, AgentResult } from "../lib/agentRunner";

export const abuseMailboxAgent: AgentModule = {
  name: "abuse-mailbox",
  displayName: "Abuse Mailbox",
  description: "Triage phishing report emails",
  color: "#FBBF24",
  trigger: "event",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    // Process unprocessed abuse mailbox entries
    const reports = await ctx.env.DB.prepare(
      `SELECT id, sender, subject, body_text, received_at
       FROM abuse_mailbox
       WHERE status = 'new'
       ORDER BY received_at DESC LIMIT 50`
    ).bind().all<{
      id: string; sender: string; subject: string; body_text: string; received_at: string;
    }>();

    let processed = 0;
    let created = 0;

    for (const report of reports.results) {
      processed++;

      // Extract URLs from the email body
      const urlPattern = /https?:\/\/[^\s<>"']+/gi;
      const urls = report.body_text?.match(urlPattern) ?? [];

      // Extract domains
      const domains = urls.map((u) => {
        try { return new URL(u).hostname; } catch { return null; }
      }).filter(Boolean);

      // Create threats for extracted URLs
      for (const url of urls.slice(0, 5)) {
        let domain: string | null = null;
        try { domain = new URL(url).hostname; } catch { /* skip */ }

        const threatId = crypto.randomUUID();
        await ctx.env.DB.prepare(
          `INSERT OR IGNORE INTO threats (id, type, title, description, severity, confidence, status, source, source_ref, url, domain, created_by, first_seen, last_seen, created_at)
           VALUES (?, 'phishing', ?, ?, 'medium', 50, 'new', 'abuse_mailbox', ?, ?, ?, 'agent:abuse-mailbox', datetime('now'), datetime('now'), datetime('now'))`
        ).bind(
          threatId,
          `Reported phishing: ${domain ?? url.slice(0, 60)}`,
          `Reported via abuse mailbox by ${report.sender}: ${report.subject}`,
          report.id, url, domain,
        ).run();
        created++;
      }

      // Mark report as processed
      await ctx.env.DB.prepare(
        `UPDATE abuse_mailbox SET status = 'processed', processed_at = datetime('now') WHERE id = ?`
      ).bind(report.id).run();
    }

    return {
      itemsProcessed: processed,
      itemsCreated: created,
      itemsUpdated: 0,
      output: {
        reportsProcessed: processed,
        threatsCreated: created,
      },
    };
  },
};
