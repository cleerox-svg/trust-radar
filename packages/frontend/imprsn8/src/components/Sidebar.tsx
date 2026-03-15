import { useState, useEffect } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { TrustRadarLogo } from "./TrustRadarLogo";
import {
  LayoutDashboard, Shield, AlertTriangle, Download,
  Bot, Settings, LogOut, ChevronDown, ChevronRight,
  Users, Lock, TrendingUp, Search,
} from "lucide-react";
import { ThemeToggle } from "./ui/ThemeToggle";
import { PlatformSwitcher } from "./PlatformSwitcher";
import { auth, influencers, ApiError } from "../lib/api";
import type { User, InfluencerProfile } from "../lib/types";

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  adminOnly?: boolean;
  socOnly?: boolean;
  influencerOnly?: boolean;
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard",   icon: <LayoutDashboard size={15} /> },
      { to: "/brand",     label: "Brand Score",  icon: <TrendingUp size={15} />, influencerOnly: true },
    ],
  },
  {
    label: "Protection",
    items: [
      { to: "/threats",   label: "Threat Center", icon: <AlertTriangle size={15} /> },
      { to: "/accounts",  label: "Platforms",     icon: <Shield size={15} /> },
      { to: "/takedowns", label: "Takedowns",     icon: <Download size={15} /> },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/agents", label: "AI Agents",     icon: <Bot size={15} />, socOnly: true },
      { to: "/admin",  label: "Admin Console", icon: <Lock size={15} />, adminOnly: true },
    ],
  },
];

interface SidebarProps {
  user: User;
  influencerList: InfluencerProfile[];
  selectedInfluencer: InfluencerProfile | null;
  onInfluencerChange: (inf: InfluencerProfile | null) => void;
  threatCount?: number;
  onClose?: () => void;
}

export function Sidebar({ user, influencerList, selectedInfluencer, onInfluencerChange, threatCount, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const isSocOrAdmin = user.role === "soc" || user.role === "admin";

  function logout() {
    localStorage.removeItem("imprsn8_token");
    navigate("/");
  }

  const displayName = selectedInfluencer?.display_name ?? user.display_name ?? user.email?.split("@")[0] ?? "User";
  const handle = selectedInfluencer?.handle ?? user.username ?? "";
  const initial = displayName[0]?.toUpperCase() ?? "?";
  const avatarUrl = selectedInfluencer?.avatar_url ?? null;

  function filterItems(items: NavItem[]) {
    return items.filter((item) => {
      if (item.adminOnly && user.role !== "admin") return false;
      if (item.socOnly && !isSocOrAdmin) return false;
      if (item.influencerOnly && isSocOrAdmin) return false;
      return true;
    });
  }

  return (
    <aside
      className="flex-shrink-0 flex flex-col h-full"
      style={{
        width: 240,
        background: "var(--surface-raised)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* ── Header: logo + search trigger ─────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--border-subtle)", height: 56 }}
      >
        <Link to="/" className="block group" onClick={onClose}>
          <TrustRadarLogo variant="topbar" theme="dark" className="group-hover:opacity-80 transition-opacity" />
        </Link>
        <div className="flex items-center gap-1.5">
          <PlatformSwitcher />
          <button
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            title="Search (⌘K)"
            aria-label="Search"
            onClick={() => {/* future: open command palette */}}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
          >
            <Search size={14} />
          </button>
        </div>
      </div>

      {/* ── Influencer switcher (SOC/Admin) ────────────────────── */}
      {isSocOrAdmin && influencerList.length > 0 && (
        <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((o) => !o)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
              style={{
                background: "var(--surface-overlay)",
                border: "1px solid var(--border-default)",
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "rgba(109,64,237,0.2)", color: "var(--violet-300)" }}
                >
                  {initial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{displayName}</div>
                {handle && <div className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>@{handle}</div>}
              </div>
              <ChevronDown size={11} style={{ color: "var(--text-tertiary)" }} className="flex-shrink-0" />
            </button>

            {switcherOpen && (
              <div
                className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg shadow-2xl overflow-hidden animate-fade-in"
                style={{ background: "var(--surface-overlay)", border: "1px solid var(--border-default)" }}
              >
                <button
                  onClick={() => { onInfluencerChange(null); setSwitcherOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-float)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <Users size={11} /> All influencers
                </button>
                <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
                {influencerList.map((inf) => {
                  const isSelected = selectedInfluencer?.id === inf.id;
                  return (
                    <button
                      key={inf.id}
                      onClick={() => { onInfluencerChange(inf); setSwitcherOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors"
                      style={{
                        color: isSelected ? "var(--gold-400)" : "var(--text-secondary)",
                        background: isSelected ? "rgba(240,165,0,0.06)" : "",
                      }}
                    >
                      {inf.avatar_url ? (
                        <img src={inf.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                          style={{ background: "rgba(109,64,237,0.2)", color: "var(--violet-300)" }}>
                          {inf.display_name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{inf.display_name}</div>
                        <div className="truncate" style={{ color: "var(--text-tertiary)" }}>@{inf.handle}</div>
                      </div>
                      {isSelected && <ChevronRight size={10} className="ml-auto" style={{ color: "var(--gold-400)" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2" style={{ paddingLeft: 3 }}>
        {NAV_SECTIONS.map((section) => {
          const visibleItems = filterItems(section.items);
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              <div className="nav-section">{section.label}</div>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                  style={{ marginRight: 12 }}
                >
                  <span style={{ color: "inherit", display: "flex", alignItems: "center" }}>{item.icon}</span>
                  <span className="flex-1 text-sm">{item.label}</span>
                  {item.label === "Threat Center" && (threatCount ?? 0) > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: "rgba(232,22,59,0.15)",
                        color: "var(--red-300)",
                        border: "1px solid rgba(232,22,59,0.30)",
                      }}
                    >
                      {(threatCount ?? 0) > 99 ? "99+" : threatCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* ── Bottom: user row ───────────────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "8px 12px 8px" }}>
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          style={{ marginBottom: 2 }}
        >
          <Settings size={14} />
          <span className="flex-1 text-sm">Settings</span>
        </NavLink>

        {/* User row */}
        <div className="flex items-center gap-2 px-3 py-2 mt-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: "rgba(109,64,237,0.2)", color: "var(--violet-300)" }}
            >
              {initial}
            </div>
          )}
          <span className="flex-1 text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>
            {displayName}
          </span>
          <ThemeToggle />
          <button
            onClick={logout}
            className="p-1 rounded transition-colors"
            title="Sign out"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red-400)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
          >
            <LogOut size={13} />
          </button>
        </div>

        {/* GUARDING status pill */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1"
          style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.15)" }}
        >
          <span className="status-dot active" />
          <span className="text-[11px] font-bold tracking-wider" style={{ color: "#16A34A" }}>
            GUARDING
          </span>
        </div>
      </div>
    </aside>
  );
}

// ─── Mobile Bottom Tab Bar ──────────────────────────────────────────────────
// Shows on screens < lg. 5 items max, labels always visible.
export function MobileTabBar({ threatCount }: { threatCount?: number }) {
  const tabs = [
    { to: "/dashboard", label: "Home",        icon: <LayoutDashboard size={20} /> },
    { to: "/threats",   label: "Threats",     icon: <AlertTriangle size={20} /> },
    { to: "/agents",    label: "Intelligence", icon: <Bot size={20} /> },
    { to: "/accounts",  label: "Platforms",   icon: <Shield size={20} /> },
    { to: "/settings",  label: "Settings",    icon: <Settings size={20} /> },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex lg:hidden"
      style={{
        background: "var(--surface-raised)",
        borderTop: "1px solid var(--border-subtle)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors relative ${
              isActive ? "" : ""
            }`
          }
          style={({ isActive }) => ({
            color: isActive ? "var(--gold-400)" : "var(--text-tertiary)",
          })}
        >
          {tab.icon}
          <span style={{ fontSize: 10, fontWeight: 500 }}>{tab.label}</span>
          {tab.label === "Threats" && (threatCount ?? 0) > 0 && (
            <span
              className="absolute top-1 right-1/4 text-[9px] font-bold px-1 rounded-full"
              style={{ background: "var(--red-400)", color: "#fff", minWidth: 14, textAlign: "center" }}
            >
              {(threatCount ?? 0) > 99 ? "99+" : threatCount}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

// ─── Hook to load current user + influencers ───────────────────────────────
export function useSidebarData() {
  const [user, setUser] = useState<User | null>(null);
  const [influencerList, setInfluencerList] = useState<InfluencerProfile[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("imprsn8_token");
    if (!token) { setUnauthenticated(true); setLoading(false); return; }

    let cancelled = false;

    async function fetchMe(): Promise<void> {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (cancelled) return;
        try {
          const u = await auth.me();
          if (cancelled) return;
          setApiError(null);
          setUser(u);
          influencers.list()
            .then((infs) => {
              if (cancelled) return;
              setInfluencerList(infs);
              if ((u.role === "influencer" || u.role === "staff") && u.assigned_influencer_id) {
                const assigned = infs.find((i) => i.id === u.assigned_influencer_id);
                if (assigned) setSelectedInfluencer(assigned);
              }
            })
            .catch(() => { /* empty list is fine */ });
          return;
        } catch (err) {
          if (cancelled) return;
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            localStorage.removeItem("imprsn8_token");
            setUnauthenticated(true);
            return;
          }
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          } else {
            localStorage.removeItem("imprsn8_token");
            setUnauthenticated(true);
          }
        }
      }
    }

    fetchMe().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [navigate]);

  return { user, influencerList, selectedInfluencer, setSelectedInfluencer, loading, unauthenticated, apiError };
}
