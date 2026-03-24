// DEPRECATED: These endpoints are superseded by the unified brand model.
// Social monitoring now operates on brands.id via /api/brands/:id/social-config
// and /api/brands/:id/social-profiles. These routes will be removed in a future release.

// Averrow — Brand Profile CRUD (Social Monitoring)

import { json } from "../lib/cors";
import { audit } from "../lib/audit";
import { generateAndStoreLookalikes } from "../scanners/lookalike-domains";
import { logger } from "../lib/logger";
import { generateBrandKeywords } from "../lib/brand-utils";
import type { Env } from "../types";

// ─── Tier limits ─────────────────────────────────────────────
const TIER_BRAND_LIMITS: Record<string, number> = {
  scan: 1,
  professional: 5,
  business: 20,
  enterprise: 100,
};

const SUPPORTED_PLATFORMS = ["twitter", "linkedin", "instagram", "tiktok", "github", "youtube"] as const;

// ─── Helpers ─────────────────────────────────────────────────


/** Normalize a domain string */
function normalizeDomain(raw: string): string {
  return raw.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
}

// ─── POST /api/brand-profiles — Create a monitored brand profile ───

export async function handleCreateBrand(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json().catch(() => null) as {
      domain?: string;
      brand_name?: string;
      official_handles?: Record<string, string>;
      aliases?: string[];
      monitoring_tier?: string;
    } | null;

    if (!body?.domain || !body?.brand_name) {
      return json({ success: false, error: "domain and brand_name are required" }, 400, origin);
    }

    const domain = normalizeDomain(body.domain);
    const brandName = body.brand_name.trim();
    const tier = body.monitoring_tier ?? "scan";

    // Validate tier
    if (!TIER_BRAND_LIMITS[tier]) {
      return json({ success: false, error: `Invalid monitoring_tier: ${tier}` }, 400, origin);
    }

    // Check user hasn't exceeded brand limit for their tier
    const existing = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM brand_profiles WHERE user_id = ? AND status != 'archived'"
    ).bind(userId).first<{ n: number }>();

    const limit = TIER_BRAND_LIMITS[tier]!;
    if ((existing?.n ?? 0) >= limit) {
      return json({
        success: false,
        error: `Brand limit reached for ${tier} tier (max ${limit}). Upgrade your plan to add more brands.`,
      }, 403, origin);
    }

    // Check for duplicate user+domain
    const dup = await env.DB.prepare(
      "SELECT id FROM brand_profiles WHERE user_id = ? AND domain = ?"
    ).bind(userId, domain).first<{ id: string }>();

    if (dup) {
      return json({ success: false, error: "You already have a brand profile for this domain" }, 409, origin);
    }

    const id = crypto.randomUUID();
    const keywords = generateBrandKeywords(domain, brandName);
    const aliases = body.aliases ?? [];
    const handles = body.official_handles ?? {};

    await env.DB.prepare(`
      INSERT INTO brand_profiles (id, user_id, domain, brand_name, aliases, official_handles, brand_keywords, monitoring_tier, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).bind(
      id, userId, domain, brandName,
      JSON.stringify(aliases),
      JSON.stringify(handles),
      JSON.stringify(keywords),
      tier,
    ).run();

    await audit(env, {
      action: "brand_profile_create",
      userId,
      resourceType: "brand_profile",
      resourceId: id,
      details: { domain, brand_name: brandName, tier },
      request,
    });

    const profile = await env.DB.prepare(
      "SELECT * FROM brand_profiles WHERE id = ?"
    ).bind(id).first();

    // Auto-generate lookalike domain permutations for continuous monitoring
    try {
      const lookalikeCount = await generateAndStoreLookalikes(env, id, domain);
      logger.info("brand_onboarding_lookalikes", {
        brand_id: id,
        domain,
        permutations_generated: lookalikeCount,
      });
    } catch (err) {
      // Non-fatal: log and continue — brand creation should still succeed
      logger.error("brand_onboarding_lookalikes_error", {
        brand_id: id,
        domain,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return json({ success: true, data: profile }, 201, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/brand-profiles — List user's brand profiles ───

export async function handleListBrands(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "active";
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const rows = await env.DB.prepare(`
      SELECT * FROM brand_profiles
      WHERE user_id = ? AND status = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, status, limit, offset).all();

    const total = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM brand_profiles WHERE user_id = ? AND status = ?"
    ).bind(userId, status).first<{ n: number }>();

    return json({ success: true, data: rows.results, total: total?.n ?? 0 }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/brand-profiles/:id — Get brand profile detail ───

export async function handleGetBrand(request: Request, env: Env, brandId: string, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const profile = await env.DB.prepare(
      "SELECT * FROM brand_profiles WHERE id = ? AND user_id = ?"
    ).bind(brandId, userId).first();

    if (!profile) {
      return json({ success: false, error: "Brand profile not found" }, 404, origin);
    }

    // Fetch latest social monitoring results summary
    const results = await env.DB.prepare(`
      SELECT platform, check_type, severity, status, COUNT(*) AS count
      FROM social_monitor_results
      WHERE brand_id = ?
      GROUP BY platform, check_type, severity, status
    `).bind(brandId).all();

    // Fetch schedule info
    const schedule = await env.DB.prepare(
      "SELECT platform, last_checked, next_check, check_interval_hours, enabled FROM social_monitor_schedule WHERE brand_id = ?"
    ).bind(brandId).all();

    return json({
      success: true,
      data: {
        ...profile,
        monitoring_summary: results.results,
        schedule: schedule.results,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── PATCH /api/brand-profiles/:id — Update brand profile ───

export async function handleUpdateBrand(request: Request, env: Env, brandId: string, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Verify ownership
    const existing = await env.DB.prepare(
      "SELECT id FROM brand_profiles WHERE id = ? AND user_id = ?"
    ).bind(brandId, userId).first();

    if (!existing) {
      return json({ success: false, error: "Brand profile not found" }, 404, origin);
    }

    const body = await request.json().catch(() => null) as {
      brand_name?: string;
      aliases?: string[];
      brand_keywords?: string[];
      executive_names?: string[];
      logo_url?: string;
      monitoring_tier?: string;
      status?: string;
    } | null;

    if (!body) {
      return json({ success: false, error: "Request body is required" }, 400, origin);
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.brand_name !== undefined) {
      updates.push("brand_name = ?");
      values.push(body.brand_name.trim());
    }
    if (body.aliases !== undefined) {
      updates.push("aliases = ?");
      values.push(JSON.stringify(body.aliases));
    }
    if (body.brand_keywords !== undefined) {
      updates.push("brand_keywords = ?");
      values.push(JSON.stringify(body.brand_keywords));
    }
    if (body.executive_names !== undefined) {
      updates.push("executive_names = ?");
      values.push(JSON.stringify(body.executive_names));
    }
    if (body.logo_url !== undefined) {
      updates.push("logo_url = ?");
      values.push(body.logo_url);
    }
    if (body.monitoring_tier !== undefined) {
      if (!TIER_BRAND_LIMITS[body.monitoring_tier]) {
        return json({ success: false, error: `Invalid monitoring_tier: ${body.monitoring_tier}` }, 400, origin);
      }
      updates.push("monitoring_tier = ?");
      values.push(body.monitoring_tier);
    }
    if (body.status !== undefined) {
      if (!["active", "paused", "archived"].includes(body.status)) {
        return json({ success: false, error: `Invalid status: ${body.status}` }, 400, origin);
      }
      updates.push("status = ?");
      values.push(body.status);
    }

    if (updates.length === 0) {
      return json({ success: false, error: "No fields to update" }, 400, origin);
    }

    updates.push("updated_at = datetime('now')");
    values.push(brandId, userId);

    await env.DB.prepare(`
      UPDATE brand_profiles SET ${updates.join(", ")}
      WHERE id = ? AND user_id = ?
    `).bind(...values).run();

    await audit(env, {
      action: "brand_profile_update",
      userId,
      resourceType: "brand_profile",
      resourceId: brandId,
      details: { fields: Object.keys(body) },
      request,
    });

    const updated = await env.DB.prepare(
      "SELECT * FROM brand_profiles WHERE id = ?"
    ).bind(brandId).first();

    return json({ success: true, data: updated }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── DELETE /api/brand-profiles/:id — Archive brand (soft delete) ───

export async function handleDeleteBrand(request: Request, env: Env, brandId: string, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM brand_profiles WHERE id = ? AND user_id = ?"
    ).bind(brandId, userId).first();

    if (!existing) {
      return json({ success: false, error: "Brand profile not found" }, 404, origin);
    }

    // Soft delete: set status to archived
    await env.DB.prepare(`
      UPDATE brand_profiles SET status = 'archived', updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(brandId, userId).run();

    // Disable all monitoring schedules
    await env.DB.prepare(
      "UPDATE social_monitor_schedule SET enabled = 0 WHERE brand_id = ?"
    ).bind(brandId).run();

    await audit(env, {
      action: "brand_profile_archive",
      userId,
      resourceType: "brand_profile",
      resourceId: brandId,
      request,
    });

    return json({ success: true, message: "Brand profile archived" }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── POST /api/brand-profiles/:id/handles — Add/update handles ───

export async function handleUpdateHandles(request: Request, env: Env, brandId: string, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Verify ownership
    const existing = await env.DB.prepare(
      "SELECT id, official_handles FROM brand_profiles WHERE id = ? AND user_id = ?"
    ).bind(brandId, userId).first<{ id: string; official_handles: string | null }>();

    if (!existing) {
      return json({ success: false, error: "Brand profile not found" }, 404, origin);
    }

    const body = await request.json().catch(() => null) as {
      handles?: Record<string, string>;
    } | null;

    if (!body?.handles || typeof body.handles !== "object") {
      return json({ success: false, error: "handles object is required, e.g. {\"twitter\": \"@acme\", \"linkedin\": \"acmecorp\"}" }, 400, origin);
    }

    // Validate platforms
    for (const platform of Object.keys(body.handles)) {
      if (!SUPPORTED_PLATFORMS.includes(platform as typeof SUPPORTED_PLATFORMS[number])) {
        return json({ success: false, error: `Unsupported platform: ${platform}. Supported: ${SUPPORTED_PLATFORMS.join(", ")}` }, 400, origin);
      }
    }

    // Merge with existing handles
    const currentHandles: Record<string, string> = existing.official_handles
      ? JSON.parse(existing.official_handles)
      : {};
    const mergedHandles = { ...currentHandles, ...body.handles };

    // Remove handles set to empty string
    for (const [k, v] of Object.entries(mergedHandles)) {
      if (v === "" || v === null) delete mergedHandles[k];
    }

    await env.DB.prepare(`
      UPDATE brand_profiles SET official_handles = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(JSON.stringify(mergedHandles), brandId, userId).run();

    // Upsert schedule entries for each platform with a handle
    for (const platform of Object.keys(mergedHandles)) {
      const scheduleId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO social_monitor_schedule (id, brand_id, platform, check_interval_hours, enabled)
        VALUES (?, ?, ?, 24, 1)
        ON CONFLICT (brand_id, platform) DO UPDATE SET enabled = 1
      `).bind(scheduleId, brandId, platform).run();
    }

    await audit(env, {
      action: "brand_profile_handles_update",
      userId,
      resourceType: "brand_profile",
      resourceId: brandId,
      details: { platforms: Object.keys(mergedHandles) },
      request,
    });

    return json({ success: true, data: { official_handles: mergedHandles } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/brand-profiles/:id/handles — Get handle status per platform ───

export async function handleGetHandles(request: Request, env: Env, brandId: string, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const profile = await env.DB.prepare(
      "SELECT id, official_handles FROM brand_profiles WHERE id = ? AND user_id = ?"
    ).bind(brandId, userId).first<{ id: string; official_handles: string | null }>();

    if (!profile) {
      return json({ success: false, error: "Brand profile not found" }, 404, origin);
    }

    const handles: Record<string, string> = profile.official_handles
      ? JSON.parse(profile.official_handles)
      : {};

    // Get latest check results per platform
    const results = await env.DB.prepare(`
      SELECT r.*
      FROM social_monitor_results r
      INNER JOIN (
        SELECT platform, MAX(created_at) AS max_created
        FROM social_monitor_results
        WHERE brand_id = ? AND check_type = 'handle_check'
        GROUP BY platform
      ) latest ON r.platform = latest.platform AND r.created_at = latest.max_created
      WHERE r.brand_id = ? AND r.check_type = 'handle_check'
    `).bind(brandId, brandId).all();

    // Get schedule info
    const schedule = await env.DB.prepare(
      "SELECT platform, last_checked, next_check, check_interval_hours, enabled FROM social_monitor_schedule WHERE brand_id = ?"
    ).bind(brandId).all();

    // Build per-platform status
    const platformStatus = SUPPORTED_PLATFORMS.map(platform => {
      const handle = handles[platform] ?? null;
      const result = results.results.find((r: Record<string, unknown>) => r.platform === platform);
      const sched = schedule.results.find((s: Record<string, unknown>) => s.platform === platform);

      return {
        platform,
        handle,
        registered: handle !== null,
        last_check: result ?? null,
        schedule: sched ?? null,
      };
    });

    return json({ success: true, data: platformStatus }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
