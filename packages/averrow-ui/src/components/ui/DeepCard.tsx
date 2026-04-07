// Averrow UI Standard — DeepCard v1.0
// The foundation. Every card in the platform is one of these.
// See AVERROW_UI_STANDARD.md for full spec.

import React from 'react';

export type DeepVariant = 'base' | 'elevated' | 'active' | 'critical';

export interface DeepCardProps {
  children: React.ReactNode;
  variant?: DeepVariant;
  accentColor?: string;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

const VARIANT_CONFIG: Record<DeepVariant, {
  bg: string; border: string; rim: string; shadow: string;
}> = {
  base: {
    bg:     'linear-gradient(160deg, rgba(22,30,48,0.85) 0%, rgba(12,18,32,0.95) 100%)',
    border: 'rgba(255,255,255,0.09)',
    rim:    'rgba(255,255,255,0.14)',
    shadow: '0 8px 32px rgba(0,0,0,0.60)',
  },
  elevated: {
    bg:     'linear-gradient(160deg, rgba(18,26,44,0.92) 0%, rgba(8,12,24,0.98) 100%)',
    border: 'rgba(255,255,255,0.11)',
    rim:    'rgba(255,255,255,0.18)',
    shadow: '0 12px 48px rgba(0,0,0,0.75)',
  },
  active: {
    bg:     'linear-gradient(160deg, rgba(22,30,48,0.85) 0%, rgba(12,18,32,0.95) 100%)',
    border: 'rgba(229,168,50,0.22)',
    rim:    'rgba(229,168,50,0.35)',
    shadow: '0 8px 32px rgba(0,0,0,0.60), 0 0 20px rgba(229,168,50,0.10)',
  },
  critical: {
    bg:     'linear-gradient(150deg, rgba(40,12,12,0.95) 0%, rgba(15,8,8,0.98) 100%)',
    border: 'rgba(239,68,68,0.35)',
    rim:    'rgba(239,68,68,0.45)',
    shadow: '0 8px 32px rgba(0,0,0,0.70), 0 0 24px rgba(239,68,68,0.15)',
  },
};

export function DeepCard({
  children,
  variant = 'base',
  accentColor,
  style = {},
  className = '',
  onClick,
}: DeepCardProps) {
  const cfg = { ...VARIANT_CONFIG[variant] };

  if (accentColor && variant === 'active') {
    cfg.border = `${accentColor}30`;
    cfg.rim    = `${accentColor}40`;
    cfg.shadow = `0 8px 32px rgba(0,0,0,0.60), 0 0 20px ${accentColor}18`;
  }

  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background:           cfg.bg,
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border:               `1px solid ${cfg.border}`,
        boxShadow: [
          cfg.shadow,
          `inset 0 1px 0 ${cfg.rim}`,
          'inset 0 -1px 0 rgba(0,0,0,0.40)',
        ].join(', '),
        borderRadius:  16,
        position:      'relative',
        overflow:      'hidden',
        cursor:        onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position:   'absolute',
          top: 0, left: 0, right: 0,
          height:     1,
          background: `linear-gradient(90deg, transparent, ${cfg.rim} 25%, ${cfg.rim} 75%, transparent)`,
          pointerEvents: 'none',
          zIndex:     2,
        }}
      />
      <div
        aria-hidden
        style={{
          position:   'absolute',
          bottom: 0, left: 0, right: 0,
          height:     1,
          background: 'rgba(0,0,0,0.50)',
          pointerEvents: 'none',
          zIndex:     2,
        }}
      />
      {children}
    </div>
  );
}
