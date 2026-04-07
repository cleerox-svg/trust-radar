// Averrow UI Standard — DimensionalAvatar v1.0
// Solid gradient avatar with rim lighting.
// See AVERROW_UI_STANDARD.md for full spec.

export interface DimensionalAvatarProps {
  name: string;
  color: string;
  dimColor?: string;
  size?: number;
  radius?: number;
  fontSize?: number;
}

export function DimensionalAvatar({
  name,
  color,
  dimColor,
  size = 40,
  radius = 12,
  fontSize,
}: DimensionalAvatarProps) {
  const dim = dimColor ?? `${color}88`;
  const fs  = fontSize ?? Math.round(size * 0.375);

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
      {(name[0] ?? '?').toUpperCase()}
    </div>
  );
}
