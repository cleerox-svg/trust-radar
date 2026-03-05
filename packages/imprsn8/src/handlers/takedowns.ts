import { z } from "zod";
import { json } from "../lib/cors";
import type { Env, TakedownRequest, TakedownStatus } from "../types";

const VALID_TRANSITIONS: Record<TakedownStatus, TakedownStatus[]> = {
  draft: ["submitted", "rejected"],
  submitted: ["acknowledged", "rejected"],
  acknowledged: ["in_review", "rejected"],
  in_review: ["resolved", "rejected"],
  resolved: [],
  rejected: [],
};

const CreateSchema = z.object({
  influencer_id: z.string().min(1),
  report_id: z.string().optional(),
  platform: z.string().min(1),
  suspect_handle: z.string().min(1),
  takedown_type: z.enum(["dmca", "impersonation", "trademark", "platform_tos", "court_order"]),
  evidence_json: z.array(z.object({
    type: z.enum(["screenshot", "video", "url_log", "bio_copy", "other"]),
    url: z.string().optional(),
    description: z.string(),
  })).default([]),
});

const UpdateSchema = z.object({
  status: z.enum(["draft", "submitted", "acknowledged", "in_review", "resolved", "rejected"]).optional(),
  case_ref: z.string().max(100).optional(),
  resolution: z.string().max(500).optional(),
  evidence_json: z.array(z.any()).optional(),
});

export async function handleListTakedowns(
  request: Request, env: Env,
  userRole: string, assignedInfluencerId: string | null
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const influencerId = url.searchParams.get("influencer_id");
  const status = url.searchParams.get("status") as TakedownStatus | null;

  let query = `
    SELECT td.*, ip.display_name as influencer_name, u.display_name as submitted_by_name
    FROM takedown_requests td
    JOIN influencer_profiles ip ON ip.id = td.influencer_id
    LEFT JOIN users u ON u.id = td.submitted_by
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (userRole === "influencer" || userRole === "staff") {
    if (!assignedInfluencerId) return json({ success: true, data: [] }, 200, origin);
    query += " AND td.influencer_id = ?"; params.push(assignedInfluencerId);
  } else if (influencerId) {
    query += " AND td.influencer_id = ?"; params.push(influencerId);
  }

  if (status) { query += " AND td.status = ?"; params.push(status); }

  query += " ORDER BY td.created_at DESC LIMIT 100";

  const rows = await env.DB.prepare(query).bind(...params).all<TakedownRequest>();
  const takedowns = rows.results.map((r) => ({
    ...r,
    evidence_json: typeof r.evidence_json === "string" ? JSON.parse(r.evidence_json as unknown as string) : r.evidence_json,
  }));

  return json({ success: true, data: takedowns }, 200, origin);
}

export async function handleCreateTakedown(request: Request, env: Env, userId: string, userRole: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  // Only influencer/staff/soc/admin can create drafts
  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const d = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const initialStatus = (userRole === "influencer" || userRole === "staff") ? "draft" : "draft";

  await env.DB.prepare(
    `INSERT INTO takedown_requests
     (id, influencer_id, report_id, platform, suspect_handle, takedown_type,
      status, evidence_json, submitted_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, d.influencer_id, d.report_id ?? null,
    d.platform, d.suspect_handle, d.takedown_type,
    initialStatus, JSON.stringify(d.evidence_json), userId, now, now
  ).run();

  return json({ success: true, data: { id, ...d, status: initialStatus, created_at: now } }, 201, origin);
}

export async function handleUpdateTakedown(
  request: Request, env: Env, id: string,
  userId: string, userRole: string
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: "Invalid data" }, 400, origin);

  const current = await env.DB.prepare("SELECT * FROM takedown_requests WHERE id = ?").bind(id).first<TakedownRequest>();
  if (!current) return json({ success: false, error: "Not found" }, 404, origin);

  const fields = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];

  // Validate status transition
  if (fields.status && fields.status !== current.status) {
    const allowed = VALID_TRANSITIONS[current.status];
    if (!allowed.includes(fields.status)) {
      return json({ success: false, error: `Cannot transition from ${current.status} → ${fields.status}` }, 400, origin);
    }

    // Only soc/admin can submit (move from draft → submitted)
    if (fields.status === "submitted" && userRole !== "soc" && userRole !== "admin") {
      return json({ success: false, error: "Only SOC analysts can submit takedown requests" }, 403, origin);
    }

    sets.push("status = ?"); vals.push(fields.status);

    if (fields.status === "submitted") { sets.push("submitted_by = ?"); vals.push(userId); sets.push("submitted_at = datetime('now')"); }
    if (fields.status === "acknowledged") { sets.push("acknowledged_at = datetime('now')"); }
    if (fields.status === "resolved" || fields.status === "rejected") { sets.push("resolved_at = datetime('now')"); }
  }

  if (fields.case_ref !== undefined) { sets.push("case_ref = ?"); vals.push(fields.case_ref); }
  if (fields.resolution !== undefined) { sets.push("resolution = ?"); vals.push(fields.resolution); }
  if (fields.evidence_json !== undefined) { sets.push("evidence_json = ?"); vals.push(JSON.stringify(fields.evidence_json)); }

  if (sets.length === 0) return json({ success: false, error: "Nothing to update" }, 400, origin);
  sets.push("updated_at = datetime('now')");
  vals.push(id);

  await env.DB.prepare(`UPDATE takedown_requests SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();

  const updated = await env.DB.prepare("SELECT * FROM takedown_requests WHERE id = ?").bind(id).first<TakedownRequest>();
  return json({ success: true, data: updated }, 200, origin);
}
