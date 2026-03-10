import { useState, lazy, Suspense, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useSidebarData } from "./components/Sidebar";
import { ThemeProvider } from "./lib/theme";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import { WordMark } from "./components/LogoMark";
import { PlatformSwitcher } from "./components/PlatformSwitcher";
import { BottomBar } from "./components/BottomBar";
import { SectionNav } from "./components/SectionNav";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { ToastProvider } from "./components/ui/Toast";
import { IdleTimeoutDialog } from "./components/IdleTimeoutDialog";

// ─── Lazy-loaded pages (code splitting) ──────────────────────────────────
const Home              = lazy(() => import("./pages/Home"));
const Login             = lazy(() => import("./pages/Login"));
const Register          = lazy(() => import("./pages/Register"));
const Overview          = lazy(() => import("./pages/Overview"));
const MonitoredAccounts = lazy(() => import("./pages/MonitoredAccounts"));
const ThreatsFound      = lazy(() => import("./pages/ThreatsFound"));
const Takedowns         = lazy(() => import("./pages/Takedowns"));
const AgentsPanel       = lazy(() => import("./pages/AgentsPanel"));
const Settings          = lazy(() => import("./pages/Settings"));
const AdminPage         = lazy(() => import("./pages/AdminPage"));
const BrandDashboard    = lazy(() => import("./pages/Dashboard"));

// ─── Suspense fallback ────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-2">
        <div
          className="w-6 h-6 rounded-full animate-spin"
          style={{ border: "2px solid var(--border-default)", borderTopColor: "var(--gold-400)" }}
        />
        <span className="text-[10px] font-mono tracking-widest" style={{ color: "var(--text-tertiary)" }}>
          LOADING...
        </span>
      </div>
    </div>
  );
}

// ─── Auth guard ───────────────────────────────────────────────────────────
function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

function RequireAuth() {
  const token = localStorage.getItem("imprsn8_token");
  if (!isTokenValid(token)) {
    localStorage.removeItem("imprsn8_token");
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

// ─── Authenticated shell with bottom bar ─────────────────────────────────
function AppShell() {
  const { user, influencerList, selectedInfluencer, setSelectedInfluencer, loading, unauthenticated } = useSidebarData();
  const [threatCount, setThreatCount] = useState(0);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const navigate = useNavigate();

  const handleIdleLogout = useCallback(() => {
    localStorage.removeItem("imprsn8_token");
    navigate("/login", { replace: true });
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--surface-base)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full animate-spin"
            style={{ border: "2px solid var(--border-default)", borderTopColor: "var(--gold-400)" }} />
          <div className="text-xs font-mono tracking-widest" style={{ color: "var(--text-tertiary)" }}>
            LOADING...
          </div>
        </div>
      </div>
    );
  }

  if (unauthenticated || !user) return <Navigate to="/login" replace />;

  const isSocOrAdmin = user.role === "soc" || user.role === "admin";
  const displayName = selectedInfluencer?.display_name ?? user.display_name ?? user.email?.split("@")[0] ?? "User";
  const avatarUrl = selectedInfluencer?.avatar_url ?? null;
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--surface-base)" }}>
      {/* Idle timeout dialog */}
      <IdleTimeoutDialog onLogout={handleIdleLogout} />

      {/* Top bar */}
      <header
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <WordMark variant="shield" size={22} textSize="text-base" />
          <div className="hidden sm:block">
            <PlatformSwitcher />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Influencer switcher for SOC/Admin */}
          {isSocOrAdmin && influencerList.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen((o) => !o)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  background: "var(--surface-overlay)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)",
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: "rgba(109,64,237,0.2)", color: "var(--violet-300)" }}
                  >
                    {initial}
                  </div>
                )}
                <span className="hidden sm:inline truncate max-w-[100px] font-medium">{displayName}</span>
                <ChevronDown size={10} style={{ opacity: 0.5 }} />
              </button>

              {switcherOpen && (
                <div
                  className="absolute top-full right-0 mt-1 z-50 rounded-lg shadow-2xl overflow-hidden min-w-[180px]"
                  style={{ background: "var(--surface-overlay)", border: "1px solid var(--border-default)" }}
                >
                  <button
                    onClick={() => { setSelectedInfluencer(null); setSwitcherOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-float)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    All influencers
                  </button>
                  <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
                  {influencerList.map((inf) => {
                    const isSelected = selectedInfluencer?.id === inf.id;
                    return (
                      <button
                        key={inf.id}
                        onClick={() => { setSelectedInfluencer(inf); setSwitcherOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                        style={{
                          color: isSelected ? "var(--gold-400)" : "var(--text-secondary)",
                          background: isSelected ? "rgba(240,165,0,0.06)" : "",
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--surface-float)"; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = ""; }}
                      >
                        {inf.avatar_url ? (
                          <img src={inf.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                            style={{ background: "rgba(109,64,237,0.2)", color: "var(--violet-300)" }}>
                            {inf.display_name[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{inf.display_name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <ThemeToggle />

          {/* Guarding indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: "rgba(22,163,74,0.06)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold tracking-wider" style={{ color: "#16A34A" }}>GUARDING</span>
          </div>
        </div>
      </header>

      {/* Section sub-tabs */}
      <SectionNav user={user} />

      {/* Page content with error boundary */}
      <div className="flex-1 overflow-y-auto pb-16">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet context={{ user, selectedInfluencer, influencerList, setThreatCount }} />
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Bottom navigation bar */}
      <BottomBar user={user} threatCount={threatCount} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Suspense fallback={<PageLoader />}><ErrorBoundary><Home /></ErrorBoundary></Suspense>} />
        <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
        <Route path="/register" element={<Suspense fallback={<PageLoader />}><Register /></Suspense>} />

        {/* Protected shell */}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard"  element={<Overview />} />
            <Route path="/accounts"   element={<MonitoredAccounts />} />
            <Route path="/threats"    element={<ThreatsFound />} />
            <Route path="/takedowns"  element={<Takedowns />} />
            <Route path="/agents"     element={<AgentsPanel />} />
            <Route path="/settings"   element={<Settings />} />
            <Route path="/admin"      element={<AdminPage />} />
            <Route path="/brand"      element={<BrandDashboard />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
    </ThemeProvider>
  );
}
