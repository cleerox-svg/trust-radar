// Averrow — MobileNav
// Fixed bottom navigation for mobile. Rendered by Shell on mobile viewports.
// Active state driven by useLocation() — always accurate on every page.

import { useNavigate, useLocation } from 'react-router-dom';
import { useUnreadCount } from '@/hooks/useNotifications';

const AMBER   = '#E5A832';
const RED     = '#C83C3C';
const RED_DIM = '#8B1A1A';

interface NavItem {
  id:    string;
  icon:  string;
  label: string;
  path:  string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home',   icon: '🏠', label: 'Home',   path: '/',          exact: true },
  { id: 'obs',    icon: '🌐', label: 'Map',    path: '/observatory' },
  { id: 'brands', icon: '🛡', label: 'Brands', path: '/brands' },
  { id: 'alerts', icon: '🔔', label: 'Alerts', path: '/alerts' },
  { id: 'more',   icon: '☰',  label: 'More',   path: '/agents' },
];

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = typeof unreadData === 'number'
    ? unreadData
    : (unreadData as any)?.count ?? 0;

  function isActive(item: NavItem): boolean {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  }

  return (
    <div style={{
      position:             'fixed',
      bottom:               0,
      left:                 0,
      right:                0,
      zIndex:               'var(--z-sidebar)' as any,
      background:           'rgba(4,7,16,0.94)',
      backdropFilter:       'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderTop:            '1px solid rgba(255,255,255,0.08)',
      boxShadow:            '0 -8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)',
      paddingBottom:        'env(safe-area-inset-bottom, 0px)',
      display:              'flex',
      justifyContent:       'space-around',
      alignItems:           'center',
      padding:              '10px 0',
    }}>
      {NAV_ITEMS.map(item => {
        const active = isActive(item);
        const showBadge = item.id === 'alerts' && unreadCount > 0;

        return (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            3,
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              position:       'relative',
              padding:        '4px 14px',
              outline:        'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {showBadge && (
              <div style={{
                position:     'absolute',
                top:          0,
                right:        6,
                minWidth:     16,
                height:       16,
                borderRadius: '50%',
                background:   `linear-gradient(135deg, ${RED}, ${RED_DIM})`,
                border:       '2px solid rgba(4,7,16,0.9)',
                fontSize:     8,
                fontWeight:   900,
                color:        '#fff',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                fontFamily:   'monospace',
                boxShadow:    `0 2px 8px ${RED}60`,
                padding:      '0 2px',
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}

            <span style={{
              fontSize: 22,
              filter:   active ? `drop-shadow(0 0 6px ${AMBER}80)` : 'none',
              transition: 'filter 0.15s ease',
            }}>
              {item.icon}
            </span>

            <span style={{
              fontSize:      9,
              fontFamily:    'monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color:         active ? AMBER : 'rgba(255,255,255,0.30)',
              textShadow:    active ? `0 0 10px ${AMBER}60` : 'none',
              transition:    'color 0.15s ease',
            }}>
              {item.label}
            </span>

            {active && (
              <div style={{
                position:     'absolute',
                bottom:       0,
                left:         '50%',
                transform:    'translateX(-50%)',
                width:        24,
                height:       2,
                borderRadius: 99,
                background:   `linear-gradient(90deg, transparent, ${AMBER}, transparent)`,
                boxShadow:    `0 0 8px ${AMBER}`,
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
