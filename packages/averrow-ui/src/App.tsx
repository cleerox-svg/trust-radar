import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Shell } from '@/components/layout/Shell';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Login } from '@/pages/Login';
import { Brands } from '@/pages/Brands';
import { BrandDetail } from '@/pages/BrandDetail';
import { Agents } from '@/pages/Agents';
import { Takedowns } from '@/pages/Takedowns';
import { SpamTrap } from '@/pages/SpamTrap';
import { Alerts } from '@/pages/Alerts';
import { Feeds } from '@/pages/Feeds';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { Organization } from '@/pages/Organization';
import { SuperAdminOrgs } from '@/pages/SuperAdminOrgs';
import { AdminAudit } from '@/pages/AdminAudit';
import { Providers } from '@/pages/Providers';
import { ProviderDetail } from '@/pages/ProviderDetail';
import { Campaigns } from '@/pages/Campaigns';
import { CampaignDetail } from '@/pages/CampaignDetail';
import { GeopoliticalCampaignDashboard } from '@/pages/GeopoliticalCampaignDashboard';
import { Trends } from '@/pages/Trends';
import { ThreatActors } from '@/pages/ThreatActors';
import { ThreatActorDetail } from '@/pages/ThreatActorDetail';
import { Leads } from '@/pages/Leads';
import { NotFound } from '@/pages/NotFound';
import { Home } from '@/pages/Home';
import { BrandAdminDashboard } from '@/pages/BrandAdminDashboard';
import { Threats } from '@/pages/Threats';
import { Profile } from '@/pages/Profile';
import { Notifications } from '@/pages/Notifications';
import { NotificationPreferences } from '@/pages/NotificationPreferences';

// Lazy-load Observatory to prevent deck.gl/WebGL from initializing on all pages
const Observatory = React.lazy(() => import('@/pages/Observatory').then(m => ({ default: m.Observatory })));

function ObservatoryLoader() {
  return (
    <div className="flex items-center justify-center h-full bg-cockpit">
      <div className="text-contrail font-mono text-sm">Loading Observatory...</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen bg-cockpit">
    <div className="text-contrail font-mono text-sm">Loading...</div>
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
