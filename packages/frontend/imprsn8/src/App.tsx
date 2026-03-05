import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
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
function RequireAuth() {
  const token = localStorage.getItem("imprsn8_token");
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

// ─── Authenticated shell with sidebar ─────────────────────────────────────
function AppShell() {
  const { user, influencerList, selectedInfluencer, setSelectedInfluencer, loading } = useSidebarData();
  const [threatCount, setThreatCount] = useState(0);

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

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen bg-soc-bg overflow-hidden">
      <Sidebar
        user={user}
        influencerList={influencerList}
        selectedInfluencer={selectedInfluencer}
        onInfluencerChange={(inf: InfluencerProfile | null) => setSelectedInfluencer(inf)}
        threatCount={threatCount}
      />
      <main className="flex-1 overflow-y-auto">
        <Outlet context={{ user, selectedInfluencer, influencerList, setThreatCount }} />
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
