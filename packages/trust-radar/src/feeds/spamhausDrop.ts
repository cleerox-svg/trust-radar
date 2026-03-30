import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";

const DROP_URL = "https://www.spamhaus.org/drop/drop.txt";
const EDROP_URL = "https://www.spamhaus.org/drop/edrop.txt";
const BATCH_SIZE = 50;

interface DropEntry {
  cidr: string;
  sblId: string | null;
}

/**
 * Spamhaus DROP + EDROP — Hijacked network ranges (CIDR blocks).
 *
 * These are entire network ranges allocated to spammers or hijacked for
 * malware/botnet operations. Gold-standard network-level blocklist.
 *
 * Schedule: daily at 03:00. No API key required.
 */
export const spamhaus_drop: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const db = ctx.env.DB;

    // Fetch both DROP and EDROP in parallel
    const [dropRes, edropRes] = await Promise.all([
      fetch(DROP_URL, { headers: { "User-Agent": "TrustRadar/2.0" } }),
      fetch(EDROP_URL, { headers: { "User-Agent": "TrustRadar/2.0" } }),
    ]);

    const entries: DropEntry[] = [];

    for (const res of [dropRes, edropRes]) {
      if (!res.ok) continue;
      const text = await res.text();
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        // Skip comments (starting with ;) and empty lines
        if (!trimmed || trimmed.startsWith(";")) continue;
        // Format: "CIDR ; SBLnnnnn" or just CIDR
        const parts = trimmed.split(";").map((p) => p.trim());
        const cidr = parts[0];
        if (!cidr || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(cidr)) continue;
        const sblId = parts[1] && /^SBL\d+$/i.test(parts[1]) ? parts[1] : null;
        entries.push({ cidr, sblId });
      }
    }

    // Deduplicate by CIDR
    const seen = new Set<string>();
    const unique: DropEntry[] = [];
    for (const entry of entries) {
      if (!seen.has(entry.cidr)) {
        seen.add(entry.cidr);
        unique.push(entry);
      }
    }

    let itemsNew = 0;
    let firstError: string | null = null;

    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE);
      const stmts = batch.map(({ cidr, sblId }) =>
        db.prepare(
          `INSERT OR IGNORE INTO threats
            (id, source_feed, threat_type, malicious_url, malicious_domain,
             ip_address, ioc_value, severity, confidence_score, status,
             title, tags, first_seen, last_seen, created_at)
           VALUES (?, 'spamhaus_drop', 'malicious_ip', NULL, NULL,
                   ?, ?, 'high', 98, 'active',
                   'Hijacked Network Range (Spamhaus DROP)',
                   ?, datetime('now'), datetime('now'), datetime('now'))`,
        ).bind(
          threatId("spamhaus_drop", "cidr", cidr),
          cidr,
          cidr,
          sblId ? JSON.stringify([sblId]) : "[]",
        ),
      );

      try {
        const results = await db.batch(stmts);
        itemsNew += results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
      } catch (e) {
        if (!firstError) firstError = String(e);
      }
    }

    // Update last_seen for existing ranges
    if (itemsNew < unique.length) {
      const updateBatch = unique.slice(0, Math.min(unique.length, 200));
      const updateStmts = updateBatch.map(({ cidr }) =>
        db.prepare(
          `UPDATE threats SET last_seen = datetime('now')
           WHERE ip_address = ? AND source_feed = 'spamhaus_drop'`,
        ).bind(cidr),
      );
      try {
        await db.batch(updateStmts);
      } catch { /* non-fatal */ }
    }

    // Cross-reference: check if any existing threat IPs fall within DROP ranges
    // Parse CIDRs to find /8, /16, /24 prefixes and check against threats
    let overlapCount = 0;
    try {
      for (const { cidr } of unique.slice(0, 100)) {
        const [network, bits] = cidr.split("/");
        if (!network || !bits) continue;
        const prefix = parseInt(bits, 10);
        // Only check /24 and smaller for efficient LIKE matching
        if (prefix >= 24) {
          const networkPrefix = network.split(".").slice(0, 3).join(".");
          const result = await db.prepare(
            `SELECT COUNT(*) as cnt FROM threats
             WHERE ip_address LIKE ? AND source_feed != 'spamhaus_drop'`,
          ).bind(`${networkPrefix}.%`).first<{ cnt: number }>();
          overlapCount += result?.cnt ?? 0;
        }
      }
    } catch { /* non-fatal cross-reference */ }

    if (overlapCount > 0) {
      try {
        await db.prepare(
          `INSERT INTO agent_outputs (id, agent_id, type, summary, created_at)
           VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))`,
        ).bind(
          `diag_drop_overlap_${Date.now()}`,
          `[spamhaus-drop] ${overlapCount} threat IPs fall within hijacked network ranges`,
        ).run();
      } catch { /* non-fatal */ }
    }

    return {
      itemsFetched: unique.length,
      itemsNew,
      itemsDuplicate: unique.length - itemsNew,
      itemsError: firstError ? 1 : 0,
    };
  },
};
