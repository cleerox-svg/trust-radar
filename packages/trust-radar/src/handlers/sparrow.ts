/**
 * Sparrow (Takedown Pipeline) API Handlers
 *
 * POST /api/admin/sparrow/scan-capture/:id  — Scan URLs from a specific capture
 * POST /api/admin/sparrow/scan-batch        — Batch scan unprocessed captures
 * GET  /api/admin/sparrow/results/:captureId — Get scan results for a capture
 * GET  /api/admin/sparrow/malicious         — List all malicious URL scan results
 * GET  /api/admin/sparrow/providers         — List takedown providers
 */

import { handler, success, error } from "../lib/handler-utils";
import { scanCaptureUrls, scanUnprocessedCaptures } from "../lib/url-scanner";

// ── POST /api/admin/sparrow/scan-capture/:id ─────────────────────

export const handleScanCapture = (captureId: string) => handler(async (_request, env, ctx) => {
  const id = parseInt(captureId, 10);
  if (isNaN(id)) return error("Invalid capture ID", 400, ctx.origin);

  const results = await scanCaptureUrls(env, id);
  return success({
    urls_scanned: results.length,
    malicious: results.filter(r => r.is_malicious).length,
    results,
  }, ctx.origin);
});

// ── POST /api/admin/sparrow/scan-batch ──────────────────────────

export const handleScanBatch = handler(async (_request, env, ctx) => {
  const result = await scanUnprocessedCaptures(env);
  return success(result, ctx.origin);
});

// ── GET /api/admin/sparrow/results/:captureId ───────────────────

export const handleScanResults = (captureId: string) => handler(async (_request, env, ctx) => {
  const results = await env.DB.prepare(
    "SELECT * FROM url_scan_results WHERE source_type = 'spam_trap' AND source_id = ? ORDER BY confidence_score DESC"
  ).bind(captureId).all();
  return success(results.results, ctx.origin);
});

// ── GET /api/admin/sparrow/malicious ────────────────────────────

export const handleMaliciousResults = handler(async (_request, env, ctx) => {
  const results = await env.DB.prepare(`
    SELECT usr.*, b.name as brand_name
    FROM url_scan_results usr
    LEFT JOIN brands b ON b.id = usr.brand_id
    WHERE usr.is_malicious = 1
    ORDER BY usr.scanned_at DESC
    LIMIT 100
  `).all();
  return success(results.results, ctx.origin);
});

// ── GET /api/admin/sparrow/providers ────────────────────────────

export const handleProviders = handler(async (_request, env, ctx) => {
  const results = await env.DB.prepare(
    "SELECT * FROM takedown_providers ORDER BY provider_type, provider_name"
  ).all();
  return success(results.results, ctx.origin);
});
