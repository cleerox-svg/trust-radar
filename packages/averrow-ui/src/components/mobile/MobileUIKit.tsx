// packages/averrow-ui/src/components/mobile/MobileUIKit.tsx
// Shared dimensional UI components for Averrow mobile screens

import { useState, useEffect } from 'react';

// ── Tokens ────────────────────────────────────────────────────────────────
export const M = {
  AMBER:     '#E5A832',
  AMBER_DIM: '#B8821F',
  RED:       '#C83C3C',
  RED_DIM:   '#8B1A1A',
  BLUE:      '#0A8AB5',
  BLUE_DIM:  '#065A78',
  GREEN:     '#3CB878',
  GREEN_DIM: '#1A6B3C',
};

export const SEV: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  critical: { dot: '#f87171', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)',  text: '#fca5a5' },
  high:     { dot: '#fb923c', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', text: '#fdba74' },
  medium:   { dot: '#fbbf24', bg: 'rgba(229,168,50,0.08)', border: 'rgba(229,168,50,0.22)', text: '#fcd34d' },
  low:      { dot: '#60a5fa', bg: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.20)', text: '#93c5fd' },
  info:     { dot: '#4ade80', bg: 'rgba(74,222,128,0.07)', border: 'rgba(74,222,128,0.15)', text: '#86efac' },
};

export const GRADE_CFG: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  'A+': { bg: 'linear-gradient(135deg,rgba(16,185,129,0.25),rgba(16,185,129,0.10))', border: 'rgba(16,185,129,0.50)', text: '#6ee7b7', glow: 'rgba(16,185,129,0.3)' },
  'A':  { bg: 'linear-gradient(135deg,rgba(16,185,129,0.20),rgba(16,185,129,0.08))', border: 'rgba(16,185,129,0.40)', text: '#6ee7b7', glow: 'rgba(16,185,129,0.25)' },
  'B':  { bg: 'linear-gradient(135deg,rgba(59,130,246,0.18),rgba(59,130,246,0.07))', border: 'rgba(59,130,246,0.35)', text: '#93c5fd', glow: 'rgba(59,130,246,0.25)' },
  'C':  { bg: 'linear-gradient(135deg,rgba(229,168,50,0.18),rgba(229,168,50,0.07))',  border: 'rgba(229,168,50,0.35)',  text: '#fcd34d', glow: 'rgba(229,168,50,0.25)' },
  'D':  { bg: 'linear-gradient(135deg,rgba(249,115,22,0.18),rgba(249,115,22,0.07))',  border: 'rgba(249,115,22,0.35)',  text: '#fdba74', glow: 'rgba(249,115,22,0.25)' },
  'F':  { bg: 'linear-gradient(135deg,rgba(239,68,68,0.22),rgba(239,68,68,0.08))',    border: 'rgba(239,68,68,0.45)',   text: '#fca5a5', glow: 'rgba(239,68,68,0.30)' },
};

// ── 1. useCountUp ─────────────────────────────────────────────────────────
export function useCountUp(target: number, duration = 1100): string {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val.toLocaleString();
}

// ── 2. DeepCard ───────────────────────────────────────────────────────────
// Dimensional glass: gradient fill + top rim highlight + bottom shadow
interface DeepCardProps {
  children: React.ReactNode;
  accentColor?: string;
  variant?: 'base' | 'stat' | 'critical';
  style?: React.CSSProperties;
  onClick?: () => void;
}
export function DeepCard({ children, accentColor, variant = 'base', style = {}, onClick }: DeepCardProps) {
  const cfg = {
    base: {
      bg: 'linear-gradient(160deg,rgba(22,30,48,0.85),rgba(12,18,32,0.95))',
      border: 'rgba(255,255,255,0.09)', rim: 'rgba(255,255,255,0.14)',
      shadow: '0 8px 32px rgba(0,0,0,0.6)',
      inner: 'inset 0 1px 0 rgba(255,255,255,0.10),inset 0 -1px 0 rgba(0,0,0,0.3)',
    },
    stat: {
      bg: accentColor
        ? `linear-gradient(150deg,rgba(22,30,48,0.90),${accentColor}18 70%,rgba(12,18,32,0.98))`
        : 'linear-gradient(160deg,rgba(22,30,48,0.85),rgba(12,18,32,0.95))',
      border: accentColor ? `${accentColor}30` : 'rgba(255,255,255,0.09)',
      rim: accentColor ? `${accentColor}40` : 'rgba(255,255,255,0.14)',
      shadow: `0 8px 32px rgba(0,0,0,0.6)${accentColor ? `,0 0 20px ${accentColor}18` : ''}`,
      inner: `inset 0 1px 0 ${accentColor ? accentColor + '30' : 'rgba(255,255,255,0.10)'},inset 0 -1px 0 rgba(0,0,0,0.3)`,
    },
    critical: {
      bg: 'linear-gradient(150deg,rgba(40,12,12,0.95),rgba(15,8,8,0.98))',
      border: 'rgba(239,68,68,0.35)', rim: 'rgba(239,68,68,0.45)',
      shadow: '0 8px 32px rgba(0,0,0,0.6),0 0 24px rgba(239,68,68,0.15)',
      inner: 'inset 0 1px 0 rgba(239,68,68,0.30),inset 0 -1px 0 rgba(0,0,0,0.4)',
    },
  }[variant];

  return (
    <div onClick={onClick} style={{
      background: cfg.bg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${cfg.border}`, borderRadius: 16, position: 'relative',
      overflow: 'hidden', cursor: onClick ? 'pointer' : 'default',
      boxShadow: `${cfg.shadow},${cfg.inner}`, ...style,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, pointerEvents: 'none', zIndex: 2, background: `linear-gradient(90deg,transparent,${cfg.rim} 30%,${cfg.rim} 70%,transparent)` }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none', zIndex: 2 }} />
      {children}
    </div>
  );
}

// ── 3. StatTile ───────────────────────────────────────────────────────────
interface StatTileProps {
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
  critical?: number;
  onClick?: () => void;
}
export function StatTile({ label, value, sub, accent, critical, onClick }: StatTileProps) {
  const display = useCountUp(typeof value === 'number' ? value : 0);
  const isCrit = (critical ?? 0) > 0;
  return (
    <DeepCard variant="stat" accentColor={accent} onClick={onClick} style={{ padding: '16px 14px', userSelect: 'none' }}>
      <div style={{ position: 'absolute', right: -20, bottom: -20, width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle,${accent}35,transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 12, left: 14, width: 4, height: 4, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
      {isCrit && (
        <div style={{ position: 'absolute', top: 10, right: 10, background: `linear-gradient(135deg,${M.RED},${M.RED_DIM})`, borderRadius: 99, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: '#fff', fontFamily: 'monospace', boxShadow: '0 2px 8px rgba(239,68,68,0.5),inset 0 1px 0 rgba(255,255,255,0.2)', border: '1px solid rgba(239,68,68,0.5)' }}>
          {critical}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, fontFamily: 'monospace', letterSpacing: -1, color: accent, textShadow: `0 0 20px ${accent}60,0 0 40px ${accent}30` }}>
          {typeof value === 'number' ? display : value}
        </div>
        <div style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.20em', color: 'rgba(255,255,255,0.50)', marginTop: 7, textTransform: 'uppercase' }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', marginTop: 3 }}>{sub}</div>}
      </div>
    </DeepCard>
  );
}

// ── 4. BrandAvatar ────────────────────────────────────────────────────────
// Same depth as the CL profile button: solid gradient, rim lighting, white text
export function BrandAvatar({ name, color, dimColor }: { name: string; color: string; dimColor?: string }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
      background: `linear-gradient(145deg,${color},${dimColor ?? color})`,
      border: `1px solid ${color}70`,
      boxShadow: [
        '0 4px 14px rgba(0,0,0,0.70)',
        'inset 0 1px 0 rgba(255,255,255,0.28)',
        'inset 0 -1px 0 rgba(0,0,0,0.45)',
        `0 0 18px ${color}35`,
      ].join(','),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, fontWeight: 900, color: '#fff',
      textShadow: '0 1px 3px rgba(0,0,0,0.65)',
    }}>
      {name[0].toUpperCase()}
    </div>
  );
}

// ── 5. SevChip ────────────────────────────────────────────────────────────
export function SevChip({ severity }: { severity: string }) {
  const s = SEV[severity] ?? SEV.low;
  return (
    <span style={{
      fontSize: 9, fontFamily: 'monospace', fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.12em',
      padding: '3px 8px', borderRadius: 99,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      boxShadow: `inset 0 1px 0 ${s.dot}30,0 2px 8px ${s.dot}20`,
    }}>
      {severity}
    </span>
  );
}

// ── 6. GradeBadge ─────────────────────────────────────────────────────────
export function GradeBadge({ grade }: { grade?: string | null }) {
  if (!grade) return null;
  const g = GRADE_CFG[grade] ?? GRADE_CFG['F'];
  return (
    <span style={{
      fontSize: 10, fontFamily: 'monospace', fontWeight: 900,
      padding: '3px 10px', borderRadius: 8,
      background: g.bg, border: `1px solid ${g.border}`, color: g.text,
      boxShadow: `inset 0 1px 0 ${g.border},0 2px 8px ${g.glow}`,
      letterSpacing: '0.05em',
    }}>
      {grade}
    </span>
  );
}
