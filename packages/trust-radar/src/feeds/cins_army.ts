import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";
import { diagnosticFetch } from "../lib/feedDiagnostic";

const CINS_URL = "https://cinsscore.com/list/ci-badguys.txt";

/**
 * CINS Army — Verified malicious IP addresses from honeypot network.
 * Enriches existing threats and stores new IPs that match existing data.
 * Limits new entries to 200 per pull.
 * Schedule: daily.
 */
export const cins_army: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const db = ctx.env.DB;
    const url = ctx.feedUrl || CINS_URL;

    // DB diagnostic: proves ingest() was called
    try {
      await db.prepare(
        "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))"
      ).bind('diag_cins_called_' + Date.now(), `CINS Army ingest() called — url=${url}`).run();
    } catch { /* non-fatal */ }

    const res = await diagnosticFetch(db, "cins_army", url, {
      headers: { "User-Agent": "trust-radar/2.0" },
    });
    if (!res.ok) throw new Error(`CINS Army HTTP ${res.status}`);

    const text = await res.text();
    const ips = text.split("\n").map((l) => l.trim()).filter((l) => l && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(l));

    // DB diagnostic: parsed count + first IP
    try {
      await db.prepare(
        "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))"
      ).bind('diag_cins_parsed_' + Date.now(), `CINS Army parsed ${ips.length} IPs, first=${ips[0] ?? 'NONE'}, attempting inserts...`).run();
    } catch { /* non-fatal */ }

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0, itemsEnriched = 0;
    let firstError: string | null = null;
    let firstInsertLogged = false;
    const MAX_NEW = 200;

    for (const ip of ips) {
      try {
        const existing = await db.prepare(
          "SELECT id, confidence_score FROM threats WHERE ip_address = ? LIMIT 1"
        ).bind(ip).first<{ id: string; confidence_score: number | null }>();

        if (existing) {
          const newScore = Math.max(existing.confidence_score ?? 0, 80);
          await db.prepare(
            "UPDATE threats SET confidence_score = ?, last_seen = datetime('now') WHERE id = ?"
          ).bind(newScore, existing.id).run();
          itemsEnriched++;
          itemsDuplicate++;
          continue;
        }

        if (itemsNew >= MAX_NEW) continue;
        if (await isDuplicate(ctx.env, "ip", ip)) { itemsDuplicate++; continue; }

        const tid = threatId("cins_army", "ip", ip);
        await insertThreat(db, {
          id: tid,
          source_feed: "cins_army",
          threat_type: "malicious_ip",
          malicious_url: null,
          malicious_domain: null,
          ip_address: ip,
          ioc_value: ip,
          severity: "medium",
          confidence_score: 75,
        });
        await markSeen(ctx.env, "ip", ip);
        itemsNew++;

        // Log first successful insert
        if (!firstInsertLogged) {
          firstInsertLogged = true;
          try {
            await db.prepare(
              "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))"
            ).bind('diag_cins_insert_' + Date.now(), `CINS Army first insert SUCCESS: ip=${ip}, id=${tid}`).run();
          } catch { /* non-fatal */ }
        }
      } catch (e) {
        itemsError++;
        if (!firstError) firstError = String(e);
        // Log first insert error to DB
        if (itemsError === 1) {
          try {
            await db.prepare(
              "INSERT INTO agent_outputs (id, agent_id, type, summary, severity, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, 'high', datetime('now'))"
            ).bind('diag_cins_err_' + Date.now(), `CINS Army first insert ERROR: ip=${ip}, error=${String(e).slice(0, 300)}`).run();
          } catch { /* non-fatal */ }
        }
      }
    }

    // Summary diagnostic to DB
    const summary = `CINS Army done: total=${ips.length}, new=${itemsNew}, enriched=${itemsEnriched}, dup=${itemsDuplicate}, err=${itemsError}` +
      (firstError ? `, first_error=${firstError.slice(0, 200)}` : '');
    console.log(`[cins_army] ${summary}`);
    try {
      await db.prepare(
        "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))"
      ).bind('diag_cins_done_' + Date.now(), summary).run();
    } catch { /* non-fatal */ }

    return { itemsFetched: ips.length, itemsNew, itemsDuplicate, itemsError };
  },
};
