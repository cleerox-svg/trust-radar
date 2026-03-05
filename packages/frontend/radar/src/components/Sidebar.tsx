import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../App";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  alertBadge?: boolean;
  staticBadge?: number;
}

interface Section {
  title: string;
  items: NavItem[];
}

const Icon = ({ d }: { d: string }) => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const sections: Section[] = [
  {
    title: "OPERATIONS",
    items: [
      { path: "/dashboard", label: "Dashboard", icon: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
      { path: "/scan",      label: "URL Scanner", icon: <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> },
      { path: "/history",   label: "Scan History", icon: <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { path: "/entities",  label: "Entities",  icon: <Icon d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm4 4h8m-8 4h5" /> },
      { path: "/signals",   label: "Signals",   icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
      { path: "/alerts",    label: "Alerts",    icon: <Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />, alertBadge: true },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { path: "/trends",  label: "Trends",  icon: <Icon d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
      { path: "/geo-map", label: "Geo Map", icon: <Icon d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /> },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { path: "/knowledge-base", label: "Knowledge Base", icon: <Icon d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
      { path: "/ai-advisor",     label: "AI Advisor",     icon: <Icon d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> },
    ],
  },
  {
    title: "INGEST",
    items: [
      { path: "/send-signals", label: "Send Signals", icon: <Icon d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /> },
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
    <aside className="w-56 h-full min-h-screen bg-radar-sidebar border-r border-radar-border flex flex-col">
      {/* Brand + mobile close */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-radar-cyan/20 border border-radar-cyan/40 flex items-center justify-center shrink-0">
            <div className="w-3 h-3 rounded-full bg-radar-cyan" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-radar-text text-sm leading-tight">Trust Radar</div>
            <div className="text-[10px] text-radar-muted leading-tight">Signal Intelligence</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden ml-2 p-1 rounded text-radar-muted hover:text-radar-text transition-colors"
          aria-label="Close sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="section-label">{section.title}</div>
            {section.items.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));
              const badge = item.alertBadge ? alertCount : item.staticBadge;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={isActive ? "nav-item-active" : "nav-item"}
                >
                  <span className="shrink-0 opacity-70">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                      item.alertBadge
                        ? "bg-radar-red/20 text-radar-red"
                        : "bg-radar-cyan/20 text-radar-cyan"
                    }`}>
                      {badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}

        {/* Admin link — only visible to admins */}
        {user?.is_admin && (
          <div>
            <div className="section-label">SYSTEM</div>
            <NavLink
              to="/admin"
              onClick={onClose}
              className={location.pathname === "/admin" ? "nav-item-active" : "nav-item"}
            >
              <span className="shrink-0 opacity-70">
                <Icon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </span>
              <span className="flex-1 truncate">Admin Panel</span>
              <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-radar-red/20 text-radar-red shrink-0">ADM</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-radar-border shrink-0">
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-radar-cyan/20 border border-radar-cyan/30 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-radar-cyan uppercase">{user.email[0]}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-radar-text font-mono truncate">{user.email}</div>
                <div className="text-[10px] text-radar-muted capitalize">{user.plan} plan</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full text-left text-[11px] text-radar-muted hover:text-radar-red transition-colors flex items-center gap-1.5 py-1 px-1 rounded hover:bg-radar-red/5"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        ) : (
          <div className="text-[10px] text-radar-muted font-mono">v2.0.0 · lrxradar.com</div>
        )}
      </div>
    </aside>
  );
}
