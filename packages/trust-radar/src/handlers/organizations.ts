// Averrow — Organization CRUD, Member Management, Brand Assignment

import { json } from "../lib/cors";
import { audit } from "../lib/audit";
import { generateInviteToken, hashToken } from "../lib/hash";
import { sendTestWebhook } from "../lib/webhooks";
import type { Env } from "../types";
import type { AuthContext } from "../middleware/auth";

// ─── Helpers ─────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) code += chars[b % chars.length];
  return code;
}

const ORG_ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1, analyst: 2, admin: 3, owner: 4,
};

const VALID_ORG_ROLES = ["viewer", "analyst", "admin", "owner"];
const INVITE_EXPIRY_HOURS = 72;

// ─── Admin: Create Organization (super_admin) ────────────────

export async function handleCreateOrg(
  request: Request,
  env: Env,
  adminUserId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null) as {
    name?: string;
    plan?: string;
    max_brands?: number;
    max_members?: number;
  } | null;

  if (!body?.name) {
    return json({ success: false, error: "Organization name is required" }, 400, origin);
  }

  // Generate unique slug
  let slug = generateSlug(body.name);
  const existing = await env.DB.prepare("SELECT id FROM organizations WHERE slug = ?")
    .bind(slug).first();
  if (existing) {
    slug += "-" + Date.now().toString(36).slice(-4);
  }

  const inviteCode = generateInviteCode();

  await env.DB.prepare(`
    INSERT INTO organizations (name, slug, plan, invite_code, max_brands, max_members)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    body.name,
    slug,
    body.plan ?? "starter",
    inviteCode,
    body.max_brands ?? 5,
    body.max_members ?? 10,
  ).run();

  const org = await env.DB.prepare("SELECT * FROM organizations WHERE slug = ?")
    .bind(slug).first();

  await audit(env, {
    action: "org_created",
    userId: adminUserId,
    resourceType: "organization",
    resourceId: String(org?.id),
    details: { name: body.name, slug, plan: body.plan ?? "starter" },
    request,
  });

  return json({ success: true, data: org }, 201, origin);
}

// ─── Admin: List Organizations (super_admin) ─────────────────

export async function handleListOrgs(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const { results } = await env.DB.prepare(`
    SELECT o.*,
      (SELECT COUNT(*) FROM org_members om WHERE om.org_id = o.id AND om.status = 'active') AS member_count,
      (SELECT COUNT(*) FROM org_brands ob WHERE ob.org_id = o.id) AS brand_count
    FROM organizations o
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  return json({ success: true, data: results }, 200, origin);
}

// ─── Admin: Get Organization Detail (super_admin) ────────────

export async function handleGetOrg(
  request: Request,
  env: Env,
  orgId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  const org = await env.DB.prepare("SELECT * FROM organizations WHERE id = ?")
    .bind(orgId).first();
  if (!org) return json({ success: false, error: "Organization not found" }, 404, origin);

  const { results: members } = await env.DB.prepare(`
    SELECT om.*, u.email, u.name AS user_name, u.role AS platform_role
    FROM org_members om
    JOIN users u ON u.id = om.user_id
    WHERE om.org_id = ? AND om.status = 'active'
    ORDER BY om.created_at
  `).bind(orgId).all();

  const { results: brands } = await env.DB.prepare(`
    SELECT ob.*, b.name AS brand_name, b.canonical_domain
    FROM org_brands ob
    JOIN brands b ON b.id = ob.brand_id
    WHERE ob.org_id = ?
    ORDER BY ob.created_at
  `).bind(orgId).all();

  return json({ success: true, data: { ...org, members, brands } }, 200, origin);
}

// ─── Admin: Update Organization (super_admin) ────────────────

export async function handleUpdateOrg(
  request: Request,
  env: Env,
  orgId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null) as {
    plan?: string;
    max_brands?: number;
    max_members?: number;
    status?: string;
    webhook_url?: string;
    name?: string;
  } | null;

  if (!body) return json({ success: false, error: "No update data provided" }, 400, origin);

  const sets: string[] = [];
  const vals: unknown[] = [];

  if (body.name !== undefined) { sets.push("name = ?"); vals.push(body.name); }
  if (body.plan !== undefined) { sets.push("plan = ?"); vals.push(body.plan); }
  if (body.max_brands !== undefined) { sets.push("max_brands = ?"); vals.push(body.max_brands); }
  if (body.max_members !== undefined) { sets.push("max_members = ?"); vals.push(body.max_members); }
  if (body.status !== undefined) { sets.push("status = ?"); vals.push(body.status); }
  if (body.webhook_url !== undefined) { sets.push("webhook_url = ?"); vals.push(body.webhook_url); }

  if (sets.length === 0) return json({ success: false, error: "No valid fields to update" }, 400, origin);

  sets.push("updated_at = datetime('now')");
  vals.push(orgId);

  await env.DB.prepare(`UPDATE organizations SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...vals).run();

  const org = await env.DB.prepare("SELECT * FROM organizations WHERE id = ?")
    .bind(orgId).first();

  return json({ success: true, data: org }, 200, origin);
}

// ─── Org Member: Get Own Org ──────────────────────────────────

export async function handleGetOwnOrg(
  request: Request,
  env: Env,
  orgId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  // Superadmins can access any org; members must match
  if (ctx.role !== "super_admin" && ctx.orgId !== orgId) {
    return json({ success: false, error: "Not a member of this organization" }, 403, origin);
  }

  const org = await env.DB.prepare(
    "SELECT id, name, slug, plan, status, max_brands, max_members, created_at FROM organizations WHERE id = ?",
  ).bind(orgId).first();

  if (!org) return json({ success: false, error: "Organization not found" }, 404, origin);

  return json({ success: true, data: org }, 200, origin);
}

// ─── Org Admin: List Members ──────────────────────────────────

export async function handleListOrgMembers(
  request: Request,
  env: Env,
  orgId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  // Check access: super_admin or org admin+
  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  const { results } = await env.DB.prepare(`
    SELECT om.id, om.user_id, om.role, om.status, om.invited_at, om.accepted_at, om.last_active_at,
           u.email, u.name AS user_name
    FROM org_members om
    JOIN users u ON u.id = om.user_id
    WHERE om.org_id = ? AND om.status = 'active'
    ORDER BY om.created_at
  `).bind(orgId).all();

  return json({ success: true, data: results }, 200, origin);
}

// ─── Org Admin: Invite User ──────────────────────────────────

export async function handleOrgInvite(
  request: Request,
  env: Env,
  orgId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  // Check access: super_admin or org admin+
  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  const body = await request.json().catch(() => null) as {
    email?: string;
    org_role?: string;
  } | null;

  if (!body?.email) return json({ success: false, error: "Email is required" }, 400, origin);

  const orgRole = body.org_role ?? "viewer";
  if (!VALID_ORG_ROLES.includes(orgRole)) {
    return json({ success: false, error: `Invalid org role. Must be one of: ${VALID_ORG_ROLES.join(", ")}` }, 400, origin);
  }

  // Check member limit
  const org = await env.DB.prepare("SELECT max_members FROM organizations WHERE id = ?")
    .bind(orgId).first<{ max_members: number }>();
  if (org) {
    const memberCount = await env.DB.prepare(
      "SELECT COUNT(*) AS cnt FROM org_members WHERE org_id = ? AND status = 'active'",
    ).bind(orgId).first<{ cnt: number }>();
    if (memberCount && memberCount.cnt >= org.max_members) {
      return json({ success: false, error: "Organization has reached its member limit" }, 400, origin);
    }
  }

  // Generate invite token
  const rawToken = generateInviteToken();
  const tokenHash = await hashToken(rawToken);
  const id = crypto.randomUUID();

  // The invitation has platform role "client" and org context
  await env.DB.prepare(
    `INSERT INTO invitations (id, email, role, token_hash, invited_by, expires_at, org_id, org_role)
     VALUES (?, ?, 'client', ?, ?, datetime('now', '+${INVITE_EXPIRY_HOURS} hours'), ?, ?)`,
  ).bind(id, body.email.toLowerCase(), tokenHash, ctx.userId, orgId, orgRole).run();

  await audit(env, {
    action: "org_invite_created",
    userId: ctx.userId,
    resourceType: "invitation",
    resourceId: id,
    details: { email: body.email, org_id: orgId, org_role: orgRole },
    request,
  });

  const inviteUrl = `${new URL(request.url).origin}/invite?token=${rawToken}`;

  return json({
    success: true,
    data: {
      id,
      email: body.email,
      org_role: orgRole,
      invite_url: inviteUrl,
      expires_in_hours: INVITE_EXPIRY_HOURS,
    },
  }, 201, origin);
}

// ─── Org Admin: Remove Member ─────────────────────────────────

export async function handleRemoveOrgMember(
  request: Request,
  env: Env,
  orgId: string,
  userId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  // Prevent removing yourself
  if (userId === ctx.userId) {
    return json({ success: false, error: "Cannot remove yourself from the organization" }, 400, origin);
  }

  const result = await env.DB.prepare(
    "UPDATE org_members SET status = 'removed', deprovisioned_at = datetime('now') WHERE org_id = ? AND user_id = ? AND status = 'active'",
  ).bind(orgId, userId).run();

  if (!result.meta.changes) {
    return json({ success: false, error: "Member not found or already removed" }, 404, origin);
  }

  await audit(env, {
    action: "org_member_removed",
    userId: ctx.userId,
    resourceType: "org_member",
    resourceId: userId,
    details: { org_id: orgId },
    request,
  });

  return json({ success: true, data: { message: "Member removed" } }, 200, origin);
}

// ─── Org Admin: Update Member Role ────────────────────────────

export async function handleUpdateOrgMember(
  request: Request,
  env: Env,
  orgId: string,
  userId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  const body = await request.json().catch(() => null) as { role?: string } | null;
  if (!body?.role || !VALID_ORG_ROLES.includes(body.role)) {
    return json({ success: false, error: `Invalid role. Must be one of: ${VALID_ORG_ROLES.join(", ")}` }, 400, origin);
  }

  const result = await env.DB.prepare(
    "UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ? AND status = 'active'",
  ).bind(body.role, orgId, userId).run();

  if (!result.meta.changes) {
    return json({ success: false, error: "Member not found" }, 404, origin);
  }

  await audit(env, {
    action: "org_member_role_updated",
    userId: ctx.userId,
    resourceType: "org_member",
    resourceId: userId,
    details: { org_id: orgId, new_role: body.role },
    request,
  });

  return json({ success: true, data: { message: "Member role updated" } }, 200, origin);
}

// ─── Org Admin: Assign Brand ──────────────────────────────────

export async function handleAssignOrgBrand(
  request: Request,
  env: Env,
  orgId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  const body = await request.json().catch(() => null) as {
    brand_id?: string;
    is_primary?: boolean;
  } | null;

  if (!body?.brand_id) return json({ success: false, error: "brand_id is required" }, 400, origin);

  // Check max_brands limit
  const org = await env.DB.prepare("SELECT max_brands FROM organizations WHERE id = ?")
    .bind(orgId).first<{ max_brands: number }>();
  if (org) {
    const brandCount = await env.DB.prepare(
      "SELECT COUNT(*) AS cnt FROM org_brands WHERE org_id = ?",
    ).bind(orgId).first<{ cnt: number }>();
    if (brandCount && brandCount.cnt >= org.max_brands) {
      return json({ success: false, error: "Organization has reached its brand limit" }, 400, origin);
    }
  }

  try {
    await env.DB.prepare(
      "INSERT INTO org_brands (org_id, brand_id, is_primary) VALUES (?, ?, ?)",
    ).bind(orgId, body.brand_id, body.is_primary ? 1 : 0).run();
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return json({ success: false, error: "Brand already assigned to this organization" }, 409, origin);
    }
    throw err;
  }

  await audit(env, {
    action: "org_brand_assigned",
    userId: ctx.userId,
    resourceType: "org_brand",
    resourceId: body.brand_id,
    details: { org_id: orgId, is_primary: body.is_primary },
    request,
  });

  return json({ success: true, data: { message: "Brand assigned" } }, 201, origin);
}

// ─── Org Admin: Remove Brand ──────────────────────────────────

export async function handleRemoveOrgBrand(
  request: Request,
  env: Env,
  orgId: string,
  brandId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  const result = await env.DB.prepare(
    "DELETE FROM org_brands WHERE org_id = ? AND brand_id = ?",
  ).bind(orgId, brandId).run();

  if (!result.meta.changes) {
    return json({ success: false, error: "Brand not found in organization" }, 404, origin);
  }

  await audit(env, {
    action: "org_brand_removed",
    userId: ctx.userId,
    resourceType: "org_brand",
    resourceId: brandId,
    details: { org_id: orgId },
    request,
  });

  return json({ success: true, data: { message: "Brand removed" } }, 200, origin);
}

// ─── Org Member: List Brands ──────────────────────────────────

export async function handleListOrgBrands(
  request: Request,
  env: Env,
  orgId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin" && ctx.orgId !== orgId) {
    return json({ success: false, error: "Not a member of this organization" }, 403, origin);
  }

  const { results } = await env.DB.prepare(`
    SELECT ob.id, ob.brand_id, ob.is_primary, ob.created_at,
           b.name AS brand_name, b.canonical_domain, b.sector, b.threat_count
    FROM org_brands ob
    JOIN brands b ON b.id = ob.brand_id
    WHERE ob.org_id = ?
    ORDER BY ob.created_at
  `).bind(orgId).all();

  return json({ success: true, data: results }, 200, origin);
}

// ─── Org Admin: List Pending Invites ─────────────────────────

export async function handleListOrgInvites(
  request: Request,
  env: Env,
  orgId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  const { results } = await env.DB.prepare(`
    SELECT id, email, org_role, created_at, expires_at
    FROM invitations
    WHERE org_id = ? AND status = 'pending'
    ORDER BY created_at DESC
  `).bind(orgId).all();

  return json({ success: true, data: results }, 200, origin);
}

// ─── Org Admin: Revoke Pending Invite ────────────────────────

export async function handleRevokeOrgInvite(
  request: Request,
  env: Env,
  orgId: string,
  inviteId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  // Verify invitation belongs to this org
  const invite = await env.DB.prepare(
    "SELECT id FROM invitations WHERE id = ? AND org_id = ? AND status = 'pending'",
  ).bind(inviteId, orgId).first();

  if (!invite) {
    return json({ success: false, error: "Invitation not found or already used" }, 404, origin);
  }

  await env.DB.prepare(
    "UPDATE invitations SET status = 'revoked' WHERE id = ?",
  ).bind(inviteId).run();

  await audit(env, {
    action: "org_invite_revoked",
    userId: ctx.userId,
    resourceType: "invitation",
    resourceId: inviteId,
    details: { org_id: orgId },
    request,
  });

  return json({ success: true, data: { message: "Invitation revoked" } }, 200, origin);
}

// ─── Org Admin: Update Webhook Config ────────────────────────

export async function handleUpdateWebhook(
  request: Request,
  env: Env,
  orgId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  const body = await request.json().catch(() => null) as {
    webhook_url?: string;
    webhook_events?: string[];
  } | null;

  if (!body) return json({ success: false, error: "No update data provided" }, 400, origin);

  const sets: string[] = [];
  const vals: unknown[] = [];

  if (body.webhook_url !== undefined) {
    sets.push("webhook_url = ?");
    vals.push(body.webhook_url || null);
  }

  if (body.webhook_events !== undefined) {
    sets.push("webhook_events = ?");
    vals.push(JSON.stringify(body.webhook_events));
  }

  if (sets.length === 0) return json({ success: false, error: "No valid fields to update" }, 400, origin);

  // Auto-generate secret if setting webhook_url for the first time
  let newSecret: string | null = null;
  if (body.webhook_url) {
    const existing = await env.DB.prepare(
      "SELECT webhook_secret FROM organizations WHERE id = ?",
    ).bind(orgId).first<{ webhook_secret: string | null }>();

    if (!existing?.webhook_secret) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      newSecret = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
      sets.push("webhook_secret = ?");
      vals.push(newSecret);
    }
  }

  sets.push("updated_at = datetime('now')");
  vals.push(orgId);

  await env.DB.prepare(`UPDATE organizations SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...vals).run();

  await audit(env, {
    action: "webhook_config_updated",
    userId: ctx.userId,
    resourceType: "organization",
    resourceId: orgId,
    details: { webhook_url: body.webhook_url, webhook_events: body.webhook_events },
    request,
  });

  const responseData: Record<string, unknown> = { message: "Webhook configuration updated" };
  if (newSecret) {
    responseData.webhook_secret = newSecret;
  }

  return json({ success: true, data: responseData }, 200, origin);
}

// ─── Org Owner: Regenerate Webhook Secret ────────────────────

export async function handleRegenerateSecret(
  request: Request,
  env: Env,
  orgId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    if (ctx.orgRole !== "owner") return json({ success: false, error: "Only the org owner can regenerate the webhook secret" }, 403, origin);
  }

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const newSecret = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");

  await env.DB.prepare(
    "UPDATE organizations SET webhook_secret = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(newSecret, orgId).run();

  await audit(env, {
    action: "webhook_secret_regenerated",
    userId: ctx.userId,
    resourceType: "organization",
    resourceId: orgId,
    details: {},
    request,
  });

  return json({ success: true, data: { webhook_secret: newSecret } }, 200, origin);
}

// ─── Org Admin: Test Webhook ─────────────────────────────────

export async function handleTestWebhook(
  request: Request,
  env: Env,
  orgId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  const result = await sendTestWebhook(env, Number(orgId));

  return json({
    success: result.success,
    data: {
      status: result.status,
      error: result.error,
    },
  }, result.success ? 200 : 502, origin);
}

// ─── Org Admin: Get Webhook Config ───────────────────────────

export async function handleGetWebhookConfig(
  request: Request,
  env: Env,
  orgId: string,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (ctx.role !== "super_admin") {
    if (ctx.orgId !== orgId) return json({ success: false, error: "Not a member of this organization" }, 403, origin);
    const level = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
    if (level < (ORG_ROLE_HIERARCHY.admin ?? 3)) return json({ success: false, error: "Requires org role: admin or higher" }, 403, origin);
  }

  const org = await env.DB.prepare(
    "SELECT webhook_url, webhook_secret, webhook_events, webhook_failures_24h, webhook_last_success, webhook_last_failure FROM organizations WHERE id = ?",
  ).bind(orgId).first<{
    webhook_url: string | null;
    webhook_secret: string | null;
    webhook_events: string | null;
    webhook_failures_24h: number;
    webhook_last_success: string | null;
    webhook_last_failure: string | null;
  }>();

  if (!org) return json({ success: false, error: "Organization not found" }, 404, origin);

  let events: string[] = [];
  if (org.webhook_events) {
    try { events = JSON.parse(org.webhook_events); } catch { /* default empty */ }
  }

  return json({
    success: true,
    data: {
      webhook_url: org.webhook_url,
      has_secret: !!org.webhook_secret,
      webhook_events: events,
      webhook_failures_24h: org.webhook_failures_24h ?? 0,
      webhook_last_success: org.webhook_last_success,
      webhook_last_failure: org.webhook_last_failure,
    },
  }, 200, origin);
}
