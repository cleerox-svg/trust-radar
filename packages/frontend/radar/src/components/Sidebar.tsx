import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import { StatusDot } from "./ui/StatusDot";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  alertBadge?: boolean;
  badge?: string;
}

interface Section {
  title: string;
  items: NavItem[];
}

const I = ({ d }: { d: string }) => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const sections: Section[] = [
  {
    title: "MISSION CONTROL",
    items: [
      { path: "/dashboard",      label: "Dashboard",       icon: <I d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
      { path: "/threat-map",     label: "Threat Map",      icon: <I d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { path: "/brand-exposure", label: "Brand Exposure",  icon: <I d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /> },
      { path: "/alerts",         label: "Critical Alerts", icon: <I d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />, alertBadge: true },
      { path: "/briefing",       label: "Daily Briefing",  icon: <I d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
    ],
  },
  {
    title: "INVESTIGATE",
    items: [
      { path: "/scan",           label: "URL Scanner",     icon: <I d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> },
      { path: "/history",        label: "Scan History",    icon: <I d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { path: "/signals",        label: "Signal Correlation", icon: <I d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
      { path: "/investigations", label: "Investigations",  icon: <I d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /> },
      { path: "/takedowns",     label: "Takedowns",       icon: <I d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> },
      { path: "/entities",      label: "Entities",        icon: <I d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm4 4h8m-8 4h5" /> },
    ],
  },
  {
    title: "AGENTS & AUTOMATION",
    items: [
      { path: "/agent-hub",     label: "Agent Hub",       icon: <I d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
      { path: "/trustbot",      label: "TrustBot",        icon: <I d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />, badge: "AI" },
    ],
  },
  {
    title: "INTELLIGENCE FEEDS",
    items: [
      { path: "/feed-analytics", label: "Feed Analytics",   icon: <I d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
      { path: "/social-intel",   label: "Social Intel",     icon: <I d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> },
      { path: "/dark-web",       label: "Dark Web",         icon: <I d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /> },
      { path: "/ato",            label: "Account Takeover", icon: <I d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /> },
      { path: "/email-auth",     label: "Email Auth",       icon: <I d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
      { path: "/cloud-status",   label: "Cloud Status",     icon: <I d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /> },
    ],
  },
  {
    title: "PLATFORM",
    items: [
      { path: "/knowledge-base", label: "Knowledge Base",  icon: <I d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
      { path: "/send-signals",   label: "Send Signals",    icon: <I d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /> },
    ],
  },
];

interface SidebarProps {
  onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const { user, alertCount, logout } = useAuth();

  return (
    <aside className="w-60 h-full min-h-screen flex flex-col" style={{ background: "var(--surface-void)", borderRight: "1px solid var(--border-subtle)" }}>
      {/* Brand header */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <div className="w-3 h-3 rounded-full bg-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-[--text-primary] text-sm leading-tight">Trust Radar</div>
            <div className="text-[10px] text-[--text-tertiary] leading-tight font-mono">v3.0 · intelligence</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden ml-2 p-1 rounded text-[--text-tertiary] hover:text-[--text-primary] transition-colors"
          aria-label="Close sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="section-label">{section.title}</div>
            {section.items.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));
              const alertBadgeValue = item.alertBadge ? alertCount : 0;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={isActive ? "nav-item-active" : "nav-item"}
                >
                  <span className="shrink-0 opacity-70">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {alertBadgeValue > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 bg-threat-critical/20 text-threat-critical">
                      {alertBadgeValue > 99 ? "99+" : alertBadgeValue}
                    </span>
                  )}
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 bg-cyan-500/15 text-cyan-400">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}

        {/* Admin — only for admins */}
        {user?.is_admin && (
          <div>
            <div className="section-label">ADMIN</div>
            <NavLink
              to="/admin"
              onClick={onClose}
              className={location.pathname === "/admin" ? "nav-item-active" : "nav-item"}
            >
              <span className="shrink-0 opacity-70">
                <I d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <I d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </span>
              <span className="flex-1 truncate">Admin Panel</span>
              <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-threat-critical/15 text-threat-critical shrink-0">ADM</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* Connection status */}
      <div className="px-3 py-2 border-t border-[--border-subtle]" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-1.5 mb-2">
          <StatusDot variant="active" size="sm" />
          <span className="text-[11px] text-[--text-tertiary] font-mono">Connected · lrxradar.com</span>
        </div>
      </div>

      {/* User footer */}
      <div className="px-3 py-3 border-t shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-cyan-400 uppercase">{user.email[0]}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-[--text-primary] font-mono truncate">{user.email}</div>
                <div className="text-[10px] text-[--text-tertiary] capitalize">{user.plan} plan</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full text-left text-[11px] text-[--text-tertiary] hover:text-threat-critical transition-colors flex items-center gap-1.5 py-1 px-1 rounded hover:bg-threat-critical/5"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        ) : (
          <div className="text-[10px] text-[--text-tertiary] font-mono">v3.0.0 · lrxradar.com</div>
        )}
      </div>
    </aside>
  );
}
