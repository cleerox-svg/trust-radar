import { useAuth } from '@/lib/auth';

export function TopBar() {
  const { user } = useAuth();

  return (
    <header className="h-12 bg-instrument border-b border-white/5 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
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
