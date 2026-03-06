import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar, useSidebarData } from "./components/Sidebar";
import type { InfluencerProfile } from "./lib/types";

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
      <div className="flex items-center justify-center h-screen bg-soc-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <div className="text-xs text-slate-600 font-mono tracking-widest">LOADING SOC...</div>
        </div>
      </div>
    );
  }

  if (unauthenticated || !user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen bg-soc-bg overflow-hidden">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
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
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-soc-border bg-soc-card shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg border border-soc-border text-slate-400 hover:text-gold hover:border-gold/50 transition-all"
          >
            <Menu size={18} />
          </button>
          <div className="text-base font-extrabold tracking-tight text-slate-100">
            imprsn<span className="text-gold">8</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Outlet context={{ user, selectedInfluencer, influencerList, setThreatCount }} />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
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
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
