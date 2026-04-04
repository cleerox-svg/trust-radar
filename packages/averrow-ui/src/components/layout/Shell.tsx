import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { DeepBackground } from '@/components/ui/DeepBackground';
import { cn } from '@/lib/cn';

export function Shell() {
  const location = useLocation();
  const isFullScreen = location.pathname.includes('/observatory') || location.pathname === '/';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-cockpit">
      <DeepBackground />
      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm lg:hidden"
            style={{ zIndex: 'var(--z-sidebar-overlay)' }}
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="fixed left-0 top-0 bottom-0 w-72 bg-[#040912] border-r border-white/10 transform transition-transform duration-200 lg:hidden"
            style={{ zIndex: 'var(--z-sidebar)' }}
          >
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className={cn(
          isFullScreen ? 'flex-1 overflow-hidden' : 'flex-1 overflow-auto p-4 lg:p-6'
        )}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
