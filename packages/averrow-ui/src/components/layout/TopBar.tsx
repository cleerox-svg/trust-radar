import { NotificationBell } from '@/components/NotificationBell';
import { UserAvatar } from '@/components/UserAvatar';

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="flex items-center justify-between h-14 px-4 md:px-6 border-b border-white/8 bg-[#040912]/95 backdrop-blur-md sticky top-0" style={{ zIndex: 'var(--z-sidebar-overlay)' }}>
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden glass-btn p-2 rounded-lg touch-target"
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/70" />
          </svg>
        </button>
        <span className="hidden sm:block text-xs font-mono font-bold tracking-[0.2em] text-white/40 uppercase">
          Threat Interceptor
        </span>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserAvatar />
      </div>
    </header>
  );
}
