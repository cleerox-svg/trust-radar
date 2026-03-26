import { useAuth } from '@/lib/auth';

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header className="h-12 bg-instrument border-b border-white/5 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-contrail/60 hover:text-parchment transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-mono text-xs text-contrail/40 uppercase tracking-wider">
          Threat Interceptor
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
          {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
        </div>
      </div>
    </header>
  );
}
