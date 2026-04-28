import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar }        from './Sidebar';
import { TopBar }         from './TopBar';
import { MobileNav }      from '@/layouts/MobileNav';
import { DeepBackground } from '@/components/ui/DeepBackground';
import { PageTransition } from '@/components/ui/PageTransition';
import { useBreakpoint }  from '@/design-system/hooks';
import { FirstSignInPasskeyPrompt } from '@/components/FirstSignInPasskeyPrompt';

export function Shell() {
  const location     = useLocation();
  const { isMobile } = useBreakpoint();
  const isFullScreen = location.pathname.includes('/observatory');
  const isHome       = location.pathname === '/';
  const hideTopBar   = isMobile && isHome;

  return (
    <div
      className="flex"
      style={{
        height:   '100dvh',   // dvh = dynamic viewport height (handles mobile browser chrome)
        overflow: 'hidden',   // contain the layout
        background: 'var(--bg-page)',
        position: 'relative',
      }}
    >
      <DeepBackground />

      {!isMobile && <Sidebar />}

      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', minWidth:0 }}>
        {!hideTopBar && <TopBar />}

        <main
          style={{
            flex:       1,
            overflowY:  isFullScreen ? 'hidden' : 'auto',
            overflowX:  'hidden',
            paddingBottom: isMobile && !isFullScreen ? 80 : 0,
            // Enable momentum scrolling on iOS
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div style={{
            padding: (!isFullScreen && !isMobile) ? '16px 24px' : undefined,
            // Mobile: pages handle their own padding
          }}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>

      {isMobile && <MobileNav />}

      {/* Auto-prompts biometric setup on first login when the user has
          zero passkeys + WebAuthn is supported. Self-gates internally
          (localStorage flag + passkey_count check) so it can sit at
          the Shell root without any per-route logic. */}
      <FirstSignInPasskeyPrompt />
    </div>
  );
}
