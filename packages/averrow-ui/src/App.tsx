import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Shell } from '@/components/layout/Shell';
import { Login } from '@/pages/Login';
import { Observatory } from '@/pages/Observatory';
import { Brands } from '@/pages/Brands';
import { Agents } from '@/pages/Agents';
import { AgentConfig } from '@/pages/AgentConfig';
import { Takedowns } from '@/pages/Takedowns';
import { SpamTrap } from '@/pages/SpamTrap';
import { Leads } from '@/pages/Leads';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { NotFound } from '@/pages/NotFound';

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
        <Route path="observatory" element={<Observatory />} />
        <Route path="brands" element={<Brands />} />
        <Route path="agents" element={<Agents />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/agent-config" element={<AgentConfig />} />
        <Route path="admin/takedowns" element={<Takedowns />} />
        <Route path="admin/spam-trap" element={<SpamTrap />} />
        <Route path="admin/leads" element={<Leads />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
