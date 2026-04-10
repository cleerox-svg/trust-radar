import type { JSX } from 'react';

const icons: Record<string, (size: number) => JSX.Element> = {
  sentinel: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
      <circle cx="18" cy="18" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
      <circle cx="18" cy="18" r="2.5" fill="currentColor"/>
      <line x1="18" y1="4" x2="18" y2="10" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="18" y1="26" x2="18" y2="32" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="4" y1="18" x2="10" y2="18" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="26" y1="18" x2="32" y2="18" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  analyst: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <path d="M18 6L28 18L18 30L8 18Z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="18" cy="18" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="14" y1="18" x2="8" y2="18" stroke="currentColor" strokeWidth="1"/>
      <line x1="22" y1="18" x2="28" y2="18" stroke="currentColor" strokeWidth="1"/>
      <line x1="18" y1="14" x2="18" y2="6" stroke="currentColor" strokeWidth="1"/>
      <line x1="18" y1="22" x2="18" y2="30" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),
  cartographer: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2"/>
      <circle cx="18" cy="12" r="2" fill="currentColor"/>
      <circle cx="12" cy="22" r="2" fill="currentColor"/>
      <circle cx="24" cy="20" r="2" fill="currentColor"/>
      <line x1="18" y1="12" x2="12" y2="22" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
      <line x1="18" y1="12" x2="24" y2="20" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
      <line x1="12" y1="22" x2="24" y2="20" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
    </svg>
  ),
  strategist: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <rect x="6" y="8" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="20" y="8" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="13" y="20" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="16" y1="13" x2="20" y2="13" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      <line x1="18" y1="18" x2="18" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    </svg>
  ),
  observer: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <path d="M4 18C4 18 10 8 18 8C26 8 32 18 32 18C32 18 26 28 18 28C10 28 4 18 4 18Z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="18" cy="18" r="5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="18" cy="18" r="2" fill="currentColor"/>
    </svg>
  ),
  pathfinder: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.4"/>
      <circle cx="26" cy="10" r="2" fill="currentColor" opacity="0.6"/>
      <circle cx="20" cy="24" r="3.5" fill="currentColor" opacity="0.3"/>
      <circle cx="8" cy="26" r="2" fill="currentColor" opacity="0.5"/>
      <path d="M12 12L26 10L20 24L8 26Z" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.4"/>
      <path d="M12 12L20 24" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  sparrow: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <path d="M18 4L26 18L18 32L10 18Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"/>
      <circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.4"/>
      <line x1="14" y1="24" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="14" cy="24" r="2" fill="currentColor" opacity="0.6"/>
      <path d="M20 10l4 4M24 10l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
    </svg>
  ),
  nexus: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="8" cy="26" r="3" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="28" cy="26" r="3" stroke="currentColor" strokeWidth="1.3"/>
      <line x1="18" y1="11" x2="10" y2="23.5" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
      <line x1="18" y1="11" x2="26" y2="23.5" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
      <line x1="11" y1="26" x2="25" y2="26" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
      <circle cx="18" cy="8" r="1.2" fill="currentColor"/>
      <circle cx="8" cy="26" r="1.2" fill="currentColor"/>
      <circle cx="28" cy="26" r="1.2" fill="currentColor"/>
      <circle cx="18" cy="20" r="2" fill="currentColor" opacity="0.3"/>
    </svg>
  ),
  flight_control: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <circle cx="18" cy="18" r="8" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
      <path d="M18 4V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M18 26V32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 18H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M26 18H32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 14L18 18L22 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="18" cy="18" r="2.5" fill="currentColor"/>
      <path d="M7.5 7.5L12 12" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
      <path d="M24 12L28.5 7.5" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
    </svg>
  ),
  curator: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <path d="M10 8L26 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 8V26C12 27.1 12.9 28 14 28H22C23.1 28 24 27.1 24 26V8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M15 14H21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      <path d="M15 18H21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      <path d="M15 22H19" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      <circle cx="26" cy="26" r="5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M24.5 26L25.5 27L27.5 25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  architect: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="13" stroke="currentColor" strokeWidth="1.2" opacity="0.3"/>
      <path d="M18 5V31" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <path d="M5 18H31" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <path d="M18 8L24 14L18 20L12 14Z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="18" cy="14" r="2" fill="currentColor" opacity="0.6"/>
      <path d="M14 22L18 26L22 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="18" cy="26" r="1.5" fill="currentColor"/>
    </svg>
  ),
  watchdog: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <path d="M18 6L6 14V24L18 32L30 24V14Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M18 6V32" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <circle cx="18" cy="17" r="4" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="18" cy="17" r="1.5" fill="currentColor"/>
      <path d="M14 23H22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
};

export function AgentIcon({ agent, size = 24, className }: { agent: string; size?: number; className?: string }) {
  const renderIcon = icons[agent];
  if (!renderIcon) return null;
  return <span className={className} style={{ display: 'inline-flex' }}>{renderIcon(size)}</span>;
}
