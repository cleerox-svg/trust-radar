import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function Shell() {
  const location = useLocation();
  const isFullScreen = location.pathname.includes('/observatory');

  return (
    <div className="flex h-screen bg-cockpit">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className={isFullScreen ? 'flex-1 overflow-hidden' : 'flex-1 overflow-auto p-6'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
