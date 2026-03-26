import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { cn } from '@/lib/cn';

export function Shell() {
  const location = useLocation();
  const isFullScreen = location.pathname.includes('/observatory');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-cockpit">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

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
