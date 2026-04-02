import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Globe, Shield, Server, Activity, TrendingUp, Crosshair,
  Gavel, Bell, Inbox, Target,
  Cpu, Rss, LayoutDashboard, Users, ClipboardList, Building2,
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
  const { user, logout, isSuperAdmin, isBrandAdmin } = useAuth();
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

  // Brand admins see a reduced sidebar scoped to their org
  const BRAND_ADMIN_SECTIONS: NavSection[] = [
    {
      label: 'INTELLIGENCE',
      items: [
        { label: 'Dashboard',   path: '/',              icon: LayoutDashboard },
        { label: 'Brands',      path: '/brands',        icon: Shield },
        { label: 'Threats',     path: '/threats',        icon: Crosshair },
      ],
    },
    {
      label: 'RESPONSE',
      items: [
        { label: 'Takedowns',   path: '/admin/takedowns',  icon: Gavel },
        { label: 'Alerts',      path: '/alerts',           icon: Bell, badge: alertCount },
      ],
    },
    {
      label: 'SETTINGS',
      items: [
        { label: 'Organization', path: '/admin/users',  icon: Users },
      ],
    },
  ];

  // Super admins see the full platform sidebar
  const SUPER_ADMIN_SECTIONS: NavSection[] = [
    {
      label: 'INTELLIGENCE',
      items: [
        { label: 'Observatory',  path: '/observatory',  icon: Globe },
        { label: 'Brands',       path: '/brands',       icon: Shield },
        { label: 'Providers',    path: '/providers',     icon: Server },
        { label: 'Operations',   path: '/campaigns',     icon: Activity },
        { label: 'Threat Actors', path: '/threat-actors', icon: Crosshair },
        { label: 'Intelligence', path: '/trends',        icon: TrendingUp },
      ],
    },
    {
      label: 'RESPONSE',
      items: [
        { label: 'Takedowns',    path: '/admin/takedowns',  icon: Gavel },
        { label: 'Alerts',       path: '/alerts',           icon: Bell, badge: alertCount },
        { label: 'Spam Trap',    path: '/admin/spam-trap',  icon: Inbox },
        { label: 'Leads',       path: '/leads',            icon: Target },
      ],
    },
    {
      label: 'PLATFORM',
      items: [
        { label: 'Agents',       path: '/agents',           icon: Cpu },
        { label: 'Feeds',        path: '/feeds',             icon: Rss },
        { label: 'Dashboard',    path: '/admin',             icon: LayoutDashboard },
        { label: 'Organization', path: '/admin/users',       icon: Users },
        ...(isSuperAdmin ? [{ label: 'Organizations', path: '/admin/organizations', icon: Building2 }] : []),
        { label: 'Audit Log',    path: '/admin/audit',       icon: ClipboardList },
      ],
    },
  ];

  const NAV_SECTIONS = isBrandAdmin ? BRAND_ADMIN_SECTIONS : SUPER_ADMIN_SECTIONS;

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
                end={item.path === '/observatory' || item.path === '/'}
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
        {isBrandAdmin && user?.organization && (
          <div className="text-[10px] font-mono text-afterburner/70 uppercase tracking-wider mb-1">
            {user.organization.name}
          </div>
        )}
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
