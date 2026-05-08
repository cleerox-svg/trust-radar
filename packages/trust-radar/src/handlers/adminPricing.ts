// Super_admin pricing handlers — read-side only in this PR.
//
// Mutation endpoints (PATCH plans / module_prices, POST overrides)
// land in a follow-up sprint once the read surface and Customers
// page rename are stable.
//
// v3 Phase D Stripe sprint 1.

import { json } from "../lib/cors";
import type { Env } from "../types";
import type { AuthContext } from "../middleware/auth";
import {
  listPricingPlans,
  listModulePrices,
  getOrgPricingSummary,
} from "../lib/pricing";

function requireSuperAdmin(ctx: AuthContext): string | null {
  if (ctx.role !== "super_admin") return "Forbidden: super_admin role required";
  return null;
}

// ─── GET /api/admin/pricing/plans ───────────────────────────────

export async function handleListPricingPlans(
  request: Request,
  env:     Env,
  ctx:     AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const err = requireSuperAdmin(ctx);
  if (err) return json({ success: false, error: err }, 403, origin);

  const plans = await listPricingPlans(env);
  return json({ success: true, data: { plans } }, 200, origin);
}

// ─── GET /api/admin/pricing/modules ─────────────────────────────

export async function handleListModulePrices(
  request: Request,
  env:     Env,
  ctx:     AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const err = requireSuperAdmin(ctx);
  if (err) return json({ success: false, error: err }, 403, origin);

  const modules = await listModulePrices(env);
  return json({ success: true, data: { modules } }, 200, origin);
}

// ─── GET /api/admin/customers/:orgId/pricing ────────────────────

export async function handleGetCustomerPricing(
  request: Request,
  env:     Env,
  orgId:   string,
  ctx:     AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const err = requireSuperAdmin(ctx);
  if (err) return json({ success: false, error: err }, 403, origin);

  const orgIdNum = Number(orgId);
  if (!Number.isFinite(orgIdNum)) {
    return json({ success: false, error: "Invalid organization id" }, 400, origin);
  }

  const summary = await getOrgPricingSummary(env, orgIdNum);
  return json({ success: true, data: summary }, 200, origin);
}
