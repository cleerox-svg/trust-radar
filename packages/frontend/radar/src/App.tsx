import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import SignalsPage from "./pages/SignalsPage";
import AlertsPage from "./pages/AlertsPage";
import EntitiesPage from "./pages/EntitiesPage";
import TrendsPage from "./pages/TrendsPage";
import SendSignals from "./pages/SendSignals";
import GeoMapPage from "./pages/GeoMapPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import AIAdvisorPage from "./pages/AIAdvisorPage";
import Login from "./pages/Login";
import Register from "./pages/Register";

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-radar-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-radar-border bg-radar-sidebar flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-radar-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-radar-green animate-pulse-slow" />
              Connected · lrx-radar.com
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://lrx-radar.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-radar-muted border border-radar-border rounded px-3 py-1 hover:border-radar-cyan hover:text-radar-cyan transition-colors"
            >
              lrx-radar.com
            </a>
            <button
              className="btn-primary flex items-center gap-1.5 !px-3 !py-1"
              onClick={() => window.location.reload()}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/*"
          element={
            <MainLayout>
              <Routes>
                <Route path="/dashboard"     element={<Dashboard />} />
                <Route path="/signals"       element={<SignalsPage />} />
                <Route path="/alerts"        element={<AlertsPage />} />
                <Route path="/entities"      element={<EntitiesPage />} />
                <Route path="/trends"        element={<TrendsPage />} />
                <Route path="/send-signals"  element={<SendSignals />} />
                <Route path="/geo-map"        element={<GeoMapPage />} />
                <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
                <Route path="/ai-advisor"    element={<AIAdvisorPage />} />
                <Route path="*"              element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </MainLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
