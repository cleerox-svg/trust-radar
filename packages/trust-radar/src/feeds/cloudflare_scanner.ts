import type { FeedModule, FeedContext, FeedResult } from "./types";

/**
 * Cloudflare Radar URL Scanner — Two-phase feed.
 *
 * Phase 1 (SUBMIT): Submits unscanned threat URLs to CF URL Scanner.
 * Phase 2 (COLLECT): Polls for scan results and enriches threats with verdicts.
 *
 * Uses the Worker's own CF account via CF_ACCOUNT_ID + CF_API_TOKEN secrets.
 * Rate: 10 submissions per cycle, 20 result polls per cycle.
 * Schedule: every 30 minutes (cron handles both phases each run).
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

async function cfFetch<T>(accountId: string, token: string, path: string, init?: RequestInit): Promise<T | null> {
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
    if (res.status === 404) return null; // scan still in progress
    if (!res.ok) {
      console.error(`[cf_scanner] HTTP ${res.status} for ${path}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    return await res.json() as T;
  } catch (err) {
    console.error(`[cf_scanner] fetch error for ${path}:`, err);
    return null;
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

    let submitted = 0, collected = 0, errors = 0;

    // ─── Phase 1: SUBMIT unscanned URLs ─────────────────────────
    const toScan = await ctx.env.DB.prepare(
      `SELECT id, malicious_url FROM threats
       WHERE cf_scan_id IS NULL
         AND malicious_url IS NOT NULL
         AND created_at > datetime('now', '-24 hours')
       ORDER BY confidence_score ASC
       LIMIT 10`,
    ).all<{ id: string; malicious_url: string }>();

    console.log(`[cf_scanner] Phase 1: ${toScan.results.length} URLs to submit`);

    for (const row of toScan.results) {
      const resp = await cfFetch<CfScanSubmitResponse>(accountId, token, "/v2/scan", {
        method: "POST",
        body: JSON.stringify({ url: row.malicious_url, visibility: "Unlisted" }),
      });

      if (resp?.success && resp.result?.uuid) {
        await ctx.env.DB.prepare(
          "UPDATE threats SET cf_scan_id = ? WHERE id = ?",
        ).bind(resp.result.uuid, row.id).run();
        submitted++;
        console.log(`[cf_scanner] submitted ${row.malicious_url} → ${resp.result.uuid}`);
      } else {
        errors++;
        console.error(`[cf_scanner] submit failed for ${row.malicious_url}: ${JSON.stringify(resp?.errors ?? [])}`);
      }

      // Brief pause between submissions
      await new Promise((r) => setTimeout(r, 200));
    }

    // ─── Phase 2: COLLECT results ───────────────────────────────
    const pending = await ctx.env.DB.prepare(
      `SELECT id, cf_scan_id FROM threats
       WHERE cf_scan_id IS NOT NULL AND cf_verdict IS NULL
       LIMIT 20`,
    ).all<{ id: string; cf_scan_id: string }>();

    console.log(`[cf_scanner] Phase 2: ${pending.results.length} scans to poll`);

    for (const row of pending.results) {
      const resp = await cfFetch<CfScanResultResponse>(accountId, token, `/v2/result/${row.cf_scan_id}`);

      if (!resp) {
        // 404 = still in progress, skip
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

      // Update threat with verdict and adjust confidence
      await ctx.env.DB.prepare(
        `UPDATE threats SET
          cf_verdict = ?,
          cf_categories = ?,
          confidence_score = CASE
            WHEN ? = 1 THEN MAX(COALESCE(confidence_score, 0), 90)
            WHEN ? = 0 AND COALESCE(confidence_score, 0) > 50 THEN confidence_score - 20
            ELSE confidence_score
          END
        WHERE id = ?`,
      ).bind(
        verdict,
        categories.length > 0 ? JSON.stringify(categories) : null,
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

    console.log(`[cf_scanner] done: submitted=${submitted}, collected=${collected}, errors=${errors}`);

    return {
      itemsFetched: toScan.results.length + pending.results.length,
      itemsNew: collected,
      itemsDuplicate: 0,
      itemsError: errors,
    };
  },
};
