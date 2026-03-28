import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Shell } from '@/components/layout/Shell';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Login } from '@/pages/Login';
import { Observatory } from '@/pages/Observatory';
import { Brands } from '@/pages/Brands';
import { BrandDetail } from '@/pages/BrandDetail';
import { Agents } from '@/pages/Agents';
import { Takedowns } from '@/pages/Takedowns';
import { SpamTrap } from '@/pages/SpamTrap';
import { Alerts } from '@/pages/Alerts';
import { Feeds } from '@/pages/Feeds';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { AdminUsers } from '@/pages/AdminUsers';
import { AdminAudit } from '@/pages/AdminAudit';
import { Providers } from '@/pages/Providers';
import { ProviderDetail } from '@/pages/ProviderDetail';
import { Campaigns } from '@/pages/Campaigns';
import { CampaignDetail } from '@/pages/CampaignDetail';
import { Trends } from '@/pages/Trends';
import { NotFound } from '@/pages/NotFound';
import { Profile } from '@/pages/Profile';
import { Notifications } from '@/pages/Notifications';
import { NotificationPreferences } from '@/pages/NotificationPreferences';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen bg-cockpit">
    <div className="text-contrail font-mono text-sm">Loading...</div>
  </div>;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
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
        <Route index element={<Navigate to="/observatory" replace />} />
        <Route path="observatory" element={<ErrorBoundary><Observatory /></ErrorBoundary>} />
        <Route path="brands" element={<ErrorBoundary><Brands /></ErrorBoundary>} />
        <Route path="brands/:brandId" element={<ErrorBoundary><BrandDetail /></ErrorBoundary>} />
        <Route path="providers" element={<ErrorBoundary><Providers /></ErrorBoundary>} />
        <Route path="providers/:providerId" element={<ErrorBoundary><ProviderDetail /></ErrorBoundary>} />
        <Route path="campaigns" element={<ErrorBoundary><Campaigns /></ErrorBoundary>} />
        <Route path="campaigns/:campaignId" element={<ErrorBoundary><CampaignDetail /></ErrorBoundary>} />
        <Route path="trends" element={<ErrorBoundary><Trends /></ErrorBoundary>} />
        <Route path="agents" element={<ErrorBoundary><Agents /></ErrorBoundary>} />
        <Route path="alerts" element={<ErrorBoundary><Alerts /></ErrorBoundary>} />
        <Route path="feeds" element={<ErrorBoundary><Feeds /></ErrorBoundary>} />
        <Route path="admin" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
        <Route path="admin/takedowns" element={<ErrorBoundary><Takedowns /></ErrorBoundary>} />
        <Route path="admin/spam-trap" element={<ErrorBoundary><SpamTrap /></ErrorBoundary>} />
        <Route path="admin/users" element={<ErrorBoundary><AdminUsers /></ErrorBoundary>} />
        <Route path="admin/audit" element={<ErrorBoundary><AdminAudit /></ErrorBoundary>} />
        <Route path="profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
        <Route path="notifications" element={<ErrorBoundary><Notifications /></ErrorBoundary>} />
        <Route path="notifications/preferences" element={<ErrorBoundary><NotificationPreferences /></ErrorBoundary>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
