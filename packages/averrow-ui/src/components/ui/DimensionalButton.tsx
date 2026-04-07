// Averrow UI Standard — DimensionalButton v1.0
// Primary, secondary, danger, and ghost variants.
// See AVERROW_UI_STANDARD.md for full spec.

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface DimensionalButtonProps {
  children: React.ReactNode;
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  fullWidth?: boolean;
  onClick?:   () => void;
  disabled?:  boolean;
  type?:      'button' | 'submit';
  icon?:      React.ReactNode;
}

const BUTTON_CONFIG: Record<ButtonVariant, {
  bg: string; border: string; color: string; rim: string; shadow: string;
}> = {
  primary: {
    bg:     'linear-gradient(135deg, #E5A832, #B8821F)',
    border: 'rgba(229,168,50,0.60)',
    color:  '#000',
    rim:    'rgba(255,255,255,0.30)',
    shadow: '0 4px 16px rgba(229,168,50,0.40), 0 2px 4px rgba(0,0,0,0.40)',
  },
  secondary: {
    bg:     'linear-gradient(160deg, rgba(22,30,48,0.90), rgba(12,18,32,0.98))',
    border: 'rgba(255,255,255,0.12)',
    color:  'rgba(255,255,255,0.80)',
    rim:    'rgba(255,255,255,0.14)',
    shadow: '0 4px 16px rgba(0,0,0,0.40)',
  },
  danger: {
    bg:     'linear-gradient(135deg, #C83C3C, #8B1A1A)',
    border: 'rgba(239,68,68,0.60)',
    color:  '#fff',
    rim:    'rgba(255,120,120,0.35)',
    shadow: '0 4px 16px rgba(239,68,68,0.35), 0 2px 4px rgba(0,0,0,0.40)',
  },
  ghost: {
    bg:     'transparent',
    border: 'rgba(255,255,255,0.10)',
    color:  'rgba(255,255,255,0.60)',
    rim:    'transparent',
    shadow: 'none',
  },
};

const SIZE_CONFIG: Record<ButtonSize, {
  fontSize: number; padding: string; radius: number; fontWeight: number;
}> = {
  sm: { fontSize: 10, padding: '6px 14px',  radius:  8, fontWeight: 700 },
  md: { fontSize: 11, padding: '9px 20px',  radius: 10, fontWeight: 800 },
  lg: { fontSize: 12, padding: '12px 28px', radius: 12, fontWeight: 800 },
};

export function DimensionalButton({
  children,
  variant   = 'primary',
  size      = 'md',
  fullWidth = false,
  onClick,
  disabled  = false,
  type      = 'button',
  icon,
}: DimensionalButtonProps) {
  const c = BUTTON_CONFIG[variant];
  const z = SIZE_CONFIG[size];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            6,
        width:          fullWidth ? '100%' : 'auto',
        background:     c.bg,
        border:         `1px solid ${c.border}`,
        borderRadius:   z.radius,
        color:          c.color,
        fontSize:       z.fontSize,
        fontWeight:     z.fontWeight,
        fontFamily:     'monospace',
        letterSpacing:  '0.06em',
        textTransform:  'uppercase',
        padding:        z.padding,
        cursor:         disabled ? 'not-allowed' : 'pointer',
        opacity:        disabled ? 0.4 : 1,
        boxShadow: [
          c.shadow,
          `inset 0 1px 0 ${c.rim}`,
          'inset 0 -1px 0 rgba(0,0,0,0.30)',
        ].join(', '),
        transition:  'opacity 0.15s ease, transform 0.1s ease',
        outline:     'none',
        userSelect:  'none',
      }}
    >
      {icon && <span style={{ display:'flex', alignItems:'center' }}>{icon}</span>}
      {children}
    </button>
  );
}
