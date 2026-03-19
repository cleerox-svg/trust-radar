/**
 * Email Security Posture — API Route Handlers
 *
 * GET  /api/email-security/:brandId          → Get latest scan for a brand
 * POST /api/email-security/scan/:brandId     → Trigger manual scan for a brand
 * GET  /api/email-security/scan-all          → Trigger scan of all brands (admin)
 * GET  /api/v1/public/email-security/:domain → Public endpoint (live scan)
 * GET  /api/email-security/stats             → Aggregate grade distribution stats
 */

import { json } from '../lib/cors';
import { runEmailSecurityScan, saveEmailSecurityScan } from '../email-security';
import type { Env } from '../types';

// ─── GET /api/email-security/:brandId ─────────────────────────────────────

export async function handleGetEmailSecurity(
  request: Request,
  env: Env,
  brandId: string,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const row = await env.DB.prepare(`
      SELECT * FROM email_security_scans
      WHERE brand_id = ?
      ORDER BY scanned_at DESC
      LIMIT 1
    `).bind(brandId).first<Record<string, unknown>>();

    if (!row) {
      return json({ success: true, data: null }, 200, origin);
    }

    return json({
      success: true,
      data: {
        ...row,
        dkim_selectors_found: safeJson(row.dkim_selectors_found as string, []),
        mx_providers: safeJson(row.mx_providers as string, []),
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── POST /api/email-security/scan/:brandId ───────────────────────────────

export async function handleScanBrandEmailSecurity(
  request: Request,
  env: Env,
  brandId: string,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const brand = await env.DB.prepare(
      'SELECT id, canonical_domain, name FROM brands WHERE id = ?'
    ).bind(brandId).first<{ id: number; canonical_domain: string | null; name: string }>();

    if (!brand) {
      return json({ success: false, error: 'Brand not found' }, 404, origin);
    }

    // Fall back to lowercase name if canonical_domain is not set
    const domain = brand.canonical_domain || brand.name.toLowerCase();
    if (!domain) {
      return json({ success: false, error: 'Brand has no domain or name' }, 400, origin);
    }

    const result = await runEmailSecurityScan(domain);
    await saveEmailSecurityScan(env.DB, brand.id, result);

    await env.DB.prepare(`
      UPDATE brands
      SET email_security_score = ?, email_security_grade = ?, email_security_scanned_at = datetime('now')
      WHERE id = ?
    `).bind(result.score, result.grade, brand.id).run();

    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/email-security/scan-all (admin) ─────────────────────────────

export async function handleScanAllEmailSecurity(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);

    const brandsToScan = await env.DB.prepare(`
      SELECT b.id, b.canonical_domain AS domain
      FROM brands b
      WHERE b.canonical_domain IS NOT NULL
        AND (b.email_security_scanned_at IS NULL
             OR b.email_security_scanned_at < datetime('now', '-7 days'))
      ORDER BY b.email_security_scanned_at ASC NULLS FIRST
      LIMIT ?
    `).bind(limit).all<{ id: number; domain: string }>();

    let scanned = 0;
    let errors = 0;

    for (const brand of brandsToScan.results) {
      try {
        const result = await runEmailSecurityScan(brand.domain);
        await saveEmailSecurityScan(env.DB, brand.id, result);
        await env.DB.prepare(`
          UPDATE brands
          SET email_security_score = ?, email_security_grade = ?, email_security_scanned_at = datetime('now')
          WHERE id = ?
        `).bind(result.score, result.grade, brand.id).run();
        scanned++;
      } catch (e) {
        console.error(`[email-security] scan failed for ${brand.domain}:`, e);
        errors++;
      }
    }

    return json({
      success: true,
      data: { scanned, errors, total: brandsToScan.results.length },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/v1/public/email-security/:domain ────────────────────────────

export async function handlePublicEmailSecurity(
  request: Request,
  env: Env,
  rawDomain: string,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const startTime = Date.now();

  // Normalize domain
  const domain = rawDomain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');

  if (!domain || !domain.includes('.')) {
    return json({ success: false, error: 'Invalid domain' }, 400, origin);
  }

  try {
    // Check KV cache first (1 hour TTL)
    const cacheKey = `email-sec:${domain}`;
    const cached = await env.CACHE.get(cacheKey, 'json') as Record<string, unknown> | null;
    if (cached) {
      return json({ success: true, data: cached, cached: true }, 200, origin);
    }

    // Run live scan
    const result = await runEmailSecurityScan(domain);

    // Cache result for 1 hour
    await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 });

    // If domain matches a monitored brand, persist to DB
    const brand = await env.DB.prepare(
      "SELECT id FROM brands WHERE canonical_domain = ?"
    ).bind(domain).first<{ id: number }>();

    if (brand) {
      await saveEmailSecurityScan(env.DB, brand.id, result);
      await env.DB.prepare(`
        UPDATE brands
        SET email_security_score = ?, email_security_grade = ?, email_security_scanned_at = datetime('now')
        WHERE id = ?
      `).bind(result.score, result.grade, brand.id).run();
    }

    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/email-security/stats ────────────────────────────────────────

export async function handleEmailSecurityStats(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const [gradeRows, totalRow, unscannedRow, worstBrands] = await Promise.all([
      // Grade distribution
      env.DB.prepare(`
        SELECT email_security_grade AS grade, COUNT(*) AS count
        FROM brands
        WHERE email_security_grade IS NOT NULL
        GROUP BY email_security_grade
        ORDER BY CASE grade
          WHEN 'A+' THEN 1 WHEN 'A' THEN 2 WHEN 'B' THEN 3
          WHEN 'C' THEN 4 WHEN 'D' THEN 5 WHEN 'F' THEN 6 ELSE 7 END
      `).all<{ grade: string; count: number }>(),

      // Scanned total
      env.DB.prepare(
        "SELECT COUNT(*) AS n FROM brands WHERE email_security_score IS NOT NULL"
      ).first<{ n: number }>(),

      // Unscanned count
      env.DB.prepare(
        "SELECT COUNT(*) AS n FROM brands WHERE email_security_score IS NULL"
      ).first<{ n: number }>(),

      // Worst-protected brands (all F/D/C grades, up to 200)
      env.DB.prepare(`
        SELECT b.id, b.name, b.canonical_domain, b.email_security_score, b.email_security_grade,
               (SELECT COUNT(*) FROM threats t WHERE t.target_brand_id = b.id AND t.status = 'active') AS active_threats
        FROM brands b
        WHERE b.email_security_score IS NOT NULL AND b.email_security_grade IN ('F', 'D', 'C')
        ORDER BY b.email_security_score ASC
        LIMIT 200
      `).all<{
        id: string; name: string; canonical_domain: string;
        email_security_score: number; email_security_grade: string;
        active_threats: number;
      }>(),
    ]);

    // DMARC policy distribution (from latest scans)
    const dmarcRows = await env.DB.prepare(`
      SELECT dmarc_policy, COUNT(*) AS count
      FROM email_security_scans ess
      WHERE ess.id IN (
        SELECT MAX(id) FROM email_security_scans GROUP BY brand_id
      )
      GROUP BY dmarc_policy
    `).all<{ dmarc_policy: string | null; count: number }>();

    const avgRow = await env.DB.prepare(
      "SELECT AVG(email_security_score) AS avg FROM brands WHERE email_security_score IS NOT NULL"
    ).first<{ avg: number | null }>();

    return json({
      success: true,
      data: {
        grade_distribution: gradeRows.results,
        dmarc_distribution: dmarcRows.results,
        total_scanned: totalRow?.n ?? 0,
        total_unscanned: unscannedRow?.n ?? 0,
        average_score: Math.round(avgRow?.avg ?? 0),
        worst_brands: worstBrands.results,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}
