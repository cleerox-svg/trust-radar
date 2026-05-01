import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";

const C2_SOURCES: Record<string, string> = {
  "Cobalt Strike": "https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/Cobalt%20Strike%20C2%20IPs.txt",
  "Sliver": "https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/Sliver%20C2%20IPs.txt",
  "Brute Ratel": "https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/Brute%20Ratel%20C4%20IPs.txt",
  "Metasploit": "https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/Metasploit%20Framework%20C2%20IPs.txt",
  "Posh C2": "https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/Posh%20C2%20IPs.txt",
  "Havoc": "https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/Havoc%20C2%20IPs.txt",
};

const MAX_TOTAL_IPS = 500;
const BATCH_SIZE = 50;
const IP_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/**
 * C2 Tracker — Command & Control server IPs for Cobalt Strike, Sliver,
 * Brute Ratel, Metasploit, Havoc, and Posh C2.
 *
 * Fetches all 6 lists from montysecurity/C2-Tracker on GitHub, tags each IP
 * with its C2 framework, and inserts as critical-severity threats.
 *
 * Schedule: every 12 hours. No API key required.
 */
export const c2_tracker: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const db = ctx.env.DB;

    // Fetch all C2 lists in parallel
    const entries: Array<{ ip: string; framework: string }> = [];
    const fetchErrors: string[] = [];
    const fetches = Object.entries(C2_SOURCES).map(async ([framework, url]) => {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "TrustRadar/2.0" },
        });
        if (!res.ok) {
          fetchErrors.push(`${framework}: HTTP ${res.status}`);
          return;
        }
        const text = await res.text();
        const ips = text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#") && IP_REGEX.test(l));
        if (ips.length === 0) {
          fetchErrors.push(`${framework}: 0 IP-format lines (response shape changed?)`);
        }
        for (const ip of ips) {
          entries.push({ ip, framework });
        }
      } catch (err) {
        fetchErrors.push(`${framework}: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
    await Promise.all(fetches);

    // Deduplicate by IP (keep first framework seen)
    const seen = new Set<string>();
    const unique: Array<{ ip: string; framework: string }> = [];
    for (const entry of entries) {
      if (!seen.has(entry.ip)) {
        seen.add(entry.ip);
        unique.push(entry);
      }
    }

    const toProcess = unique.slice(0, MAX_TOTAL_IPS);
    let itemsNew = 0;
    let firstError: string | null = null;

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      const stmts = batch.map(({ ip, framework }) =>
        db.prepare(
          `INSERT OR IGNORE INTO threats
            (id, source_feed, threat_type, malicious_url, malicious_domain,
             ip_address, ioc_value, severity, confidence_score, status,
             title, tags, first_seen, last_seen, created_at)
           VALUES (?, 'c2_tracker', 'c2', NULL, NULL,
                   ?, ?, 'critical', 95, 'active',
                   ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
        ).bind(
          threatId("c2_tracker", "ip", ip),
          ip,
          ip,
          `${framework} C2 Server`,
          JSON.stringify([framework.toLowerCase().replace(/\s+/g, "_")]),
        ),
      );

      try {
        const results = await db.batch(stmts);
        itemsNew += results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
      } catch (e) {
        if (!firstError) firstError = String(e);
      }
    }

    // Update last_seen for existing IPs
    if (itemsNew < toProcess.length) {
      const updateBatch = toProcess.slice(0, Math.min(toProcess.length, 200));
      const updateStmts = updateBatch.map(({ ip }) =>
        db.prepare(
          `UPDATE threats SET last_seen = datetime('now')
           WHERE ip_address = ? AND source_feed = 'c2_tracker'`,
        ).bind(ip),
      );
      try {
        await db.batch(updateStmts);
      } catch { /* non-fatal */ }
    }

    // KV dedup cache
    const kvPromises = toProcess.slice(0, 200).map(({ ip }) =>
      ctx.env.CACHE.put(`dedup:ip:${ip}`, "1", { expirationTtl: 86400 }).catch(() => {}),
    );
    await Promise.all(kvPromises);

    // If every fetch failed silently the loop never ran — surface
    // the first fetch error so the feed pull row carries diagnostic
    // info instead of looking like a clean 0-record run.
    if (entries.length === 0 && fetchErrors.length > 0) {
      throw new Error(`c2_tracker fetch failures: ${fetchErrors.slice(0, 3).join('; ')}`);
    }

    return {
      itemsFetched: unique.length,
      itemsNew,
      itemsDuplicate: toProcess.length - itemsNew,
      itemsError: firstError ? 1 : 0,
    };
  },
};
