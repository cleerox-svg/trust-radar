import { useAuth } from '@/lib/auth';

export function TopBar() {
  const { user } = useAuth();
  const orgName = user?.organization?.name ?? 'Your Organization';
  const initials = (user?.display_name ?? user?.name ?? user?.email ?? '?')
    .trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-white/[0.05] bg-bg-page/80 backdrop-blur">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-white/40">Organization</div>
        <div className="text-sm font-semibold text-white/90">{orgName}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono text-white/40 hidden md:inline">{user?.email}</span>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold bg-amber text-black">
          {initials || '?'}
        </div>
      </div>
    </header>
  );
}
