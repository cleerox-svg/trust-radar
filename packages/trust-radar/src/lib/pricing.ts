// Pricing config — read-side library.
//
// Source of truth for what each org's effective monthly price IS.
// Stripe handles the actual billing event (charge / invoice / retry);
// this file computes the price our system says they owe.
//
// Schema:
//   pricing_plans          tier definitions (Professional / Business /
//                          Enterprise) — monthly base price, included
//                          modules, optional Stripe price_id.
//   module_prices          per-module à-la-carte prices. 7 customer-
//                          facing modules.
//   org_pricing_overrides  super_admin records a custom price per org
//                          (discount, enterprise deal). Append-only.
//
// effective_until IS NULL = open-ended; > now = still active. The
// active-override resolver picks the most recently created active
// row when multiple overrides apply.
//
// v3 Phase D Stripe sprint 1.

import type { Env } from "../types";
import type { ModuleKey } from "./entitlements";

export interface PricingPlan {
  id:                  string;
  display_name:        string;
  monthly_price_cents: number;
  trial_days:          number;
  included_modules:    ModuleKey[];
  stripe_price_id:     string | null;
  description:         string | null;
  is_active:           boolean;
  sort_order:          number;
}

export interface ModulePrice {
  module_key:          ModuleKey;
  display_name:        string;
  monthly_price_cents: number;
  stripe_price_id:     string | null;
  is_active:           boolean;
}

export type OverrideType = "tier_price" | "module_price" | "discount_percent";

export interface OrgPricingOverride {
  id:                 string;
  org_id:             number;
  override_type:      OverrideType;
  plan_id:            string | null;
  module_key:         ModuleKey | null;
  custom_price_cents: number | null;
  discount_pct:       number | null;
  reason:             string;
  set_by_user_id:     string | null;
  effective_from:     string;
  effective_until:    string | null;
  created_at:         string;
}

export interface OrgPricingSummary {
  org_id:                       number;
  plan:                         PricingPlan | null;
  per_module_subscriptions:     Array<{ module_key: ModuleKey; price_cents: number }>;
  active_overrides:             OrgPricingOverride[];
  effective_monthly_total_cents: number;   // after overrides applied
  trial_ends_at:                string | null;
  billing_status:               string;
}

interface RawPlanRow {
  id:                  string;
  display_name:        string;
  monthly_price_cents: number;
  trial_days:          number;
  included_modules:    string;
  stripe_price_id:     string | null;
  description:         string | null;
  is_active:           number;
  sort_order:          number;
}

function parsePlan(row: RawPlanRow): PricingPlan {
  let modules: ModuleKey[] = [];
  try {
    const parsed = JSON.parse(row.included_modules) as unknown;
    if (Array.isArray(parsed)) {
      modules = parsed.filter((m): m is ModuleKey => typeof m === "string");
    }
  } catch {
    // included_modules JSON corrupt — fall back to empty list. Caller
    // sees a plan with zero entitlements and can prompt the operator
    // to repair the row instead of blowing up.
  }
  return {
    id:                  row.id,
    display_name:        row.display_name,
    monthly_price_cents: row.monthly_price_cents,
    trial_days:          row.trial_days,
    included_modules:    modules,
    stripe_price_id:     row.stripe_price_id,
    description:         row.description,
    is_active:           row.is_active === 1,
    sort_order:          row.sort_order,
  };
}

/** All active pricing plans, ordered for the customer-facing pricing page. */
export async function listPricingPlans(env: Env): Promise<PricingPlan[]> {
  const result = await env.DB.prepare(
    `SELECT id, display_name, monthly_price_cents, trial_days,
            included_modules, stripe_price_id, description,
            is_active, sort_order
     FROM pricing_plans
     WHERE is_active = 1
     ORDER BY sort_order ASC, monthly_price_cents ASC`,
  ).all<RawPlanRow>();
  return (result.results ?? []).map(parsePlan);
}

export async function getPricingPlan(env: Env, planId: string): Promise<PricingPlan | null> {
  const row = await env.DB.prepare(
    `SELECT id, display_name, monthly_price_cents, trial_days,
            included_modules, stripe_price_id, description,
            is_active, sort_order
     FROM pricing_plans
     WHERE id = ?`,
  ).bind(planId).first<RawPlanRow>();
  return row ? parsePlan(row) : null;
}

/** All active per-module prices for à-la-carte selection. */
export async function listModulePrices(env: Env): Promise<ModulePrice[]> {
  const result = await env.DB.prepare(
    `SELECT module_key, display_name, monthly_price_cents,
            stripe_price_id, is_active
     FROM module_prices
     WHERE is_active = 1
     ORDER BY display_name ASC`,
  ).all<{
    module_key:          string;
    display_name:        string;
    monthly_price_cents: number;
    stripe_price_id:     string | null;
    is_active:           number;
  }>();
  return (result.results ?? []).map((r) => ({
    module_key:          r.module_key as ModuleKey,
    display_name:        r.display_name,
    monthly_price_cents: r.monthly_price_cents,
    stripe_price_id:     r.stripe_price_id,
    is_active:           r.is_active === 1,
  }));
}

/**
 * Active pricing overrides for an org, ordered most-recent-first.
 *
 * Active = effective_until IS NULL OR effective_until > now.
 * Multiple rows may match; consumers (e.g. the price calculator)
 * pick the most-recent for each axis (tier vs module vs discount).
 */
export async function listOrgPricingOverrides(
  env:   Env,
  orgId: number,
): Promise<OrgPricingOverride[]> {
  const result = await env.DB.prepare(
    `SELECT id, org_id, override_type, plan_id, module_key,
            custom_price_cents, discount_pct, reason, set_by_user_id,
            effective_from, effective_until, created_at
     FROM org_pricing_overrides
     WHERE org_id = ?
       AND (effective_until IS NULL OR effective_until > datetime('now'))
     ORDER BY created_at DESC`,
  ).bind(orgId).all<{
    id:                 string;
    org_id:             number;
    override_type:      string;
    plan_id:            string | null;
    module_key:         string | null;
    custom_price_cents: number | null;
    discount_pct:       number | null;
    reason:             string;
    set_by_user_id:     string | null;
    effective_from:     string;
    effective_until:    string | null;
    created_at:         string;
  }>();
  return (result.results ?? []).map((r) => ({
    ...r,
    override_type: r.override_type as OverrideType,
    module_key:    r.module_key as ModuleKey | null,
  }));
}

/**
 * Compute the effective monthly total for an org by applying any
 * active overrides on top of the baseline tier and per-module prices.
 *
 * Order of precedence per axis:
 *   1. Most-recent active override row on the relevant axis wins.
 *   2. tier_price override → custom_price_cents replaces plan baseline.
 *   3. module_price override → custom_price_cents replaces module baseline.
 *   4. discount_percent override → applied AFTER tier + module sums.
 *
 * Returns the org's pricing summary including the active overrides
 * so callers can render "negotiated price" alongside "list price".
 */
export async function getOrgPricingSummary(
  env:   Env,
  orgId: number,
): Promise<OrgPricingSummary> {
  // 1. Org row — plan_id, trial, billing status.
  const orgRow = await env.DB.prepare(
    `SELECT plan_id, trial_ends_at, billing_status
     FROM organizations
     WHERE id = ?`,
  ).bind(orgId).first<{
    plan_id:        string | null;
    trial_ends_at:  string | null;
    billing_status: string;
  }>();

  // 2. Plan + active per-module subscriptions
  const plan = orgRow?.plan_id ? await getPricingPlan(env, orgRow.plan_id) : null;

  // Per-module subscriptions for this org are derived from their
  // org_modules entries that aren't already included in the plan.
  // Read-time computation keeps the DB schema additive.
  const enabledModulesRow = await env.DB.prepare(
    `SELECT module_key FROM org_modules
     WHERE org_id = ? AND status IN ('active', 'trial')`,
  ).bind(orgId).all<{ module_key: string }>();
  const enabledModules = (enabledModulesRow.results ?? []).map(
    (r) => r.module_key as ModuleKey,
  );

  const includedSet = new Set(plan?.included_modules ?? []);
  const aLaCarteKeys = enabledModules.filter((m) => !includedSet.has(m));

  const allModulePrices = await listModulePrices(env);
  const priceByKey = new Map(allModulePrices.map((p) => [p.module_key, p.monthly_price_cents] as const));
  const perModule = aLaCarteKeys.map((k) => ({
    module_key:  k,
    price_cents: priceByKey.get(k) ?? 0,
  }));

  // 3. Active overrides
  const overrides = await listOrgPricingOverrides(env, orgId);

  // 4. Effective price math
  const tierOverride     = overrides.find((o) => o.override_type === "tier_price");
  const tierPriceCents   = tierOverride?.custom_price_cents ?? plan?.monthly_price_cents ?? 0;

  const moduleOverrides  = overrides.filter((o) => o.override_type === "module_price");
  const moduleSubtotal   = perModule.reduce((acc, m) => {
    const ovr = moduleOverrides.find((o) => o.module_key === m.module_key);
    return acc + (ovr?.custom_price_cents ?? m.price_cents);
  }, 0);

  const discountOverride = overrides.find((o) => o.override_type === "discount_percent");
  const subtotal         = tierPriceCents + moduleSubtotal;
  const discountPct      = discountOverride?.discount_pct ?? 0;
  const effective        = Math.max(0, Math.round(subtotal * (1 - discountPct / 100)));

  return {
    org_id:                        orgId,
    plan,
    per_module_subscriptions:      perModule,
    active_overrides:              overrides,
    effective_monthly_total_cents: effective,
    trial_ends_at:                 orgRow?.trial_ends_at ?? null,
    billing_status:                orgRow?.billing_status ?? "unbilled",
  };
}
