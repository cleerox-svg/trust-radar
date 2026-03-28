import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Building2, Key, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useIsMobile } from '@/hooks/useWindowWidth';
import { Dropdown } from './Dropdown';
import { BottomSheet } from './BottomSheet';

interface MenuItem {
  label: string;
  icon: typeof User;
  path?: string;
  onClick?: () => void;
  danger?: boolean;
}

function ProfileMenu({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? '?';

  const roleName = user?.role === 'super_admin' ? 'Super Admin'
    : user?.role === 'admin' ? 'Admin'
    : user?.role === 'analyst' ? 'Analyst'
    : 'Client';

  const menuItems: MenuItem[] = [
    { label: 'Profile & Settings', icon: User, path: '/profile' },
    { label: 'Notification Preferences', icon: Bell, path: '/notifications/preferences' },
    { label: 'Organization', icon: Building2, path: '/admin' },
    { label: 'API Keys', icon: Key, path: '/admin' },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-white/5">
        <div className="w-10 h-10 rounded-full bg-[#C83C3C] flex items-center justify-center text-sm font-bold text-white ring-1 ring-white/20 flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-parchment font-medium truncate">
            {user?.name ?? 'User'}
          </p>
          <p className="text-[11px] text-white/40 truncate">
            {user?.email}
          </p>
          <p className="text-[10px] font-mono text-contrail/50 uppercase tracking-wider mt-0.5">
            {roleName}
          </p>
        </div>
      </div>

      <div className="py-1">
        {menuItems.map(item => (
          <button
            key={item.label}
            onClick={() => item.path && handleNav(item.path)}
            className="w-full flex items-center gap-3 px-4 py-2.5 md:py-2.5 min-h-[52px] md:min-h-0 text-left hover:bg-white/5 transition-colors touch-target border-b border-white/[0.04] md:border-b-0"
          >
            <item.icon size={15} className="text-white/40 flex-shrink-0" />
            <span className="text-[14px] md:text-[12px] text-parchment/80">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-white/5 py-1">
        <button
          onClick={() => { logout(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 md:py-2.5 min-h-[52px] md:min-h-0 text-left hover:bg-[#C83C3C]/10 transition-colors touch-target"
        >
          <LogOut size={15} className="text-[#C83C3C]/70 flex-shrink-0" />
          <span className="text-[14px] md:text-[12px] text-[#C83C3C]/80">Logout</span>
        </button>
      </div>
    </div>
  );
}

export function UserAvatar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? '?';

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-[#C83C3C] flex items-center justify-center text-xs font-bold text-white ring-1 ring-white/20 hover:ring-[#00D4FF]/50 transition-all duration-150 touch-target"
        aria-label="User menu"
      >
        {initials}
      </button>

      {isMobile ? (
        <BottomSheet open={open} onClose={handleClose}>
          <ProfileMenu onClose={handleClose} />
        </BottomSheet>
      ) : (
        <Dropdown open={open} onClose={handleClose} width={260}>
          <ProfileMenu onClose={handleClose} />
        </Dropdown>
      )}
    </div>
  );
}
