import { NavLink, useLocation } from "react-router-dom";
import { NAV_SECTIONS, getActiveSection, filterItems } from "./BottomBar";
import type { User } from "../lib/types";

/**
 * Horizontal sub-tabs at top of content area.
 * Shows items for the currently active bottom bar section.
 */
export function SectionNav({ user }: { user: User }) {
  const location = useLocation();
  const activeSectionId = getActiveSection(location.pathname);
  const section = NAV_SECTIONS.find((s) => s.id === activeSectionId);

  if (!section) return null;

  const items = filterItems(section.items, user);

  // Don't show sub-tabs if there's only one item
  if (items.length <= 1) return null;

  return (
    <div
      className="flex items-center gap-1 px-4 py-2 overflow-x-auto shrink-0"
      style={{
        background: "var(--surface-raised)",
        borderBottom: "1px solid var(--border-subtle)",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {items.map((item) => {
        const isActive =
          location.pathname === item.path ||
          (item.path !== "/" && location.pathname.startsWith(item.path));

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0"
            style={{
              color: isActive ? "var(--gold-400)" : "var(--text-secondary)",
              background: isActive ? "rgba(240, 165, 0, 0.1)" : "transparent",
              border: isActive ? "1px solid rgba(240, 165, 0, 0.2)" : "1px solid transparent",
            }}
          >
            <span className="opacity-75">{item.icon}</span>
            {item.label}
          </NavLink>
        );
      })}
    </div>
  );
}
