import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../App";

/* ── SVG icon helper ─────────────────────────────────────────── */
const I = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

/* ── Section definitions ─────────────────────────────────────── */
export type RoleLevel = "admin" | "analyst" | "customer";

export interface SubItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  alertBadge?: boolean;
  badge?: string;
  adminOnly?: boolean;
  /** Minimum role required: admin > analyst > customer */
  minRole?: RoleLevel;
}

const ROLE_RANK: Record<RoleLevel, number> = { customer: 0, analyst: 1, admin: 2 };

export function hasRoleAccess(userRole: RoleLevel | undefined, minRole: RoleLevel | undefined): boolean {
  if (!minRole) return true;
  return ROLE_RANK[userRole ?? "customer"] >= ROLE_RANK[minRole];
}

export interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: SubItem[];
}

const I16 = ({ d }: { d: string }) => <I d={d} size={16} />;

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "mission",
    label: "Mission",
    icon: <I d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    items: [
      { path: "/dashboard",      label: "Command Center",  icon: <I16 d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { path: "/brand-exposure", label: "Brand Exposure",  icon: <I16 d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /> },
      { path: "/alerts",         label: "Alerts",          icon: <I16 d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />, alertBadge: true },
      { path: "/briefing",       label: "Briefing",        icon: <I16 d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
    ],
  },
  {
    id: "investigate",
    label: "Investigate",
    icon: <I d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
    items: [
      { path: "/scan",           label: "URL Scanner",     icon: <I16 d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> },
      { path: "/history",        label: "Scan History",    icon: <I16 d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { path: "/signals",        label: "Signals",         icon: <I16 d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />, minRole: "analyst" },
      { path: "/investigations", label: "Investigations",  icon: <I16 d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />, minRole: "analyst" },
      { path: "/takedowns",      label: "Takedowns",       icon: <I16 d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />, minRole: "analyst" },
      { path: "/entities",       label: "Entities",        icon: <I16 d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm4 4h8m-8 4h5" />, minRole: "analyst" },
    ],
  },
  {
    id: "agents",
    label: "Agents",
    icon: <I d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    items: [
      { path: "/agent-hub",      label: "Agent Hub",       icon: <I16 d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />, minRole: "analyst" },
      { path: "/trustbot",       label: "TrustBot",        icon: <I16 d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />, badge: "AI" },
    ],
  },
  {
    id: "feeds",
    label: "Feeds",
    icon: <I d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
    items: [
      { path: "/feed-analytics", label: "Analytics",       icon: <I16 d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
      { path: "/social-intel",   label: "Social Intel",    icon: <I16 d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
      { path: "/dark-web",       label: "Dark Web",        icon: <I16 d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />, minRole: "analyst" },
      { path: "/ato",            label: "ATO",             icon: <I16 d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /> },
      { path: "/email-auth",     label: "Email Auth",      icon: <I16 d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
      { path: "/cloud-status",   label: "Cloud",           icon: <I16 d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /> },
    ],
  },
  {
    id: "more",
    label: "More",
    icon: <I d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />,
    items: [
      { path: "/knowledge-base", label: "Knowledge Base",  icon: <I16 d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
      { path: "/ai-advisor",     label: "AI Advisor",      icon: <I16 d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> },
      { path: "/send-signals",   label: "Send Signals",    icon: <I16 d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /> },
      { path: "/admin",          label: "Admin Panel",     icon: <I16 d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />, adminOnly: true, badge: "ADM" },
    ],
  },
];

/* ── Resolve active section from pathname ─────────────────────── */
export function getActiveSection(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path))) {
        return section.id;
      }
    }
  }
  return "mission";
}

/* ── Bottom Bar component ─────────────────────────────────────── */
export function BottomBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { alertCount, user } = useAuth();
  const activeSection = getActiveSection(location.pathname);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex"
      style={{
        background: "var(--surface-void)",
        borderTop: "1px solid var(--border-subtle)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {NAV_SECTIONS.map((section) => {
        const isActive = activeSection === section.id;
        // Alert badge for Mission section
        const showBadge = section.id === "mission" && alertCount > 0;
        // Hide admin items check
        if (section.id === "more" && !user?.is_admin) {
          // Still show More, just filter admin items later
        }

        return (
          <button
            key={section.id}
            onClick={() => {
              // Navigate to the first item of the section (or current section's active item)
              const currentItem = section.items.find(
                (item) => location.pathname === item.path || location.pathname.startsWith(item.path)
              );
              navigate(currentItem?.path ?? section.items[0].path);
            }}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative min-h-[48px]"
            style={{
              color: isActive ? "var(--cyan-400)" : "var(--text-tertiary)",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span className="relative">
              {section.icon}
              {showBadge && (
                <span
                  className="absolute -top-1 -right-2 text-[8px] font-bold px-1 rounded-full min-w-[14px] text-center"
                  style={{ background: "var(--threat-critical)", color: "#fff" }}
                >
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>{section.label}</span>
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                style={{ background: "var(--cyan-400)" }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
