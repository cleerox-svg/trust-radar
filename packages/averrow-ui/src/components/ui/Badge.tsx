// Averrow Design System — Badge v2.0
// Drop-in replacement for Badge + SeverityChip.
// Uses CSS custom properties from design-system/tokens.css.

import React from 'react';
import { cn } from '@/lib/cn';

export type Severity =
  | 'critical' | 'high' | 'medium' | 'low' | 'info';

export type BadgeStatus =
  | 'active' | 'inactive' | 'pending' | 'draft'
  | 'running' | 'healthy' | 'degraded' | 'failed'
  | 'success' | 'warning';

export type LegacyVariant =
  | 'critical' | 'high' | 'medium' | 'low'
  | 'success' | 'info' | 'default';

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps {
  severity?: Severity;
  status?:   BadgeStatus;
  size?:     BadgeSize;
  pulse?:    boolean;
  label?:    string;
  variant?:  LegacyVariant;
  children?: React.ReactNode;
  className?: string;
}

const SEV: Record<Severity, {
  dot: string; bg: string; border: string; text: string; label: string;
}> = {
  critical: {
    dot:    'var(--sev-critical)',
    bg:     'var(--sev-critical-bg)',
    border: 'var(--sev-critical-border)',
    text:   '#fca5a5',
    label:  'Critical',
  },
  high: {
    dot:    'var(--sev-high)',
    bg:     'var(--sev-high-bg)',
    border: 'var(--sev-high-border)',
    text:   '#fdba74',
    label:  'High',
  },
  medium: {
    dot:    'var(--sev-medium)',
    bg:     'var(--sev-medium-bg)',
    border: 'var(--sev-medium-border)',
    text:   '#fcd34d',
    label:  'Medium',
  },
  low: {
    dot:    'var(--sev-low)',
    bg:     'var(--sev-low-bg)',
    border: 'var(--sev-low-border)',
    text:   '#93c5fd',
    label:  'Low',
  },
  info: {
    dot:    'var(--sev-info)',
    bg:     'var(--sev-info-bg)',
    border: 'var(--sev-info-border)',
    text:   '#86efac',
    label:  'Info',
  },
};

const STATUS: Record<BadgeStatus, {
  bg: string; border: string; text: string; dot?: string;
}> = {
  active:   { bg: 'var(--sev-info-bg)',      border: 'var(--sev-info-border)',     text: '#86efac', dot: 'var(--sev-info)' },
  healthy:  { bg: 'var(--sev-info-bg)',      border: 'var(--sev-info-border)',     text: '#86efac', dot: 'var(--sev-info)' },
  running:  { bg: 'var(--blue-glow)',        border: 'var(--blue-border)',         text: '#93c5fd', dot: 'var(--blue)' },
  pending:  { bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.25)',      text: '#fcd34d' },
  draft:    { bg: 'rgba(255,255,255,0.05)',  border: 'var(--border-base)',         text: 'var(--text-tertiary)' },
  inactive: { bg: 'rgba(255,255,255,0.04)',  border: 'var(--border-base)',         text: 'var(--text-muted)' },
  degraded: { bg: 'var(--sev-high-bg)',      border: 'var(--sev-high-border)',     text: '#fdba74', dot: 'var(--sev-high)' },
  failed:   { bg: 'var(--sev-critical-bg)',  border: 'var(--sev-critical-border)', text: '#fca5a5', dot: 'var(--sev-critical)' },
  success:  { bg: 'var(--sev-info-bg)',      border: 'var(--sev-info-border)',     text: '#86efac' },
  warning:  { bg: 'var(--sev-medium-bg)',    border: 'var(--sev-medium-border)',   text: '#fcd34d' },
};

const LEGACY_MAP: Record<LegacyVariant, Severity | 'default'> = {
  critical: 'critical',
  high:     'high',
  medium:   'medium',
  low:      'low',
  success:  'info',
  info:     'info',
  default:  'default',
};

const SIZE: Record<BadgeSize, { fontSize: number; padding: string; radius: number }> = {
  xs: { fontSize:  8, padding: '2px 6px',  radius:  6 },
  sm: { fontSize:  9, padding: '3px 8px',  radius: 99 },
  md: { fontSize: 10, padding: '4px 10px', radius: 99 },
};

export function Badge({
  severity,
  status,
  variant,
  size    = 'sm',
  pulse   = false,
  label,
  children,
  className,
}: BadgeProps) {
  const z = SIZE[size];

  let cfg: { bg: string; border: string; text: string; dot?: string; label?: string } | null = null;

  if (severity) {
    const s = SEV[severity];
    cfg = { ...s, dot: s.dot };
  } else if (status) {
    cfg = STATUS[status];
  } else if (variant && variant !== 'default') {
    const mapped = LEGACY_MAP[variant];
    if (mapped && mapped !== 'default') {
      const s = SEV[mapped as Severity];
      cfg = { ...s, dot: s.dot };
    }
  }

  if (!cfg) {
    cfg = {
      bg:     'rgba(255,255,255,0.05)',
      border: 'var(--border-base)',
      text:   'var(--text-tertiary)',
    };
  }

  const displayText = label ?? (children ?? (severity ? severity : (status ?? (variant && variant !== 'default' ? variant : ''))));
  const showDot = pulse && cfg.dot;

  return (
    <span
      className={cn(className)}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           showDot ? 5 : 0,
        fontSize:      z.fontSize,
        fontFamily:    'var(--font-mono)',
        fontWeight:    800,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        padding:       z.padding,
        borderRadius:  z.radius,
        background:    cfg.bg,
        border:        `1px solid ${cfg.border}`,
        color:         cfg.text,
        whiteSpace:    'nowrap',
        boxShadow:     cfg.dot
          ? `inset 0 1px 0 ${cfg.dot}30, 0 2px 8px ${cfg.dot}20`
          : 'none',
      }}
    >
      {showDot && (
        <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6 }}>
          <span style={{
            position:    'absolute',
            inset:       0,
            borderRadius: '50%',
            background:  cfg.dot,
            opacity:     0.7,
            animation:   'chip-ping 1.5s ease-in-out infinite',
          }} />
          <span style={{
            position:     'relative',
            width:        6,
            height:       6,
            borderRadius: '50%',
            background:   cfg.dot,
            boxShadow:    `0 0 6px ${cfg.dot}`,
          }} />
        </span>
      )}
      {displayText}
    </span>
  );
}
