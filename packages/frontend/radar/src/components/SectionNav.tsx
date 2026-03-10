import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import { NAV_SECTIONS, getActiveSection, hasRoleAccess, type RoleLevel } from "./BottomBar";

/**
 * Horizontal sub-tabs rendered at the top of the content area.
 * Shows the items for the currently active bottom-bar section.
 */
export function SectionNav() {
  const location = useLocation();
  const { alertCount, user } = useAuth();
  const activeSectionId = getActiveSection(location.pathname);
  const section = NAV_SECTIONS.find((s) => s.id === activeSectionId);

  if (!section) return null;

  // Filter by admin-only and role-based access
  const userRole = (user?.role ?? "customer") as RoleLevel;
  const items = section.items.filter((item) => {
    if (item.adminOnly && !user?.is_admin) return false;
    if (!hasRoleAccess(userRole, item.minRole)) return false;
    return true;
  });

  return (
    <div
      className="flex items-center gap-1 px-4 py-2 overflow-x-auto no-scrollbar"
      style={{
        background: "var(--surface-void)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {items.map((item) => {
        const isActive =
          location.pathname === item.path ||
          (item.path !== "/" && location.pathname.startsWith(item.path));
        const badgeCount = item.alertBadge ? alertCount : 0;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 min-h-[36px]"
            style={{
              color: isActive ? "var(--cyan-400)" : "var(--text-secondary)",
              background: isActive ? "rgba(34, 211, 238, 0.1)" : "transparent",
              border: isActive ? "1px solid rgba(34, 211, 238, 0.2)" : "1px solid transparent",
            }}
          >
            <span className="opacity-75">{item.icon}</span>
            {item.label}
            {badgeCount > 0 && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(239, 68, 68, 0.2)", color: "var(--threat-critical)" }}
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
            {item.badge && (
              <span
                className="text-[9px] font-bold px-1 py-0.5 rounded"
                style={{ background: "rgba(34, 211, 238, 0.15)", color: "var(--cyan-400)" }}
              >
                {item.badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}
