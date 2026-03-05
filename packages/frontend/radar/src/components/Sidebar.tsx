import { NavLink, useLocation } from "react-router-dom";

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: number;
}

interface Section {
  title: string;
  items: NavItem[];
}

const sections: Section[] = [
  {
    title: "OPERATIONS",
    items: [
      { path: "/dashboard", label: "Dashboard", icon: "○" },
      { path: "/entities",  label: "Entities",  icon: "◇", badge: 12 },
      { path: "/signals",   label: "Signals",   icon: "△" },
      { path: "/alerts",    label: "Alerts",    icon: "△", badge: 3 },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { path: "/trends",  label: "Trends",  icon: "◇" },
      { path: "/geo-map", label: "Geo Map", icon: "⊕" },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { path: "/knowledge-base", label: "Knowledge Base", icon: "▣" },
      { path: "/ai-advisor",     label: "AI Advisor",     icon: "+" },
    ],
  },
  {
    title: "INGEST",
    items: [
      { path: "/send-signals", label: "Send Signals", icon: "▣" },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-56 min-h-screen bg-radar-sidebar border-r border-radar-border flex flex-col pt-4 pb-6">
      {/* Brand */}
      <div className="px-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-radar-cyan/20 border border-radar-cyan/40 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-radar-cyan" />
          </div>
          <div>
            <div className="font-bold text-radar-text text-sm">Trust Radar</div>
            <div className="text-[10px] text-radar-muted">Signal Intelligence Platform</div>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-2 space-y-0.5">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="section-label">{section.title}</div>
            {section.items.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={isActive ? "nav-item-active" : "nav-item"}
                >
                  <span className="text-xs w-3.5 text-center opacity-70">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      item.label === "Alerts"
                        ? "bg-radar-red/20 text-radar-red"
                        : "bg-radar-cyan/20 text-radar-cyan"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 mt-4 border-t border-radar-border pt-3">
        <div className="text-[10px] text-radar-muted font-mono">v2.0.0 · lrx-radar.com</div>
      </div>
    </aside>
  );
}
