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
  navigator: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      {/* compass housing */}
      <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="18" cy="18" r="10" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
      {/* cardinal tick marks (N/E/S/W) */}
      <line x1="18" y1="4" x2="18" y2="7" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="18" y1="29" x2="18" y2="32" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="4" y1="18" x2="7" y2="18" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="29" y1="18" x2="32" y2="18" stroke="currentColor" strokeWidth="1.2"/>
      {/* compass needle — solid north, faded south */}
      <path d="M18 8L21 18L18 28L15 18Z" fill="currentColor" fillOpacity="0.85"/>
      <path d="M18 8L15 18L18 18Z" fill="currentColor" fillOpacity="0.35"/>
      {/* center pivot */}
      <circle cx="18" cy="18" r="1.6" fill="currentColor"/>
    </svg>
  ),
  // Marshal — App Store Monitor. Sheriff/marshal star badge: catches imposter apps.
  app_store_monitor: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      {/* badge ring */}
      <circle cx="18" cy="18" r="13" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="18" cy="18" r="9.5" stroke="currentColor" strokeWidth="1" opacity="0.35"/>
      {/* 5-point star */}
      <path d="M18 8.5L20.4 14.3L26.7 14.6L21.7 18.4L23.4 24.5L18 21L12.6 24.5L14.3 18.4L9.3 14.6L15.6 14.3Z"
            stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.18" strokeLinejoin="round"/>
      {/* center pip */}
      <circle cx="18" cy="18.4" r="1.2" fill="currentColor"/>
    </svg>
  ),
  // Sounder — Dark Web Monitor. Sonar pulse echolocating into the deep.
  dark_web_monitor: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      {/* depth horizon line */}
      <line x1="4" y1="11" x2="32" y2="11" stroke="currentColor" strokeWidth="0.8" opacity="0.25"/>
      {/* sonar emitter */}
      <circle cx="18" cy="11" r="2" fill="currentColor"/>
      {/* downward concentric arcs (sonar pings going into the dark) */}
      <path d="M11 18C13 16 15.5 15 18 15C20.5 15 23 16 25 18"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M8 23C11 20 14.5 18.5 18 18.5C21.5 18.5 25 20 28 23"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.7"/>
      <path d="M5 28C9 24 13.5 22 18 22C22.5 22 27 24 31 28"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
      {/* return blip — what the sonar found in the depth */}
      <circle cx="22" cy="26" r="1.5" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  // Mockingbird — Social Monitor. Songbird with sound waves; mimicry detector.
  social_monitor: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      {/* bird body */}
      <path d="M9 22C9 17 13 14 18 14C21 14 23 15.5 24 17L28 14L26 19C26 23 23 26 18 26C13 26 9 24 9 22Z"
            stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.15" strokeLinejoin="round"/>
      {/* eye */}
      <circle cx="22" cy="18" r="0.9" fill="currentColor"/>
      {/* perch */}
      <line x1="11" y1="26" x2="11" y2="31" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="14" y1="26" x2="14" y2="31" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      {/* song / mimic waves */}
      <path d="M30 18C31 17 31 15 30 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
      <path d="M32.5 19.5C34 18 34 13 32.5 11.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
  // Outrider — Social Discovery. Scout arrow pushing forward, breadcrumb dots behind.
  social_discovery: (s) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      {/* breadcrumbs trailing behind */}
      <circle cx="6" cy="22" r="1.4" fill="currentColor" opacity="0.35"/>
      <circle cx="11" cy="20" r="1.6" fill="currentColor" opacity="0.55"/>
      <circle cx="16" cy="18" r="1.8" fill="currentColor" opacity="0.75"/>
      {/* leading arrow / scout */}
      <path d="M20 16L29 12L26 21L23 19L20 22Z"
            stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.2" strokeLinejoin="round"/>
      {/* horizon line / direction */}
      <line x1="29" y1="12" x2="33" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
      <line x1="26" y1="21" x2="30" y2="25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
};

export function AgentIcon({ agent, size = 24, className }: { agent: string; size?: number; className?: string }) {
  const renderIcon = icons[agent];
  if (!renderIcon) return null;
  return <span className={className} style={{ display: 'inline-flex' }}>{renderIcon(size)}</span>;
}
