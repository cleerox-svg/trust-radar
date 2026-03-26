import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { AverrowLogo } from '@/components/brand/AverrowLogo';

const navItems = [
  { to: '/observatory', label: 'Observatory', section: 'platform' },
  { to: '/brands', label: 'Brands', section: 'platform' },
  { to: '/providers', label: 'Providers', section: 'platform' },
  { to: '/campaigns', label: 'Campaigns', section: 'platform' },
  { to: '/trends', label: 'Trends', section: 'platform' },
  { to: '/agents', label: 'Agents', section: 'platform' },
  { to: '/admin', label: 'Dashboard', section: 'admin' },
  { to: '/admin/agent-config', label: 'Agent Config', section: 'admin' },
  { to: '/admin/takedowns', label: 'Takedowns', section: 'admin' },
  { to: '/admin/spam-trap', label: 'Spam Trap', section: 'admin' },
  { to: '/admin/leads', label: 'Leads', section: 'admin' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const platformItems = navItems.filter(n => n.section === 'platform');
  const adminItems = navItems.filter(n => n.section === 'admin');

  return (
    <aside className="w-56 bg-instrument border-r border-white/5 flex flex-col">
      <div className="p-4 border-b border-white/5">
        <AverrowLogo />
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="font-mono text-[10px] text-contrail/60 uppercase tracking-widest px-3 pt-3 pb-1">Platform</div>
        {platformItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              isActive
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-parchment/70 hover:bg-white/5 hover:text-parchment'
            )}
          >
            {item.label}
          </NavLink>
        ))}
        <div className="font-mono text-[10px] text-contrail/60 uppercase tracking-widest px-3 pt-6 pb-1">Admin</div>
        {adminItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              isActive
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-parchment/70 hover:bg-white/5 hover:text-parchment'
            )}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-white/5">
        <div className="text-xs text-parchment/50 truncate">{user?.email}</div>
        <button
          onClick={logout}
          className="mt-2 text-xs text-contrail/50 hover:text-accent transition-colors font-mono"
        >
          LOGOUT
        </button>
      </div>
    </aside>
  );
}
