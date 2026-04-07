// Averrow Design System — StatCard v2.0
// Unified stat card. Replaces both ui/StatCard and brands/StatCard.
// Supports both existing APIs — no callsite changes required.

import React from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { GlowNumber } from './GlowNumber';
import { cn } from '@/lib/cn';

function accentFromColor(color?: string): string {
  if (!color) return '#E5A832';
  return color;
}

// ── API A — Simple label/value stat (was ui/StatCard) ─────────────────────
interface SimpleStatCardProps {
  label:           string;
  value:           string | number;
  sublabel?:       string;
  trend?:          string;
  trendDirection?: 'up' | 'down' | 'neutral';
  accentColor?:    string;
  className?:      string;
  onClick?:        () => void;
}

function SimpleStatCard({
  label, value, sublabel, trend, trendDirection, accentColor, className, onClick,
}: SimpleStatCardProps) {
  const accent = accentFromColor(accentColor);

  const containerStyle: CSSProperties = {
    padding: '16px 20px',
    position: 'relative',
    userSelect: 'none',
    borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
    cursor: onClick ? 'pointer' : undefined,
  };

  return (
    <div
      className={cn(
        'glass-stat rounded-xl transition-all',
        accentColor && 'border-l-[3px]',
        className,
      )}
      style={containerStyle}
      onClick={onClick}
    >
      <div style={{
        position: 'absolute', right: -20, bottom: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}25 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 12, left: 16,
        width: 4, height: 4, borderRadius: '50%',
        background: accent,
        boxShadow: `0 0 8px ${accent}`,
      }} />

      <div style={{ marginTop: 8, position: 'relative' }}>
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono)',
          letterSpacing: '0.20em', color: 'rgba(255,255,255,0.40)',
          textTransform: 'uppercase', marginBottom: 6,
        }}>
          {label}
        </div>

        {typeof value === 'number' ? (
          <GlowNumber value={value} color={accent} size="lg" animate />
        ) : (
          <span style={{
            fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)',
            color: accent, letterSpacing: -1, lineHeight: 1,
            textShadow: `0 0 20px ${accent}60, 0 0 40px ${accent}30`,
          }}>
            {value}
          </span>
        )}

        {sublabel && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
            {sublabel}
          </div>
        )}
        {trend && (
          <div
            className={cn(
              'font-mono text-[10px] mt-1',
              trendDirection === 'up'
                ? 'text-positive'
                : trendDirection === 'down'
                ? 'text-accent'
                : 'text-white/55',
            )}
          >
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}

// ── API B — Detail layout (was brands/StatCard) ────────────────────────────
interface DetailStatCardProps {
  title:       ReactNode;
  children:    ReactNode;
  metric:      ReactNode;
  metricLabel: ReactNode;
  className?:  string;
  onClick?:    () => void;
}

function DetailStatCard({
  title, children, metric, metricLabel, className, onClick,
}: DetailStatCardProps) {
  return (
    <div
      className={cn('glass-stat rounded-xl transition-all', className)}
      onClick={onClick}
      style={{ padding: '14px 16px', cursor: onClick ? 'pointer' : undefined }}
    >
      <div style={{
        fontSize: 9, fontFamily: 'var(--font-mono)',
        letterSpacing: '0.20em', color: 'rgba(255,255,255,0.40)',
        textTransform: 'uppercase', marginBottom: 10,
      }}>
        {title}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>

        <div style={{
          width: 1, alignSelf: 'stretch',
          background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.12) 70%, transparent)',
          flexShrink: 0,
        }} />

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 32, fontWeight: 900, fontFamily: 'var(--font-mono)',
            color: '#E5A832', letterSpacing: -1, lineHeight: 1,
            textShadow: '0 0 20px rgba(229,168,50,0.40)',
          }}>
            {metric}
          </div>
          <div style={{
            fontSize: 9, fontFamily: 'var(--font-mono)',
            letterSpacing: '0.16em', color: 'rgba(255,255,255,0.25)',
            textTransform: 'uppercase', marginTop: 4,
          }}>
            {metricLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Unified export ─────────────────────────────────────────────────────────
type StatCardProps =
  | (SimpleStatCardProps & { title?: undefined; metric?: undefined; metricLabel?: undefined })
  | DetailStatCardProps;

export function StatCard(props: StatCardProps) {
  if ('title' in props && props.title !== undefined) {
    return <DetailStatCard {...(props as DetailStatCardProps)} />;
  }
  return <SimpleStatCard {...(props as SimpleStatCardProps)} />;
}

export { SimpleStatCard, DetailStatCard };
export type { SimpleStatCardProps, DetailStatCardProps, StatCardProps };
