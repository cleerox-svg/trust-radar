import { createContext, useContext, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, ThemeToggle } from "./components/ThemeProvider";
import { TooltipProvider } from "./components/ui/Tooltip";
import { Pulse } from "./components/ui/Pulse";
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
import Home from "./pages/Home";
import History from "./pages/History";
import AdminPage from "./pages/AdminPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { FeedAnalyticsPage } from "./pages/FeedAnalyticsPage";
import { AgentHubPage } from "./pages/AgentHubPage";
import { TrustBotPage } from "./pages/TrustBotPage";
import {
  ThreatMapPage,
  BrandExposurePage,
  DailyBriefingPage,
  InvestigationsPage,
  TakedownsPage,
  SocialIntelPage,
  DarkWebPage,
  ATOPage,
  EmailAuthPage,
  CloudStatusPage,
} from "./pages/PlaceholderPage";
import { auth, alerts, clearToken, getToken, onUnauthorized, setToken, type User } from "./lib/api";

// ─── Query Client ─────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

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

  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      stopAlertPolling();
      navigate("/login");
    });
  }, [navigate]);

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

// ─── Loading Spinner ──────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-base)" }}>
      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Protected route ───────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ─── Main layout with responsive sidebar ──────────────────────
function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface-base)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden modal-backdrop"
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
        <header
          className="h-12 flex items-center justify-between px-4 shrink-0 sticky top-0 z-10"
          style={{ background: "var(--surface-void)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-1.5 rounded text-[--text-tertiary] hover:text-[--text-primary] transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Desktop status */}
            <span className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
              <Pulse color="green" size="sm" />
              <span className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Trust Intelligence Platform</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-[--text-secondary] border-r border-[--border-subtle] pr-3 mr-1">
                <span className="font-mono truncate max-w-[140px]">{user.email}</span>
                <span className="bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded font-mono text-[11px]">{user.plan}</span>
              </div>
            )}
            <ThemeToggle />
            <button
              onClick={() => window.location.reload()}
              className="btn-icon p-1.5"
              aria-label="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={logout}
              className="text-xs border border-[--border-default] text-[--text-secondary] rounded px-2.5 py-1 hover:border-threat-critical hover:text-threat-critical transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
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
                          {/* Mission Control */}
                          <Route path="/dashboard"      element={<Dashboard />} />
                          <Route path="/threat-map"     element={<ThreatMapPage />} />
                          <Route path="/brand-exposure" element={<BrandExposurePage />} />
                          <Route path="/alerts"         element={<AlertsPage />} />
                          <Route path="/briefing"       element={<DailyBriefingPage />} />

                          {/* Investigate */}
                          <Route path="/scan"           element={<Home />} />
                          <Route path="/history"        element={<History />} />
                          <Route path="/signals"        element={<SignalsPage />} />
                          <Route path="/investigations" element={<InvestigationsPage />} />
                          <Route path="/takedowns"      element={<TakedownsPage />} />
                          <Route path="/entities"       element={<EntitiesPage />} />

                          {/* Agents & Automation */}
                          <Route path="/agent-hub"      element={<AgentHubPage />} />
                          <Route path="/trustbot"       element={<TrustBotPage />} />

                          {/* Intelligence Feeds */}
                          <Route path="/feed-analytics" element={<FeedAnalyticsPage />} />
                          <Route path="/social-intel"   element={<SocialIntelPage />} />
                          <Route path="/dark-web"       element={<DarkWebPage />} />
                          <Route path="/ato"            element={<ATOPage />} />
                          <Route path="/email-auth"     element={<EmailAuthPage />} />
                          <Route path="/cloud-status"   element={<CloudStatusPage />} />

                          {/* Platform */}
                          <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
                          <Route path="/ai-advisor"     element={<AIAdvisorPage />} />
                          <Route path="/send-signals"   element={<SendSignals />} />

                          {/* Legacy routes */}
                          <Route path="/trends"         element={<TrendsPage />} />
                          <Route path="/geo-map"        element={<GeoMapPage />} />

                          {/* Admin */}
                          <Route path="/admin"          element={<RequireAdmin><AdminPage /></RequireAdmin>} />

                          <Route path="*"               element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                      </MainLayout>
                    </RequireAuth>
                  }
                />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
