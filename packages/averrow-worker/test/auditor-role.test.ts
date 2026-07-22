import { describe, it, expect } from "vitest";
import { roleHasPermission, listRolePermissions, isStaffRole, type StaffPermission } from "../src/lib/role-permissions";
import { hasGlobalReadScope, isReadOnlyGlobalRole, verifyOrgAccess, type AuthContext } from "../src/middleware/auth";
import { uiPreviewDbRole } from "../src/handlers/auth";
import type { UserRole } from "../src/types";

// AUTH_AUDIT_2026-06: `auditor` is a read-only global seat — sees all
// backend + tenant data, mutates nothing, never super_admin.

const READ_FLAGS: StaffPermission[] = ["read_customers", "view_billing", "view_audit"];
const WRITE_FLAGS: StaffPermission[] = ["edit_pricing", "edit_alerts", "manage_takedowns", "manage_invites"];

describe("auditor permissions are read-only", () => {
  it("grants exactly the three read/view flags", () => {
    for (const f of READ_FLAGS) expect(roleHasPermission("auditor", f)).toBe(true);
    expect(listRolePermissions("auditor").sort()).toEqual([...READ_FLAGS].sort());
  });

  it("grants no mutating permission", () => {
    for (const f of WRITE_FLAGS) expect(roleHasPermission("auditor", f)).toBe(false);
  });

  it("is staff (not a customer)", () => {
    expect(isStaffRole("auditor")).toBe(true);
  });
});

describe("auditor has global (cross-tenant) read scope", () => {
  it("is unscoped like super_admin", () => {
    expect(hasGlobalReadScope("auditor")).toBe(true);
    expect(hasGlobalReadScope("super_admin")).toBe(true);
  });

  it("does not grant global scope to ordinary staff or clients", () => {
    for (const r of ["admin", "analyst", "sales", "support", "billing", "client"] as const) {
      expect(hasGlobalReadScope(r)).toBe(false);
    }
  });
});

describe("auditor preview is stored under a CHECK-valid placeholder role", () => {
  it("maps the auditor JWT role to a persisted 'analyst' row", () => {
    expect(uiPreviewDbRole("auditor")).toBe("analyst");
  });

  it("leaves CHECK-valid roles untouched", () => {
    expect(uiPreviewDbRole("analyst")).toBe("analyst");
    expect(uiPreviewDbRole("admin")).toBe("admin");
    expect(uiPreviewDbRole("client")).toBe("client");
  });
});

// S3.1: verifyOrgAccess collapses 14 duplicated per-handler org-isolation
// copies into one shared inner-net check. isReadOnlyGlobalRole is the
// guarantee that auditor — exempted from the org check by
// hasGlobalReadScope — still gets write-blocked by handlers that mutate.

function ctx(role: UserRole, orgId: string | null): AuthContext {
  return {
    userId: "u-test",
    email: "test@averrow.local",
    role,
    orgId,
    orgRole: orgId ? "analyst" : null,
    embeddedScope: undefined,
    enrollOnly: false,
  };
}

describe("verifyOrgAccess", () => {
  it("exempts super_admin even when ctx.orgId does not match orgId", () => {
    expect(verifyOrgAccess(ctx("super_admin", "org_a"), "org_b")).toBeNull();
  });

  it("exempts auditor even when ctx.orgId does not match orgId", () => {
    expect(verifyOrgAccess(ctx("auditor", "org_a"), "org_b")).toBeNull();
  });

  it("allows a real member whose ctx.orgId matches the route orgId", () => {
    expect(verifyOrgAccess(ctx("client", "org_a"), "org_a")).toBeNull();
  });

  it("denies a real member whose ctx.orgId does not match the route orgId", () => {
    expect(verifyOrgAccess(ctx("analyst", "org_a"), "org_b")).toBe(
      "Not a member of this organization",
    );
    expect(verifyOrgAccess(ctx("client", "org_a"), "org_b")).toBe(
      "Not a member of this organization",
    );
  });

  it("denies a non-global role with a null ctx.orgId against a real orgId", () => {
    expect(verifyOrgAccess(ctx("client", null), "org_a")).toBe(
      "Not a member of this organization",
    );
  });
});

describe("isReadOnlyGlobalRole", () => {
  it("is true only for auditor", () => {
    expect(isReadOnlyGlobalRole("auditor")).toBe(true);
  });

  it("is false for every other role, including the other global-read role super_admin", () => {
    const others: UserRole[] = ["super_admin", "admin", "analyst", "sales", "support", "billing", "client"];
    for (const r of others) expect(isReadOnlyGlobalRole(r)).toBe(false);
  });
});
