import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Globe, Shield, Server, Activity, TrendingUp,
  Gavel, Bell, Inbox,
  Cpu, Rss, LayoutDashboard, Users, ClipboardList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { AverrowLogo } from '@/components/brand/AverrowLogo';

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const fetchAlerts = () => {
      fetch('/api/v1/alerts?status=open&limit=1')
        .then(r => r.json())
        .then(d => setAlertCount(d.total ?? 0))
        .catch(() => {});
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(interval);
  }, []);

  const NAV_SECTIONS: NavSection[] = [
    {
      label: 'INTELLIGENCE',
      items: [
        { label: 'Observatory',  path: '/observatory',  icon: Globe },
        { label: 'Brands',       path: '/brands',       icon: Shield },
        { label: 'Providers',    path: '/providers',     icon: Server },
        { label: 'Operations',   path: '/campaigns',     icon: Activity },
        { label: 'Intelligence', path: '/trends',        icon: TrendingUp },
      ],
    },
    {
      label: 'RESPONSE',
      items: [
        { label: 'Takedowns',    path: '/admin/takedowns',  icon: Gavel },
        { label: 'Alerts',       path: '/alerts',           icon: Bell, badge: alertCount },
        { label: 'Spam Trap',    path: '/admin/spam-trap',  icon: Inbox },
      ],
    },
    {
      label: 'PLATFORM',
      items: [
        { label: 'Agents',       path: '/agents',           icon: Cpu },
        { label: 'Feeds',        path: '/feeds',             icon: Rss },
        { label: 'Dashboard',    path: '/admin',             icon: LayoutDashboard },
        { label: 'Organization', path: '/admin/users',       icon: Users },
        { label: 'Audit Log',    path: '/admin/audit',       icon: ClipboardList },
      ],
    },
  ];

  return (
    <aside className="w-56 h-full glass-sidebar flex flex-col">
      <div className="p-4 border-b border-white/5">
        <AverrowLogo />
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={section.label} className={idx > 0 ? 'mt-2' : ''}>
            <div className="section-label px-3 pt-3 pb-1">{section.label}</div>
            {section.items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                end={item.path === '/observatory'}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'nav-item-active text-afterburner font-medium'
                    : 'text-parchment/70 hover:bg-white/5 hover:text-parchment'
                )}
              >
                <item.icon size={16} className="shrink-0 opacity-70" />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="badge-glass badge-critical ml-auto text-xs px-1.5 py-0.5">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
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
