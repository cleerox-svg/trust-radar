import { createContext, useContext, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
import { auth, alerts, clearToken, getToken, onUnauthorized, setToken, type User } from "./lib/api";

// ─── Auth Context ──────────────────────────────────────────────
interface AuthCtx {
  user: User | null;
  alertCount: number;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAlerts: () => void;
}

export const AuthContext = createContext<AuthCtx>({
  user: null, alertCount: 0, authLoading: true,
  login: async () => {}, register: async () => {}, logout: () => {}, refreshAlerts: () => {},
});
export const useAuth = () => useContext(AuthContext);

// ─── Auth Provider (needs router for navigate) ─────────────────
function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const alertInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAlerts = () => {
    alerts.list().then((list) => setAlertCount(list.filter((a) => a.status === "open").length)).catch(() => {});
  };

  const startAlertPolling = () => {
    fetchAlerts();
    alertInterval.current = setInterval(fetchAlerts, 30_000);
  };

  const stopAlertPolling = () => {
    if (alertInterval.current) clearInterval(alertInterval.current);
  };

  // Register 401 handler
  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      stopAlertPolling();
      navigate("/login");
    });
  }, [navigate]);

  // Bootstrap from stored token
  useEffect(() => {
    if (!getToken()) { setAuthLoading(false); return; }
    auth.me()
      .then((u) => { setUser(u); startAlertPolling(); })
      .catch(() => { clearToken(); })
      .finally(() => setAuthLoading(false));
    return stopAlertPolling;
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user: u } = await auth.login(email, password);
    setToken(token);
    setUser(u);
    startAlertPolling();
    navigate("/dashboard");
  };

  const register = async (email: string, password: string) => {
    const { token, user: u } = await auth.register(email, password);
    setToken(token);
    setUser(u);
    startAlertPolling();
    navigate("/dashboard");
  };

  const logout = () => {
    clearToken();
    setUser(null);
    stopAlertPolling();
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, alertCount, authLoading, login, register, logout, refreshAlerts: fetchAlerts }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Protected route ───────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-radar-bg">
      <div className="w-6 h-6 border-2 border-radar-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ─── Main layout with responsive sidebar ──────────────────────
function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-radar-bg">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static on desktop */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-30
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-radar-border bg-radar-sidebar flex items-center justify-between px-4 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-1.5 rounded text-radar-muted hover:text-radar-text transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Desktop status */}
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-radar-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-radar-green animate-pulse-slow" />
              Connected · lrxradar.com
            </span>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-radar-muted border-r border-radar-border pr-2 mr-1">
                <span className="font-mono truncate max-w-[140px]">{user.email}</span>
                <span className="bg-radar-cyan/15 text-radar-cyan px-1.5 py-0.5 rounded font-mono">{user.plan}</span>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="p-1.5 rounded text-radar-muted hover:text-radar-text transition-colors"
              aria-label="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={logout}
              className="text-xs border border-radar-border text-radar-muted rounded px-2.5 py-1 hover:border-radar-red hover:text-radar-red transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <MainLayout>
                  <Routes>
                    <Route path="/dashboard"      element={<Dashboard />} />
                    <Route path="/signals"        element={<SignalsPage />} />
                    <Route path="/alerts"         element={<AlertsPage />} />
                    <Route path="/entities"       element={<EntitiesPage />} />
                    <Route path="/trends"         element={<TrendsPage />} />
                    <Route path="/send-signals"   element={<SendSignals />} />
                    <Route path="/geo-map"        element={<GeoMapPage />} />
                    <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
                    <Route path="/ai-advisor"     element={<AIAdvisorPage />} />
                    <Route path="*"               element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </MainLayout>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
