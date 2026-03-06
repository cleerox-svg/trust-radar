import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Shield, AlertTriangle, Download,
  Bot, Settings, LogOut, ChevronDown, ChevronRight,
  Users, Lock,
} from "lucide-react";
import { Pulse } from "./ui/Pulse";
import { auth, influencers, ApiError } from "../lib/api";
import type { User, InfluencerProfile } from "../lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  adminOnly?: boolean;
  socOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard",   label: "Overview",         icon: <LayoutDashboard size={16} /> },
  { to: "/accounts",    label: "Monitored",         icon: <Shield size={16} /> },
  { to: "/threats",     label: "Threats Found",     icon: <AlertTriangle size={16} /> },
  { to: "/takedowns",   label: "Takedowns",         icon: <Download size={16} /> },
  { to: "/agents",      label: "Agents",            icon: <Bot size={16} /> },
  { to: "/admin",       label: "Admin Console",     icon: <Lock size={16} />, adminOnly: true },
];

interface SidebarProps {
  user: User;
  influencerList: InfluencerProfile[];
  selectedInfluencer: InfluencerProfile | null;
  onInfluencerChange: (inf: InfluencerProfile | null) => void;
  threatCount?: number;
  onClose?: () => void;
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-xs text-slate-500 tabular-nums">
      {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
    </span>
  );
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

  return (
    <aside className="w-64 lg:w-56 flex-shrink-0 flex flex-col bg-soc-card border-r border-soc-border h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-soc-border">
        <div className="syne text-xl font-extrabold tracking-tight text-slate-100">
          imprsn<span className="text-gold">8</span>
        </div>
        <div className="text-[10px] text-slate-600 mt-0.5 font-mono uppercase tracking-widest">
          Identity Protection
        </div>
      </div>

      {/* Influencer switcher (SOC/Admin only) */}
      <div className="px-3 py-3 border-b border-soc-border">
        {isSocOrAdmin && influencerList.length > 0 ? (
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((o) => !o)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg
                         bg-soc-bg border border-soc-border hover:border-soc-border-bright
                         transition-all text-left"
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-purple/20 border border-purple/30
                              flex items-center justify-center text-xs font-bold text-purple-light flex-shrink-0">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">{displayName}</div>
                {handle && <div className="text-[10px] text-slate-500 truncate">@{handle}</div>}
              </div>
              <ChevronDown size={12} className="text-slate-500 flex-shrink-0" />
            </button>

            {switcherOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-soc-card border border-soc-border
                              rounded-lg shadow-2xl overflow-hidden animate-fade-in">
                <button
                  onClick={() => { onInfluencerChange(null); setSwitcherOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400
                             hover:bg-soc-border/30 transition-colors"
                >
                  <Users size={12} /> All influencers
                </button>
                <div className="border-t border-soc-border" />
                {influencerList.map((inf) => (
                  <button
                    key={inf.id}
                    onClick={() => { onInfluencerChange(inf); setSwitcherOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors
                      ${selectedInfluencer?.id === inf.id
                        ? "bg-gold/10 text-gold"
                        : "text-slate-300 hover:bg-soc-border/20"}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-purple/20 flex items-center justify-center
                                    text-[9px] font-bold text-purple-light flex-shrink-0">
                      {inf.display_name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{inf.display_name}</div>
                      <div className="text-slate-500 truncate">@{inf.handle}</div>
                    </div>
                    {selectedInfluencer?.id === inf.id && <ChevronRight size={10} className="ml-auto text-gold" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-purple/20 border border-purple/30
                            flex items-center justify-center text-xs font-bold text-purple-light">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">{displayName}</div>
              {handle && <div className="text-[10px] text-slate-500 truncate">@{handle}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.filter((item) => {
          if (item.adminOnly && user.role !== "admin") return false;
          if (item.socOnly && !isSocOrAdmin) return false;
          return true;
        }).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 relative ${
                isActive
                  ? "text-gold bg-gold/10 border-l-2 border-gold pl-[10px]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-soc-border/20 border-l-2 border-transparent"
              }`
            }
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.label === "Threats Found" && (threatCount ?? 0) > 0 && (
              <span className="text-[10px] font-bold bg-threat-critical/20 text-threat-critical
                               px-1.5 py-0.5 rounded-full border border-threat-critical/30">
                {threatCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Settings */}
      <div className="px-2 pb-2 border-t border-soc-border pt-2">
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
              isActive ? "text-gold bg-gold/10" : "text-slate-500 hover:text-slate-300 hover:bg-soc-border/20"
            }`
          }
        >
          <Settings size={15} />
          <span>Settings</span>
        </NavLink>
        <button
          onClick={logout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600
                     hover:text-red-400 hover:bg-red-900/10 transition-all w-full text-left"
        >
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>

      {/* GUARDING status */}
      <div className="px-4 py-3 border-t border-soc-border bg-soc-bg/50">
        <div className="flex items-center gap-2">
          <Pulse color="green" size="sm" />
          <span className="text-[11px] font-bold text-status-live tracking-wider">GUARDING</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-slate-600 font-mono tracking-wider">SOC ACTIVE</span>
          <LiveClock />
        </div>
      </div>
    </aside>
  );
}

// ─── Hook to load current user + influencers ───────────────────────────────
export function useSidebarData() {
  const [user, setUser] = useState<User | null>(null);
  const [influencerList, setInfluencerList] = useState<InfluencerProfile[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("imprsn8_token");
    if (!token) { setUnauthenticated(true); setLoading(false); return; }

    // auth.me() is critical — validates the session and loads the user.
    // influencers.list() is supplementary — failures must not block the UI.
    auth.me()
      .then((u) => {
        setUser(u);
        influencers.list()
          .then((infs) => {
            setInfluencerList(infs);
            if ((u.role === "influencer" || u.role === "staff") && u.assigned_influencer_id) {
              const assigned = infs.find((i) => i.id === u.assigned_influencer_id);
              if (assigned) setSelectedInfluencer(assigned);
            }
          })
          .catch(() => {
            // Influencer list failed (DB error, empty table, etc.) — render with empty list
          });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem("imprsn8_token");
          setUnauthenticated(true);
        }
        // Non-401 errors (500, network): user stays null, AppShell shows retry UI
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  return { user, influencerList, selectedInfluencer, setSelectedInfluencer, loading, unauthenticated };
}
