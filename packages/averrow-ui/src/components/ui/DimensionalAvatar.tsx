// Averrow UI Standard — DimensionalAvatar v1.1
// Solid gradient avatar with rim lighting, or favicon variant (Option B).
// See AVERROW_UI_STANDARD.md for full spec.

import { useState } from 'react';

export interface DimensionalAvatarProps {
  name: string;
  color: string;
  dimColor?: string;
  size?: number;
  radius?: number;
  fontSize?: number;
  faviconUrl?: string;
  severity?: string;
}

const SEV_DOTS: Record<string, string> = {
  critical: '#f87171',
  high:     '#fb923c',
  medium:   '#fbbf24',
  low:      '#60a5fa',
  info:     '#4ade80',
};

export function DimensionalAvatar({
  name,
  color,
  dimColor,
  size = 40,
  radius = 12,
  fontSize,
  faviconUrl,
  severity,
}: DimensionalAvatarProps) {
  const dim = dimColor ?? `${color}88`;
  const fs  = fontSize ?? Math.round(size * 0.375);
  const letter = (name[0] ?? '?').toUpperCase();
  const [imgFailed, setImgFailed] = useState(false);

  if (faviconUrl && !imgFailed) {
    const sevColor = severity ? SEV_DOTS[severity] : undefined;
    const borderColor = sevColor ? `${sevColor}40` : 'rgba(255,255,255,0.09)';
    const glowColor = sevColor ? `${sevColor}15` : 'rgba(255,255,255,0)';
    const dotColor = sevColor ?? 'rgba(255,255,255,0.20)';

    return (
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: radius,
            background: 'linear-gradient(145deg, rgba(25,35,55,0.95), rgba(10,15,28,0.98))',
            border: `1.5px solid ${borderColor}`,
            boxShadow: [
              '0 4px 14px rgba(0,0,0,0.7)',
              'inset 0 1px 0 rgba(255,255,255,0.10)',
              `0 0 0 3px ${glowColor}`,
            ].join(', '),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={faviconUrl}
            alt={name}
            width={22}
            height={22}
            style={{ width: 22, height: 22, objectFit: 'contain' }}
            onError={() => setImgFailed(true)}
          />
        </div>
        {severity && (
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: dotColor,
              border: '2px solid #060A14',
              boxShadow: `0 0 6px ${dotColor}80`,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width:  size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        background: `linear-gradient(145deg, ${color}, ${dim})`,
        border:     `1px solid ${color}70`,
        boxShadow: [
          `0 ${Math.round(size * 0.10)}px ${Math.round(size * 0.35)}px rgba(0,0,0,0.70)`,
          'inset 0 1px 0 rgba(255,255,255,0.28)',
          'inset 0 -1px 0 rgba(0,0,0,0.45)',
          `0 0 ${Math.round(size * 0.45)}px ${color}35`,
        ].join(', '),
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize:   fs,
        fontWeight: 900,
        color:      '#fff',
        textShadow: '0 1px 3px rgba(0,0,0,0.65)',
        userSelect: 'none',
      }}
    >
      {letter}
    </div>
  );
}
