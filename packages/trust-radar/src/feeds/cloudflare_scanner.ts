import type { FeedModule, FeedContext, FeedResult } from "./types";

/**
 * Cloudflare Radar URL Scanner — Two-phase feed.
 *
 * Phase 1 (SUBMIT): Submits unscanned threat URLs to CF URL Scanner.
 *   - 50 per cycle, prioritised: brand-matched phishing > typosquat > C2 > rest
 * Phase 2 (COLLECT): Polls for scan results and enriches threats with verdicts.
 *   - 100 polls per cycle
 *   - Auto-remediates false positives when CF verdict is clean
 *
 * Uses CF_ACCOUNT_ID + CF_API_TOKEN secrets.
 * Schedule: every 30 minutes via feed_configs cron.
 */

interface CfScanSubmitResponse {
  success: boolean;
  result?: { uuid: string };
  errors?: Array<{ message: string }>;
}

interface CfScanResultResponse {
  success: boolean;
  result?: {
    scan?: {
      verdicts?: {
        overall?: {
          malicious: boolean;
          categories?: string[];
        };
      };
      meta?: {
        processors?: {
          phishing?: { phishingDetected?: boolean; brand?: string };
          rank?: { bucket?: string; rank?: number };
        };
      };
      page?: {
        url?: string;
        country?: string;
        ip?: string;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

async function cfFetch<T>(accountId: string, token: string, path: string, init?: RequestInit): Promise<{ parsed: T | null; raw: string; status: number }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/urlscanner${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    const raw = await res.text();
    if (res.status === 404) return { parsed: null, raw, status: 404 };
    if (!res.ok) {
      console.error(`[cf_scanner] HTTP ${res.status} for ${path}: ${raw.slice(0, 300)}`);
      return { parsed: null, raw, status: res.status };
    }
    try {
      return { parsed: JSON.parse(raw) as T, raw, status: res.status };
    } catch {
      console.error(`[cf_scanner] JSON parse error for ${path}: ${raw.slice(0, 300)}`);
      return { parsed: null, raw, status: res.status };
    }
  } catch (err) {
    console.error(`[cf_scanner] fetch error for ${path}:`, err);
    return { parsed: null, raw: String(err), status: 0 };
  }
}

export const cloudflare_scanner: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const accountId = ctx.env.CF_ACCOUNT_ID;
    const token = ctx.env.CF_API_TOKEN;

    console.log(`[cf_scanner] starting, account_id=${accountId ? 'set' : 'MISSING'}, token=${token ? 'set' : 'MISSING'}`);

    // Write diagnostic to agent_outputs for visibility in UI
    try {
      await ctx.env.DB.prepare(
        "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))",
      ).bind(
        'diag_cf_scanner_' + Date.now(),
        `CF Scanner: account_id=${accountId ? 'set' : 'MISSING'}, token=${token ? 'set' : 'MISSING'}`,
      ).run();
    } catch { /* non-fatal */ }

    if (!accountId || !token) {
      console.warn("[cf_scanner] CF_ACCOUNT_ID or CF_API_TOKEN not configured — skipping");
      return { itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, itemsError: 0 };
    }

    let submitted = 0, collected = 0, errors = 0, maliciousCount = 0;

    // ─── Phase 1: SUBMIT unscanned URLs (50 per cycle, prioritised) ──
    const toScan = await ctx.env.DB.prepare(
      `SELECT id, malicious_url FROM threats
       WHERE cf_scan_id IS NULL
         AND malicious_url IS NOT NULL
       ORDER BY
         CASE WHEN target_brand_id IS NOT NULL THEN 0 ELSE 1 END,
         CASE WHEN threat_type = 'phishing' THEN 0
              WHEN threat_type = 'typosquatting' THEN 1
              WHEN threat_type = 'c2' THEN 2
              ELSE 3 END,
         created_at DESC
       LIMIT 50`,
    ).all<{ id: string; malicious_url: string }>();

    // Diagnostic: log how many the query found
    try {
      const eligible = await ctx.env.DB.prepare(
        `SELECT COUNT(*) as c FROM threats WHERE cf_scan_id IS NULL AND malicious_url IS NOT NULL`
      ).first<{ c: number }>();
      await ctx.env.DB.prepare(
        "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))"
      ).bind(
        'diag_cf_phase1_' + Date.now(),
        `CF Scanner Phase 1: query returned ${toScan.results.length} threats to submit (${eligible?.c ?? '?'} total eligible)`,
      ).run();
    } catch { /* non-fatal */ }

    console.log(`[cf_scanner] Phase 1: ${toScan.results.length} URLs to submit`);

    for (const row of toScan.results) {
      const { parsed: resp, raw, status } = await cfFetch<CfScanSubmitResponse>(accountId, token, "/v2/scan", {
        method: "POST",
        body: JSON.stringify({ url: row.malicious_url, visibility: "Unlisted" }),
      });

      console.log(`[cf_scanner] submit response for ${row.malicious_url}: status=${status}, success=${resp?.success}, uuid=${resp?.result?.uuid ?? 'NONE'}, raw=${raw.slice(0, 200)}`);

      if (resp?.success && resp.result?.uuid) {
        const updateResult = await ctx.env.DB.prepare(
          "UPDATE threats SET cf_scan_id = ? WHERE id = ?",
        ).bind(resp.result.uuid, row.id).run();
        console.log(`[cf_scanner] UPDATE cf_scan_id for ${row.id}: changes=${updateResult.meta.changes}, uuid=${resp.result.uuid}`);

        if (updateResult.meta.changes === 0) {
          console.error(`[cf_scanner] UPDATE cf_scan_id FAILED — 0 rows changed for id=${row.id}`);
          errors++;
        } else {
          submitted++;
        }
      } else {
        errors++;
        console.error(`[cf_scanner] submit failed for ${row.malicious_url}: status=${status}, errors=${JSON.stringify(resp?.errors ?? [])}, raw=${raw.slice(0, 300)}`);
      }

      // Brief pause between submissions
      await new Promise((r) => setTimeout(r, 200));
    }

    // ─── Phase 2: COLLECT results (100 polls per cycle) ──────────
    const pending = await ctx.env.DB.prepare(
      `SELECT id, cf_scan_id FROM threats
       WHERE cf_scan_id IS NOT NULL AND cf_verdict IS NULL
       LIMIT 100`,
    ).all<{ id: string; cf_scan_id: string }>();

    console.log(`[cf_scanner] Phase 2: ${pending.results.length} scans to poll`);

    for (const row of pending.results) {
      const { parsed: resp, status } = await cfFetch<CfScanResultResponse>(accountId, token, `/v2/result/${row.cf_scan_id}`);

      if (!resp) {
        // 404 = still in progress, skip
        if (status === 404) console.log(`[cf_scanner] ${row.cf_scan_id}: still in progress (404)`);
        else console.error(`[cf_scanner] ${row.cf_scan_id}: poll failed status=${status}`);
        continue;
      }

      if (!resp.success || !resp.result?.scan) {
        errors++;
        continue;
      }

      const scan = resp.result.scan;
      const isMalicious = scan.verdicts?.overall?.malicious ?? false;
      const categories = scan.verdicts?.overall?.categories ?? [];
      const verdict = isMalicious ? "malicious" : "clean";
      if (isMalicious) maliciousCount++;

      // Update threat with verdict and adjust confidence + auto-remediate
      await ctx.env.DB.prepare(
        `UPDATE threats SET
          cf_verdict = ?,
          cf_categories = ?,
          confidence_score = CASE
            WHEN ? = 1 THEN MAX(COALESCE(confidence_score, 0), 90)
            WHEN ? = 0 AND COALESCE(confidence_score, 0) > 50 THEN confidence_score - 20
            ELSE confidence_score
          END,
          status = CASE
            WHEN ? = 0 AND COALESCE(confidence_score, 0) <= 50 THEN 'remediated'
            ELSE status
          END
        WHERE id = ?`,
      ).bind(
        verdict,
        categories.length > 0 ? JSON.stringify(categories) : null,
        isMalicious ? 1 : 0,
        isMalicious ? 1 : 0,
        isMalicious ? 1 : 0,
        row.id,
      ).run();

      collected++;
      console.log(`[cf_scanner] ${row.cf_scan_id}: verdict=${verdict} categories=${categories.join(",") || "none"}`);

      // If CF provides hosting IP/country, update if missing
      if (scan.page?.ip || scan.page?.country) {
        try {
          await ctx.env.DB.prepare(
            `UPDATE threats SET
              ip_address = COALESCE(ip_address, ?),
              country_code = COALESCE(country_code, ?)
            WHERE id = ? AND (ip_address IS NULL OR country_code IS NULL)`,
          ).bind(scan.page.ip ?? null, scan.page.country ?? null, row.id).run();
        } catch { /* non-fatal */ }
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    // Summary diagnostic
    const summary = `CF Scanner done: submitted=${submitted}, collected=${collected}, malicious=${maliciousCount}, errors=${errors}`;
    console.log(`[cf_scanner] ${summary}`);
    try {
      await ctx.env.DB.prepare(
        "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))"
      ).bind('diag_cf_done_' + Date.now(), summary).run();
    } catch { /* non-fatal */ }

    return {
      itemsFetched: toScan.results.length + pending.results.length,
      itemsNew: collected,
      itemsDuplicate: 0,
      itemsError: errors,
    };
  },
};
