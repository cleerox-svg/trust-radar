/**
 * Certificate Transparency Monitor API Handlers — List, stats, update, and
 * trigger CT certificate scans for monitored brands.
 */

import { json } from "../lib/cors";
import { pollCertificates, checkCertForBrand } from "../scanners/ct-monitor";
import { logger } from "../lib/logger";
import type { Env } from "../types";

// ─── GET /api/ct/certificates/:brandId — List certificates for a brand ───

export async function handleListCertificates(
  request: Request,
  env: Env,
  brandId: string,
  userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Verify brand ownership
    const brand = await env.DB.prepare(
      "SELECT id FROM brand_profiles WHERE id = ? AND user_id = ?",
    ).bind(brandId, userId).first<{ id: string }>();

    if (!brand) {
      return json({ success: false, error: "Brand profile not found" }, 404, origin);
    }

    const url = new URL(request.url);
    const suspicious = url.searchParams.get("suspicious");
    const status = url.searchParams.get("status");
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    let where = "WHERE brand_id = ?";
    const params: unknown[] = [brandId];

    if (suspicious !== null) {
      where += " AND suspicious = ?";
      params.push(parseInt(suspicious, 10));
    }
    if (status) {
      where += " AND status = ?";
      params.push(status);
    }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM ct_certificates ${where}`,
    ).bind(...params).first<{ n: number }>();
    const total = countRow?.n ?? 0;

    const rows = await env.DB.prepare(
      `SELECT * FROM ct_certificates ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).bind(...params, limit, offset).all();

    return json({ success: true, data: rows.results, total }, 200, origin);
  } catch (err) {
    logger.error("ct_handler_list_error", { error: String(err) });
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/ct/certificates/:brandId/stats — Certificate stats ───

export async function handleCertStats(
  request: Request,
  env: Env,
  brandId: string,
  userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Verify brand ownership
    const brand = await env.DB.prepare(
      "SELECT id FROM brand_profiles WHERE id = ? AND user_id = ?",
    ).bind(brandId, userId).first<{ id: string }>();

    if (!brand) {
      return json({ success: false, error: "Brand profile not found" }, 404, origin);
    }

    const totalRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM ct_certificates WHERE brand_id = ?",
    ).bind(brandId).first<{ n: number }>();

    const suspiciousRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM ct_certificates WHERE brand_id = ? AND suspicious = 1",
    ).bind(brandId).first<{ n: number }>();

    const newRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM ct_certificates WHERE brand_id = ? AND status = 'new'",
    ).bind(brandId).first<{ n: number }>();

    const maliciousRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM ct_certificates WHERE brand_id = ? AND status = 'malicious'",
    ).bind(brandId).first<{ n: number }>();

    const benignRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM ct_certificates WHERE brand_id = ? AND status = 'benign'",
    ).bind(brandId).first<{ n: number }>();

    const reviewedRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM ct_certificates WHERE brand_id = ? AND status = 'reviewed'",
    ).bind(brandId).first<{ n: number }>();

    // Recent certificates (last 24h)
    const recentRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM ct_certificates WHERE brand_id = ? AND created_at >= datetime('now', '-24 hours')",
    ).bind(brandId).first<{ n: number }>();

    // Top issuers
    const issuers = await env.DB.prepare(
      `SELECT issuer, COUNT(*) AS count
       FROM ct_certificates WHERE brand_id = ? AND issuer IS NOT NULL
       GROUP BY issuer ORDER BY count DESC LIMIT 5`,
    ).bind(brandId).all<{ issuer: string; count: number }>();

    return json({
      success: true,
      data: {
        total: totalRow?.n ?? 0,
        suspicious: suspiciousRow?.n ?? 0,
        by_status: {
          new: newRow?.n ?? 0,
          reviewed: reviewedRow?.n ?? 0,
          benign: benignRow?.n ?? 0,
          malicious: maliciousRow?.n ?? 0,
        },
        last_24h: recentRow?.n ?? 0,
        top_issuers: issuers.results,
      },
    }, 200, origin);
  } catch (err) {
    logger.error("ct_handler_stats_error", { error: String(err) });
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── PATCH /api/ct/certificates/:id — Update certificate status ───

export async function handleUpdateCertificate(
  request: Request,
  env: Env,
  id: string,
  userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Verify ownership via brand_profiles join
    const existing = await env.DB.prepare(
      `SELECT ct.id, ct.brand_id
       FROM ct_certificates ct
       JOIN brand_profiles bp ON bp.id = ct.brand_id
       WHERE ct.id = ? AND bp.user_id = ?`,
    ).bind(id, userId).first<{ id: string; brand_id: string }>();

    if (!existing) {
      return json({ success: false, error: "Certificate not found" }, 404, origin);
    }

    const body = await request.json().catch(() => null) as {
      status?: string;
      ai_assessment?: string;
    } | null;

    if (!body) {
      return json({ success: false, error: "Request body is required" }, 400, origin);
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.status !== undefined) {
      const validStatuses = ["new", "reviewed", "benign", "malicious"];
      if (!validStatuses.includes(body.status)) {
        return json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        }, 400, origin);
      }
      updates.push("status = ?");
      values.push(body.status);
    }

    if (body.ai_assessment !== undefined) {
      updates.push("ai_assessment = ?");
      values.push(body.ai_assessment);
    }

    if (updates.length === 0) {
      return json({ success: false, error: "No valid fields to update" }, 400, origin);
    }

    values.push(id);

    await env.DB.prepare(
      `UPDATE ct_certificates SET ${updates.join(", ")} WHERE id = ?`,
    ).bind(...values).run();

    const updated = await env.DB.prepare(
      "SELECT * FROM ct_certificates WHERE id = ?",
    ).bind(id).first();

    return json({ success: true, data: updated }, 200, origin);
  } catch (err) {
    logger.error("ct_handler_update_error", { error: String(err) });
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── POST /api/ct/scan/:brandId — Trigger immediate CT scan ───

export async function handleTriggerCTScan(
  request: Request,
  env: Env,
  brandId: string,
  userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Verify brand ownership and get domain
    const brand = await env.DB.prepare(
      `SELECT bp.id, bp.brand_id, COALESCE(bp.domain, b.canonical_domain) AS domain, bp.brand_keywords
       FROM brand_profiles bp
       JOIN brands b ON b.id = bp.brand_id
       WHERE bp.id = ? AND bp.user_id = ?`,
    ).bind(brandId, userId).first<{ id: string; brand_id: string; domain: string | null; brand_keywords: string | null }>();

    if (!brand) {
      return json({ success: false, error: "Brand profile not found" }, 404, origin);
    }

    if (!brand.domain) {
      return json({ success: false, error: "Brand profile has no domain configured" }, 400, origin);
    }

    const keywords = brand.brand_keywords
      ? JSON.parse(brand.brand_keywords) as string[]
      : [];

    // Run CT scan immediately for this brand
    const result = await checkCertForBrand(env, brand.brand_id, brand.domain, keywords, userId);

    logger.info("ct_scan_triggered", {
      brand_id: brandId,
      user_id: userId,
      total: result.total,
      suspicious: result.suspicious,
      new_certs: result.newCerts,
    });

    return json({
      success: true,
      data: {
        brand_id: brandId,
        domain: brand.domain,
        certificates_found: result.total,
        new_certificates: result.newCerts,
        suspicious: result.suspicious,
        message: "CT scan completed.",
      },
    }, 200, origin);
  } catch (err) {
    logger.error("ct_handler_scan_error", { error: String(err) });
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
