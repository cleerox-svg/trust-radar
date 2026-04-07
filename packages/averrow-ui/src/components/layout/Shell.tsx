import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar }        from './Sidebar';
import { TopBar }         from './TopBar';
import { MobileNav }      from '@/layouts/MobileNav';
import { DeepBackground } from '@/components/ui/DeepBackground';
import { PageTransition } from '@/components/ui/PageTransition';
import { useBreakpoint }  from '@/design-system/hooks';
import { cn }             from '@/lib/cn';

export function Shell() {
  const location      = useLocation();
  const { isMobile }  = useBreakpoint();
  const isFullScreen  = location.pathname.includes('/observatory');
  const isHome        = location.pathname === '/';

  // On mobile home: MobileCommandCenter renders full-screen with its own header
  const hideTopBar = isMobile && isHome;

  return (
    <div
      className="flex"
      style={{ minHeight: '100vh', position: 'relative', background: 'var(--bg-page)' }}
    >
      <DeepBackground />

      {!isMobile && <Sidebar />}

      <div className="flex flex-col flex-1 overflow-hidden">
        {!hideTopBar && <TopBar />}

        <main
          className={cn(
            isFullScreen
              ? 'flex-1 overflow-hidden'
              : 'flex-1 overflow-auto',
          )}
          style={{
            paddingBottom: isMobile && !isFullScreen ? 80 : undefined,
          }}
        >
          <div className={cn(
            !isFullScreen && !isMobile && 'p-4 lg:p-6',
          )}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>

      {isMobile && <MobileNav />}
    </div>
  );
}
