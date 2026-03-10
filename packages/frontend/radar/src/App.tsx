import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, ThemeToggle } from "./components/ThemeProvider";
import { TooltipProvider } from "./components/ui/Tooltip";
import { Pulse } from "./components/ui/Pulse";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TrustBotWidget } from "./components/TrustBotWidget";
import { PlatformSwitcher } from "./components/PlatformSwitcher";
import { BottomBar } from "./components/BottomBar";
import { SectionNav } from "./components/SectionNav";
import { WordMark } from "./components/LogoMark";
import { auth, alerts, clearToken, getToken, onUnauthorized, setToken, type User } from "./lib/api";

// ─── Lazy-loaded pages (code splitting) ───────────────────────
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SignalsPage = lazy(() => import("./pages/SignalsPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const EntitiesPage = lazy(() => import("./pages/EntitiesPage"));
const TrendsPage = lazy(() => import("./pages/TrendsPage"));
const SendSignals = lazy(() => import("./pages/SendSignals"));
const GeoMapPage = lazy(() => import("./pages/GeoMapPage"));
const KnowledgeBasePage = lazy(() => import("./pages/KnowledgeBasePage"));
const AIAdvisorPage = lazy(() => import("./pages/AIAdvisorPage"));
const Home = lazy(() => import("./pages/Home"));
const History = lazy(() => import("./pages/History"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const FeedAnalyticsPage = lazy(() => import("./pages/FeedAnalyticsPage").then(m => ({ default: m.FeedAnalyticsPage })));
const AgentHubPage = lazy(() => import("./pages/AgentHubPage").then(m => ({ default: m.AgentHubPage })));
const TrustBotPage = lazy(() => import("./pages/TrustBotPage").then(m => ({ default: m.TrustBotPage })));
const ThreatMapPage = lazy(() => import("./pages/ThreatMapPage").then(m => ({ default: m.ThreatMapPage })));
const BrandExposurePage = lazy(() => import("./pages/BrandExposurePage").then(m => ({ default: m.BrandExposurePage })));
const DailyBriefingPage = lazy(() => import("./pages/DailyBriefingPage").then(m => ({ default: m.DailyBriefingPage })));
const InvestigationsPage = lazy(() => import("./pages/InvestigationsPage").then(m => ({ default: m.InvestigationsPage })));
const TakedownsPage = lazy(() => import("./pages/TakedownsPage").then(m => ({ default: m.TakedownsPage })));
const SocialIntelPage = lazy(() => import("./pages/SocialIntelPage").then(m => ({ default: m.SocialIntelPage })));
const DarkWebPage = lazy(() => import("./pages/DarkWebPage").then(m => ({ default: m.DarkWebPage })));
const ATOPage = lazy(() => import("./pages/ATOPage").then(m => ({ default: m.ATOPage })));
const EmailAuthPage = lazy(() => import("./pages/EmailAuthPage").then(m => ({ default: m.EmailAuthPage })));
const CloudStatusPage = lazy(() => import("./pages/CloudStatusPage").then(m => ({ default: m.CloudStatusPage })));
const LandingPage = lazy(() => import("./pages/LandingPage"));

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

// ─── Main layout with bottom bar + section sub-tabs ──────────
function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--surface-base)" }}>
      {/* Skip to content — a11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded focus:bg-cyan-500 focus:text-white focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* Top bar — compact, no sidebar needed */}
      <header
        className="h-12 flex items-center justify-between px-4 shrink-0 sticky top-0 z-10"
        style={{ background: "var(--surface-void)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          {/* Brand wordmark — links to public landing page */}
          <Link to="/" className="transition-opacity hover:opacity-80">
            <WordMark size={22} textSize="text-sm" className="hidden sm:inline-flex" />
            <WordMark size={22} textSize="text-sm" hideIcon={false} className="sm:hidden" />
          </Link>
          {/* Platform switcher */}
          <div className="hidden sm:block">
            <PlatformSwitcher />
          </div>
          <span className="hidden md:flex items-center gap-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <Pulse color="green" size="sm" />
            <span className="font-mono text-[10px]">live</span>
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
            onClick={logout}
            className="text-xs border border-[--border-default] text-[--text-secondary] rounded px-2.5 py-1 hover:border-threat-critical hover:text-threat-critical transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Section sub-tabs — contextual per active bottom bar section */}
      <SectionNav />

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-auto p-4 sm:p-6 pb-20" role="main">
        {children}
      </main>

      {/* Bottom navigation bar */}
      <BottomBar />

      {/* Floating TrustBot widget */}
      <TrustBotWidget />
    </div>
  );
}

// ─── Page suspense fallback ──────────────────────────────────
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                {/* Public routes */}
                <Route path="/"         element={<LandingPage />} />
                <Route path="/login"    element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected routes — wrapped in MainLayout */}
                <Route
                  path="/*"
                  element={
                    <RequireAuth>
                      <MainLayout>
                        <Suspense fallback={<PageFallback />}>
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
                        </Suspense>
                      </MainLayout>
                    </RequireAuth>
                  }
                />
              </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
