import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Shell } from '@/components/layout/Shell';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Login } from '@/pages/Login';
import { Brands } from '@/features/brands/Brands';
import { BrandDetail } from '@/features/brands/BrandDetail';
import { Agents } from '@/features/agents/Agents';
import { Takedowns } from '@/features/takedowns/Takedowns';
import { SpamTrap } from '@/features/spam-trap/SpamTrap';
import { Alerts } from '@/features/alerts/Alerts';
import { Feeds } from '@/features/feeds/Feeds';
import { AdminDashboard } from '@/features/admin/AdminDashboard';
import { Organization } from '@/features/settings/Organization';
import { SuperAdminOrgs } from '@/features/admin/SuperAdminOrgs';
import { AdminAudit } from '@/features/admin/AdminAudit';
import { ArchitectDetail } from '@/features/agents/ArchitectDetail';
import { Providers } from '@/features/providers/Providers';
import { ProviderDetail } from '@/features/providers/ProviderDetail';
import { Campaigns } from '@/features/campaigns/Campaigns';
import { CampaignDetail } from '@/features/campaigns/CampaignDetail';
import { GeopoliticalCampaignDashboard } from '@/features/campaigns/GeopoliticalCampaignDashboard';
import { Trends } from '@/features/trends/Trends';
import { ThreatActors } from '@/features/threat-actors/ThreatActors';
import { ThreatActorDetail } from '@/features/threat-actors/ThreatActorDetail';
import { Leads } from '@/features/leads/Leads';
import { NotFound } from '@/pages/NotFound';
import { Home } from '@/pages/Home';
import { BrandAdminDashboard } from '@/features/admin/BrandAdminDashboard';
import { Threats } from '@/features/threats/Threats';
import { Profile } from '@/features/settings/Profile';
import { Notifications } from '@/features/settings/Notifications';
import { NotificationPreferences } from '@/features/settings/NotificationPreferences';

// Lazy-load Observatory to prevent deck.gl/WebGL from initializing on all pages
const Observatory = React.lazy(() => import('@/features/observatory/Observatory').then(m => ({ default: m.Observatory })));

function ObservatoryLoader() {
  return (
    <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg-page)' }}>
      <div className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Observatory...</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-page)' }}>
    <div className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
  </div>;

  if (!isAuthenticated) {
    // Redirect to public homepage — don't trap users in an in-app login screen.
    // The public site has the proper "Sign In" flow via /login → /api/auth/login.
    window.location.href = '/';
    return null;
  }
  return <>{children}</>;
}

/**
 * Role-aware home route.
 * Brand admins land on their scoped dashboard.
 * Super admins land on Observatory (desktop) or Mobile Command Center (mobile).
 */
function RoleAwareHome() {
  const { isBrandAdmin } = useAuth();
  if (isBrandAdmin) {
    return <BrandAdminDashboard />;
  }
  return <Home />;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <Login />
      } />
      <Route path="/" element={
        <ProtectedRoute>
          <Shell />
        </ProtectedRoute>
      }>
        <Route index element={<ErrorBoundary><RoleAwareHome /></ErrorBoundary>} />
        <Route path="observatory" element={<ErrorBoundary><Suspense fallback={<ObservatoryLoader />}><Observatory /></Suspense></ErrorBoundary>} />
        <Route path="brands" element={<ErrorBoundary><Brands /></ErrorBoundary>} />
        <Route path="brands/:brandId" element={<ErrorBoundary><BrandDetail /></ErrorBoundary>} />
        <Route path="threats" element={<ErrorBoundary><Threats /></ErrorBoundary>} />
        <Route path="providers" element={<ErrorBoundary><Providers /></ErrorBoundary>} />
        <Route path="providers/:providerId" element={<ErrorBoundary><ProviderDetail /></ErrorBoundary>} />
        <Route path="campaigns" element={<ErrorBoundary><Campaigns /></ErrorBoundary>} />
        <Route path="campaigns/geo/:slug" element={<ErrorBoundary><GeopoliticalCampaignDashboard /></ErrorBoundary>} />
        <Route path="campaigns/:campaignId" element={<ErrorBoundary><CampaignDetail /></ErrorBoundary>} />
        <Route path="threat-actors" element={<ErrorBoundary><ThreatActors /></ErrorBoundary>} />
        <Route path="threat-actors/:actorId" element={<ErrorBoundary><ThreatActorDetail /></ErrorBoundary>} />
        <Route path="trends" element={<ErrorBoundary><Trends /></ErrorBoundary>} />
        <Route path="agents" element={<ErrorBoundary><Agents /></ErrorBoundary>} />
        <Route path="agents/architect" element={<ErrorBoundary><ArchitectDetail /></ErrorBoundary>} />
        <Route path="alerts" element={<ErrorBoundary><Alerts /></ErrorBoundary>} />
        <Route path="leads" element={<ErrorBoundary><Leads /></ErrorBoundary>} />
        <Route path="feeds" element={<ErrorBoundary><Feeds /></ErrorBoundary>} />
        <Route path="admin" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
        <Route path="admin/takedowns" element={<ErrorBoundary><Takedowns /></ErrorBoundary>} />
        <Route path="admin/spam-trap" element={<ErrorBoundary><SpamTrap /></ErrorBoundary>} />
        <Route path="admin/users" element={<ErrorBoundary><Organization /></ErrorBoundary>} />
        <Route path="admin/organizations" element={<ErrorBoundary><SuperAdminOrgs /></ErrorBoundary>} />
        <Route path="admin/audit" element={<ErrorBoundary><AdminAudit /></ErrorBoundary>} />
        <Route path="profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
        <Route path="notifications" element={<ErrorBoundary><Notifications /></ErrorBoundary>} />
        <Route path="notifications/preferences" element={<ErrorBoundary><NotificationPreferences /></ErrorBoundary>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
