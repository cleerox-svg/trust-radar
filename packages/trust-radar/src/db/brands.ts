/**
 * Data access layer — brands table.
 *
 * Typed query functions for the most-queried entity in the platform.
 * The brands table is referenced in 82+ inline queries across handlers.
 * Use these functions instead of writing raw SQL in handlers/agents.
 */

import type { Brand, BrandListOptions, Env } from "../types";

// Re-export for consumers that import from db/brands
export type { Brand, BrandListOptions };

// ─── Single-row lookups ───────────────────────────────────────────

export async function getBrandById(env: Env, id: string): Promise<Brand | null> {
  return env.DB.prepare("SELECT * FROM brands WHERE id = ?")
    .bind(id)
    .first<Brand>();
}

export async function getBrandByDomain(env: Env, domain: string): Promise<Brand | null> {
  return env.DB.prepare("SELECT * FROM brands WHERE canonical_domain = ?")
    .bind(domain)
    .first<Brand>();
}

// ─── List queries ─────────────────────────────────────────────────

export async function listBrands(
  env: Env,
  options: BrandListOptions = {},
): Promise<{ results: Brand[]; total: number }> {
  const { limit = 50, offset = 0, orderBy = 'threat_count', direction = 'DESC', sector, monitoringStatus } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (sector) { conditions.push("sector = ?"); params.push(sector); }
  if (monitoringStatus) { conditions.push("monitoring_status = ?"); params.push(monitoringStatus); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, count] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM brands ${where} ORDER BY ${orderBy} ${direction} LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all<Brand>(),
    env.DB.prepare(
      `SELECT COUNT(*) as c FROM brands ${where}`
    ).bind(...params).first<{ c: number }>(),
  ]);

  return { results: rows.results ?? [], total: count?.c ?? 0 };
}

// ─── Aggregates ───────────────────────────────────────────────────

export async function getBrandThreatCount(
  env: Env,
  brandId: string,
  days: number = 30,
): Promise<number> {
  const result = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM threats WHERE target_brand_id = ? AND created_at > datetime('now', ? || ' days')"
  ).bind(brandId, -days).first<{ c: number }>();
  return result?.c ?? 0;
}

// ─── Mutations ────────────────────────────────────────────────────

/**
 * Update a single column on a brand row.
 * Only use with trusted, internal column names — never pass user input as `field`.
 */
export async function updateBrandField(
  env: Env,
  brandId: string,
  field: string,
  value: unknown,
): Promise<void> {
  await env.DB.prepare(`UPDATE brands SET ${field} = ? WHERE id = ?`)
    .bind(value, brandId)
    .run();
}

export async function incrementBrandThreatCount(env: Env, brandId: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE brands SET threat_count = threat_count + 1, last_threat_seen = datetime('now') WHERE id = ?"
  ).bind(brandId).run();
}
