import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar, MobileTabBar, useSidebarData } from "./components/Sidebar";
import type { InfluencerProfile } from "./lib/types";
import { ThemeProvider } from "./lib/theme";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import { WordMark } from "./components/LogoMark";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Overview from "./pages/Overview";
import MonitoredAccounts from "./pages/MonitoredAccounts";
import ThreatsFound from "./pages/ThreatsFound";
import Takedowns from "./pages/Takedowns";
import AgentsPanel from "./pages/AgentsPanel";
import Settings from "./pages/Settings";
import AdminPage from "./pages/AdminPage";
import BrandDashboard from "./pages/Dashboard";

// ─── Auth guard ───────────────────────────────────────────────────────────
// Token must exist AND look like a valid JWT (header.payload.signature)
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

// ─── Authenticated shell with sidebar ─────────────────────────────────────
function AppShell() {
  const { user, influencerList, selectedInfluencer, setSelectedInfluencer, loading, unauthenticated } = useSidebarData();
  const [threatCount, setThreatCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-base)" }}>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden modal-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — drawer on mobile, fixed on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <Sidebar
          user={user}
          influencerList={influencerList}
          selectedInfluencer={selectedInfluencer}
          onInfluencerChange={(inf: InfluencerProfile | null) => { setSelectedInfluencer(inf); setMobileOpen(false); }}
          threatCount={threatCount}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border-default)", color: "var(--text-tertiary)" }}
          >
            <Menu size={18} />
          </button>
          <WordMark variant="shield" size={22} textSize="text-base" className="flex-1" />
          <ThemeToggle />
        </div>

        {/* Page content — pb-16 on mobile to clear bottom tab bar */}
        <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <Outlet context={{ user, selectedInfluencer, influencerList, setThreatCount }} />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <MobileTabBar threatCount={threatCount} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

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
    </ThemeProvider>
  );
}
