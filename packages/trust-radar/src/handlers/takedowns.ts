// Averrow — Takedown Request Handlers (org-scoped + admin queue)

import { json } from "../lib/cors";
import { audit } from "../lib/audit";
import { deliverWebhook } from "../lib/webhooks";
import { computePriorityScore } from "../lib/scoring-utils";
import {
  orgHandler, handler, checkOrgAccess,
  parsePagination, parseFilters, buildWhereClause,
  parseBody, success, error, paginatedResponse, requireFields,
} from "../lib/handler-utils";
import type { Env, CreateTakedownBody, UpdateTakedownBody } from "../types";
import type { AuthContext } from "../middleware/auth";

// ─── Platform Abuse Contacts ─────────────────────────────────

const PLATFORM_ABUSE_CONTACTS: Record<string, { name: string; url: string; method: string }> = {
  twitter: { name: "Twitter/X", url: "https://help.x.com/forms/impersonation", method: "form" },
  instagram: { name: "Instagram", url: "https://help.instagram.com/contact/636276399721841", method: "form" },
  linkedin: { name: "LinkedIn", url: "https://www.linkedin.com/help/linkedin/ask/TS-NFPI", method: "form" },
  tiktok: { name: "TikTok", url: "https://www.tiktok.com/legal/report/feedback", method: "form" },
  github: { name: "GitHub", url: "https://support.github.com/contact/dmca-takedown", method: "form" },
  youtube: { name: "YouTube", url: "https://www.youtube.com/reportabuse", method: "form" },
};

// ─── Constants ───────────────────────────────────────────────

const VALID_STATUSES = ["draft", "requested", "submitted", "pending_response", "taken_down", "failed", "expired", "withdrawn"];
const TENANT_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["requested", "withdrawn"],
  requested: ["withdrawn"],
};
const ADMIN_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["requested", "submitted", "withdrawn"],
  requested: ["submitted", "withdrawn"],
  submitted: ["pending_response", "taken_down", "failed"],
  pending_response: ["taken_down", "failed", "expired"],
};

// ─── POST /api/orgs/:orgId/takedowns ─────────────────────────

export const handleCreateTakedown = orgHandler(async (request, env, orgId, ctx) => {
  const body = await parseBody<CreateTakedownBody>(request);

  const fieldErr = requireFields(
    body as unknown as Record<string, unknown>,
    ["brand_id", "target_type", "target_value", "evidence_summary"],
    ctx.origin,
  );
  if (fieldErr) return fieldErr;

  const { brand_id: brandId, target_type: targetType, target_value: targetValue, evidence_summary: evidenceSummary } = body;

  const validTargetTypes = ["domain", "social_profile", "url", "email"];
  if (!validTargetTypes.includes(targetType)) {
    return error(`Invalid target_type. Must be one of: ${validTargetTypes.join(", ")}`, 400, ctx.origin);
  }

  // Verify brand is assigned to org
  const orgBrand = await env.DB.prepare(
    "SELECT 1 FROM org_brands WHERE org_id = ? AND brand_id = ?"
  ).bind(orgId, brandId).first();
  if (!orgBrand) {
    return error("Brand not assigned to your organization", 404, ctx.origin);
  }

  // Auto-fill evidence from source
  let evidenceDetail = body.evidence_detail || null;
  let severity = "MEDIUM";

  if (body.source_type === "social_profile" && body.source_id) {
    const profile = await env.DB.prepare(
      "SELECT ai_evidence_draft, ai_assessment FROM social_profiles WHERE id = ? AND brand_id = ?"
    ).bind(body.source_id, brandId).first<{ ai_evidence_draft: string | null; ai_assessment: string | null }>();
    if (profile) {
      if (!evidenceDetail && profile.ai_evidence_draft) evidenceDetail = profile.ai_evidence_draft;
      if (!evidenceDetail && profile.ai_assessment) evidenceDetail = profile.ai_assessment;
    }
  }

  if (body.source_type === "alert" && body.source_id) {
    const alert = await env.DB.prepare(
      "SELECT severity, summary, ai_assessment FROM alerts WHERE id = ? AND brand_id = ?"
    ).bind(body.source_id, brandId).first<{ severity: string; summary: string; ai_assessment: string | null }>();
    if (alert) {
      severity = alert.severity || severity;
      if (!evidenceDetail) evidenceDetail = [alert.summary, alert.ai_assessment].filter(Boolean).join("\n\n");
    }
  }

  // Auto-detect provider abuse contact
  let providerName: string | null = null;
  let providerAbuseContact: string | null = null;
  let providerMethod = "email";
  const targetPlatform = body.target_platform || null;

  if (targetType === "social_profile" && targetPlatform) {
    const platformKey = targetPlatform.toLowerCase().replace(/[^a-z]/g, "");
    const contact = PLATFORM_ABUSE_CONTACTS[platformKey];
    if (contact) {
      providerName = contact.name;
      providerAbuseContact = contact.url;
      providerMethod = contact.method;
    }
  } else if (targetType === "domain") {
    const threat = await env.DB.prepare(
      "SELECT hosting_provider, hosting_provider_abuse_email FROM threats WHERE malicious_domain = ? LIMIT 1"
    ).bind(targetValue).first<{ hosting_provider: string | null; hosting_provider_abuse_email: string | null }>();
    if (threat) {
      providerName = threat.hosting_provider;
      providerAbuseContact = threat.hosting_provider_abuse_email;
    }
  }

  const id = crypto.randomUUID();
  const priorityScore = computePriorityScore(severity);

  await env.DB.prepare(`
    INSERT INTO takedown_requests (
      id, org_id, brand_id, target_type, target_value, target_platform, target_url,
      source_type, source_id, evidence_summary, evidence_detail, evidence_urls,
      provider_name, provider_abuse_contact, provider_method,
      status, severity, priority_score, notes, requested_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
  `).bind(
    id, orgId, brandId, targetType, targetValue, targetPlatform,
    body.target_url || null,
    body.source_type || null, body.source_id || null,
    evidenceSummary, evidenceDetail, body.evidence_urls || null,
    providerName, providerAbuseContact, providerMethod,
    severity, priorityScore, body.notes || null, ctx.userId,
  ).run();

  await audit(env, {
    action: "takedown_create",
    userId: ctx.userId,
    resourceType: "takedown_request",
    resourceId: id,
    details: { org_id: orgId, brand_id: brandId, target_type: targetType, target_value: targetValue },
    outcome: "success",
    request,
  });

  return success({ id }, ctx.origin, 201);
}, { minRole: "analyst" });

// ─── GET /api/orgs/:orgId/takedowns ──────────────────────────

export const handleListTakedowns = orgHandler(async (request, env, orgId, ctx) => {
  const { limit, offset } = parsePagination(request);
  const filters = parseFilters(request, ["status", "brand_id", "target_type"]);
  const { clause: filterClause, bindings: filterBindings } = buildWhereClause(filters, {
    status: "tr.status",
    brand_id: "tr.brand_id",
    target_type: "tr.target_type",
  });

  const bindings = [orgId, ...filterBindings];
  const whereClause = `1=1 AND ${filterClause}`;

  const result = await env.DB.prepare(`
    SELECT tr.*, b.name AS brand_name
    FROM takedown_requests tr
    JOIN org_brands ob ON ob.brand_id = tr.brand_id AND ob.org_id = ?
    JOIN brands b ON b.id = tr.brand_id
    WHERE ${whereClause}
    ORDER BY
      CASE tr.status
        WHEN 'draft' THEN 1
        WHEN 'requested' THEN 2
        WHEN 'submitted' THEN 3
        WHEN 'pending_response' THEN 4
        ELSE 5
      END,
      tr.priority_score DESC
    LIMIT ? OFFSET ?
  `).bind(...bindings, limit, offset).all();

  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM takedown_requests tr
    JOIN org_brands ob ON ob.brand_id = tr.brand_id AND ob.org_id = ?
    WHERE ${whereClause}
  `).bind(...bindings).first<{ total: number }>();

  const statusCounts = await env.DB.prepare(`
    SELECT tr.status, COUNT(*) AS count
    FROM takedown_requests tr
    JOIN org_brands ob ON ob.brand_id = tr.brand_id AND ob.org_id = ?
    GROUP BY tr.status
  `).bind(orgId).all();

  return paginatedResponse(result.results || [], countResult?.total ?? 0, ctx.origin, {
    status_counts: statusCounts.results || [],
  });
});

// ─── GET /api/orgs/:orgId/takedowns/:id ──────────────────────

export async function handleGetTakedown(
  request: Request, env: Env, orgId: string, takedownId: string, ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const accessErr = checkOrgAccess(ctx, orgId, origin);
  if (accessErr) return accessErr;

  try {
    const takedown = await env.DB.prepare(`
      SELECT tr.*, b.name AS brand_name
      FROM takedown_requests tr
      JOIN org_brands ob ON ob.brand_id = tr.brand_id AND ob.org_id = ?
      JOIN brands b ON b.id = tr.brand_id
      WHERE tr.id = ?
    `).bind(orgId, takedownId).first();

    if (!takedown) return error("Takedown request not found", 404, origin);

    return success(takedown, origin);
  } catch (err) {
    return error(String(err), 500, origin);
  }
}

// ─── PATCH /api/orgs/:orgId/takedowns/:id ────────────────────

export async function handleUpdateTakedown(
  request: Request, env: Env, orgId: string, takedownId: string, ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const accessErr = checkOrgAccess(ctx, orgId, origin, { minRole: "analyst" });
  if (accessErr) return accessErr;

  try {
    const body = await parseBody<UpdateTakedownBody>(request);

    const takedown = await env.DB.prepare(`
      SELECT tr.id, tr.status
      FROM takedown_requests tr
      JOIN org_brands ob ON ob.brand_id = tr.brand_id AND ob.org_id = ?
      WHERE tr.id = ?
    `).bind(orgId, takedownId).first<{ id: string; status: string }>();

    if (!takedown) return error("Takedown request not found", 404, origin);

    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof body.status === "string") {
      if (!VALID_STATUSES.includes(body.status)) {
        return error(`Invalid status: ${body.status}`, 400, origin);
      }

      const allowed = TENANT_ALLOWED_TRANSITIONS[takedown.status];
      if (!allowed || !allowed.includes(body.status)) {
        return error(`Cannot transition from '${takedown.status}' to '${body.status}'`, 400, origin);
      }

      updates.push("status = ?");
      values.push(body.status);

      if (body.status === "requested") {
        updates.push("requested_at = datetime('now')");
        updates.push("requested_by = ?");
        values.push(ctx.userId);
      }
      if (body.status === "withdrawn") {
        updates.push("resolved_at = datetime('now')");
        updates.push("resolution = 'withdrawn'");
      }
    }

    if (typeof body.notes === "string") { updates.push("notes = ?"); values.push(body.notes); }
    if (typeof body.evidence_summary === "string") { updates.push("evidence_summary = ?"); values.push(body.evidence_summary); }
    if (typeof body.evidence_detail === "string") { updates.push("evidence_detail = ?"); values.push(body.evidence_detail); }

    if (updates.length === 0) return error("No valid fields to update", 400, origin);

    updates.push("updated_at = datetime('now')");
    values.push(takedownId);

    await env.DB.prepare(
      `UPDATE takedown_requests SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...values).run();

    await audit(env, {
      action: "takedown_update",
      userId: ctx.userId,
      resourceType: "takedown_request",
      resourceId: takedownId,
      details: { org_id: orgId, previous_status: takedown.status, new_status: body.status ?? takedown.status },
      outcome: "success",
      request,
    });

    if (typeof body.status === "string" && body.status !== takedown.status) {
      deliverWebhook(env, Number(orgId), "takedown.status_changed", {
        takedown_id: takedownId,
        previous_status: takedown.status,
        new_status: body.status,
        updated_by: ctx.userId,
      }).catch(() => {});
    }

    return json({ success: true, message: "Takedown request updated" }, 200, origin);
  } catch (err) {
    return error(String(err), 500, origin);
  }
}

// ─── GET /api/admin/takedowns (superadmin SOC queue) ─────────

export const handleAdminListTakedowns = handler(async (request, env, ctx) => {
  const { limit, offset } = parsePagination(request);
  const filters = parseFilters(request, ["status", "org_id", "severity"]);
  const { clause: filterClause, bindings: filterBindings } = buildWhereClause(filters, {
    status: "tr.status",
    org_id: "tr.org_id",
    severity: "tr.severity",
  });

  const result = await env.DB.prepare(`
    SELECT tr.*, b.name AS brand_name, o.name AS org_name
    FROM takedown_requests tr
    JOIN brands b ON b.id = tr.brand_id
    LEFT JOIN organizations o ON o.id = tr.org_id
    WHERE ${filterClause}
    ORDER BY
      CASE tr.status
        WHEN 'requested' THEN 1
        WHEN 'submitted' THEN 2
        WHEN 'pending_response' THEN 3
        WHEN 'draft' THEN 4
        ELSE 5
      END,
      tr.priority_score DESC,
      tr.created_at ASC
    LIMIT ? OFFSET ?
  `).bind(...filterBindings, limit, offset).all();

  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM takedown_requests tr
    WHERE ${filterClause}
  `).bind(...filterBindings).first<{ total: number }>();

  const statusCounts = await env.DB.prepare(`
    SELECT status, COUNT(*) AS count FROM takedown_requests GROUP BY status
  `).all();

  return paginatedResponse(result.results || [], countResult?.total ?? 0, ctx.origin, {
    status_counts: statusCounts.results || [],
  });
});

// ─── PATCH /api/admin/takedowns/:id (superadmin) ─────────────

export async function handleAdminUpdateTakedown(
  request: Request, env: Env, takedownId: string, ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  try {
    const body = await parseBody<UpdateTakedownBody>(request);

    const takedown = await env.DB.prepare(
      "SELECT id, status FROM takedown_requests WHERE id = ?"
    ).bind(takedownId).first<{ id: string; status: string }>();

    if (!takedown) return error("Takedown request not found", 404, origin);

    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof body.status === "string") {
      if (!VALID_STATUSES.includes(body.status)) {
        return error(`Invalid status: ${body.status}`, 400, origin);
      }

      const allowed = ADMIN_ALLOWED_TRANSITIONS[takedown.status];
      if (allowed && !allowed.includes(body.status)) {
        return error(`Cannot transition from '${takedown.status}' to '${body.status}'`, 400, origin);
      }

      updates.push("status = ?");
      values.push(body.status);

      if (body.status === "submitted") {
        updates.push("submitted_at = datetime('now')");
        updates.push("submitted_by = ?");
        values.push(ctx.userId);
      }
      if (body.status === "taken_down") {
        updates.push("resolved_at = datetime('now')");
        updates.push("resolution = 'taken_down'");
      }
      if (body.status === "failed") {
        updates.push("resolved_at = datetime('now')");
        updates.push("resolution = 'refused'");
      }
      if (body.status === "expired") {
        updates.push("resolved_at = datetime('now')");
        updates.push("resolution = 'expired'");
      }
      if (body.status === "pending_response") {
        updates.push("response_received_at = datetime('now')");
      }
    }

    if (typeof body.response_notes === "string") { updates.push("response_notes = ?"); values.push(body.response_notes); }
    if (typeof body.notes === "string") { updates.push("notes = ?"); values.push(body.notes); }

    if (typeof body.severity === "string") {
      updates.push("severity = ?");
      values.push(body.severity);
      updates.push("priority_score = ?");
      values.push(computePriorityScore(body.severity));
    }

    if (updates.length === 0) return error("No valid fields to update", 400, origin);

    updates.push("updated_at = datetime('now')");
    values.push(takedownId);

    await env.DB.prepare(
      `UPDATE takedown_requests SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...values).run();

    await audit(env, {
      action: "admin_takedown_update",
      userId: ctx.userId,
      resourceType: "takedown_request",
      resourceId: takedownId,
      details: { previous_status: takedown.status, new_status: body.status ?? takedown.status },
      outcome: "success",
      request,
    });

    if (typeof body.status === "string" && body.status !== takedown.status) {
      const tdOrg = await env.DB.prepare(
        "SELECT org_id FROM takedown_requests WHERE id = ?",
      ).bind(takedownId).first<{ org_id: number | null }>();
      if (tdOrg?.org_id) {
        deliverWebhook(env, tdOrg.org_id, "takedown.status_changed", {
          takedown_id: takedownId,
          previous_status: takedown.status,
          new_status: body.status,
          updated_by: ctx.userId,
        }).catch(() => {});
      }
    }

    return json({ success: true, message: "Takedown request updated" }, 200, origin);
  } catch (err) {
    return error(String(err), 500, origin);
  }
}
