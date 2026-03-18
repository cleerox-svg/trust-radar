import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Shield, AlertTriangle, ShieldCheck,
  Bot, User as UserIcon,
} from "lucide-react";
import type { User } from "../lib/types";

/* ── Section definitions ─────────────────────────────────────── */
export interface SubItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  socOnly?: boolean;
  influencerOnly?: boolean;
}

export interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: SubItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "home",
    label: "Home",
    icon: <LayoutDashboard size={20} />,
    items: [
      { path: "/dashboard", label: "Dashboard",   icon: <LayoutDashboard size={16} /> },
      { path: "/brand",     label: "Brand Score",  icon: <LayoutDashboard size={16} />, influencerOnly: true },
    ],
  },
  {
    id: "protect",
    label: "Protect",
    icon: <Shield size={20} />,
    items: [
      { path: "/threats",   label: "Threats",     icon: <AlertTriangle size={16} /> },
      { path: "/brands",    label: "Brands Hub",  icon: <ShieldCheck size={16} />, socOnly: true },
      { path: "/accounts",  label: "Platforms",   icon: <Shield size={16} /> },
      { path: "/takedowns", label: "Takedowns",   icon: <Shield size={16} /> },
    ],
  },
  {
    id: "intel",
    label: "Intel",
    icon: <Bot size={20} />,
    items: [
      { path: "/agents",    label: "AI Agents",   icon: <Bot size={16} />, socOnly: true },
    ],
  },
  {
    id: "me",
    label: "Me",
    icon: <UserIcon size={20} />,
    items: [
      { path: "/settings",  label: "Settings",    icon: <UserIcon size={16} /> },
      { path: "/admin",     label: "Admin",       icon: <UserIcon size={16} />, adminOnly: true },
    ],
  },
];

/* ── Get active section from pathname ─────────────────────────── */
export function getActiveSection(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path))) {
        return section.id;
      }
    }
  }
  return "home";
}

/* ── Filter items by user role ───────────────────────────────── */
export function filterItems(items: SubItem[], user: User): SubItem[] {
  const isSocOrAdmin = user.role === "soc" || user.role === "admin";
  return items.filter((item) => {
    if (item.adminOnly && user.role !== "admin") return false;
    if (item.socOnly && !isSocOrAdmin) return false;
    if (item.influencerOnly && isSocOrAdmin) return false;
    return true;
  });
}

/* ── Bottom Bar component ─────────────────────────────────────── */
export function BottomBar({ user, threatCount }: { user: User; threatCount?: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = getActiveSection(location.pathname);
  const isSocOrAdmin = user.role === "soc" || user.role === "admin";

  // Filter sections that have no visible items for this user
  const visibleSections = NAV_SECTIONS.filter((section) => {
    const visibleItems = filterItems(section.items, user);
    return visibleItems.length > 0;
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex"
      style={{
        background: "var(--surface-raised)",
        borderTop: "1px solid var(--border-subtle)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {visibleSections.map((section) => {
        const isActive = activeSection === section.id;
        const showBadge = section.id === "protect" && (threatCount ?? 0) > 0;

        return (
          <button
            key={section.id}
            onClick={() => {
              const visibleItems = filterItems(section.items, user);
              const currentItem = visibleItems.find(
                (item) => location.pathname === item.path || location.pathname.startsWith(item.path)
              );
              navigate(currentItem?.path ?? visibleItems[0]?.path ?? "/dashboard");
            }}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors relative"
            style={{
              color: isActive ? "var(--gold-400)" : "var(--text-tertiary)",
            }}
          >
            <span className="relative">
              {section.icon}
              {showBadge && (
                <span
                  className="absolute -top-1 -right-2 text-[8px] font-bold px-1 rounded-full min-w-[14px] text-center"
                  style={{ background: "var(--red-400)", color: "#fff" }}
                >
                  {(threatCount ?? 0) > 9 ? "9+" : threatCount}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>{section.label}</span>
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                style={{ background: "var(--gold-400)" }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
