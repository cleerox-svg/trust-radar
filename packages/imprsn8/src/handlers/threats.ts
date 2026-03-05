import { z } from "zod";
import { json } from "../lib/cors";
import type { Env, ImpersonationReport, ThreatSeverity, ThreatStatus } from "../types";

const CreateThreatSchema = z.object({
  influencer_id: z.string().min(1),
  platform: z.string().min(1),
  suspect_handle: z.string().min(1),
  suspect_url: z.string().url().optional(),
  suspect_followers: z.number().int().optional(),
  threat_type: z.enum(["full_clone", "handle_squat", "bio_copy", "avatar_copy", "scam_campaign", "deepfake_media", "unofficial_clips", "voice_clone", "other"]),
  severity: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  similarity_score: z.number().int().min(0).max(100).optional(),
  similarity_breakdown: z.object({
    bio_copy: z.number().min(0).max(100).default(0),
    avatar_match: z.number().min(0).max(100).default(0),
    posting_cadence: z.number().min(0).max(100).default(0),
    handle_distance: z.number().min(0).max(100).default(0),
  }).default({}),
  ai_analysis: z.string().optional(),
});

const UpdateThreatSchema = z.object({
  status: z.enum(["new", "investigating", "confirmed", "actioning", "resolved", "dismissed"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  soc_note: z.string().max(2000).optional(),
  ai_analysis: z.string().optional(),
});

export async function handleListThreats(
  request: Request, env: Env,
  userRole: string, assignedInfluencerId: string | null
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const influencerId = url.searchParams.get("influencer_id");
  const severity = url.searchParams.get("severity") as ThreatSeverity | null;
  const status = url.searchParams.get("status") as ThreatStatus | null;
  const platform = url.searchParams.get("platform");
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  let query = `
    SELECT ir.*, ip.display_name as influencer_name, ip.handle as influencer_handle
    FROM impersonation_reports ir
    JOIN influencer_profiles ip ON ip.id = ir.influencer_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (userRole === "influencer" || userRole === "staff") {
    if (!assignedInfluencerId) return json({ success: true, data: [], total: 0 }, 200, origin);
    query += " AND ir.influencer_id = ?"; params.push(assignedInfluencerId);
  } else if (influencerId) {
    query += " AND ir.influencer_id = ?"; params.push(influencerId);
  }

  if (severity) { query += " AND ir.severity = ?"; params.push(severity); }
  if (status) { query += " AND ir.status = ?"; params.push(status); }
  if (platform) { query += " AND ir.platform = ?"; params.push(platform); }

  // Count
  const countQuery = query.replace("SELECT ir.*, ip.display_name as influencer_name, ip.handle as influencer_handle", "SELECT COUNT(*) as cnt");
  const countRow = await env.DB.prepare(countQuery).bind(...params).first<{ cnt: number }>();

  query += " ORDER BY CASE ir.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, ir.detected_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = await env.DB.prepare(query).bind(...params).all<ImpersonationReport>();

  const threats = rows.results.map((r) => ({
    ...r,
    similarity_breakdown: typeof r.similarity_breakdown === "string"
      ? JSON.parse(r.similarity_breakdown as unknown as string)
      : r.similarity_breakdown,
  }));

  return json({ success: true, data: threats, total: countRow?.cnt ?? 0 }, 200, origin);
}

export async function handleGetThreat(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const row = await env.DB.prepare(
    `SELECT ir.*, ip.display_name as influencer_name
     FROM impersonation_reports ir
     JOIN influencer_profiles ip ON ip.id = ir.influencer_id
     WHERE ir.id = ?`
  ).bind(id).first<ImpersonationReport>();

  if (!row) return json({ success: false, error: "Not found" }, 404, origin);
  const threat = { ...row, similarity_breakdown: typeof row.similarity_breakdown === "string" ? JSON.parse(row.similarity_breakdown as unknown as string) : row.similarity_breakdown };
  return json({ success: true, data: threat }, 200, origin);
}

export async function handleCreateThreat(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = CreateThreatSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const d = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO impersonation_reports
     (id, influencer_id, platform, suspect_handle, suspect_url, suspect_followers,
      threat_type, severity, similarity_score, similarity_breakdown, ai_analysis,
      detected_by, detected_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`
  ).bind(
    id, d.influencer_id, d.platform, d.suspect_handle, d.suspect_url ?? null,
    d.suspect_followers ?? null, d.threat_type, d.severity,
    d.similarity_score ?? null, JSON.stringify(d.similarity_breakdown),
    d.ai_analysis ?? null, now, now
  ).run();

  return json({ success: true, data: { id, ...d, status: "new", detected_at: now } }, 201, origin);
}

export async function handleUpdateThreat(request: Request, env: Env, id: string, userRole: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = UpdateThreatSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: "Invalid data" }, 400, origin);

  const fields = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (fields.status !== undefined) { sets.push("status = ?"); vals.push(fields.status); }
  if (fields.severity !== undefined) { sets.push("severity = ?"); vals.push(fields.severity); }
  if (fields.ai_analysis !== undefined) { sets.push("ai_analysis = ?"); vals.push(fields.ai_analysis); }

  // SOC note only visible to soc/admin
  if (fields.soc_note !== undefined && (userRole === "soc" || userRole === "admin")) {
    sets.push("soc_note = ?");
    vals.push(fields.soc_note);
  }

  if (sets.length === 0) return json({ success: false, error: "Nothing to update" }, 400, origin);
  sets.push("updated_at = datetime('now')");
  vals.push(id);

  await env.DB.prepare(`UPDATE impersonation_reports SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();

  const updated = await env.DB.prepare("SELECT * FROM impersonation_reports WHERE id = ?").bind(id).first<ImpersonationReport>();
  return json({ success: true, data: updated }, 200, origin);
}
