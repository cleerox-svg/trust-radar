// Averrow UI Standard — SeverityChip v1.0
// Replaces all flat severity badges platform-wide.
// See AVERROW_UI_STANDARD.md for full spec.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ChipSize = 'xs' | 'sm' | 'md';

export interface SeverityChipProps {
  severity: Severity;
  size?: ChipSize;
  pulse?: boolean;
}

const SEV_CONFIG: Record<Severity, {
  dot: string; bg: string; border: string; text: string;
}> = {
  critical: { dot:'#f87171', bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.30)',  text:'#fca5a5' },
  high:     { dot:'#fb923c', bg:'rgba(249,115,22,0.08)', border:'rgba(249,115,22,0.25)', text:'#fdba74' },
  medium:   { dot:'#fbbf24', bg:'rgba(229,168,50,0.08)', border:'rgba(229,168,50,0.22)', text:'#fcd34d' },
  low:      { dot:'#60a5fa', bg:'rgba(59,130,246,0.07)', border:'rgba(59,130,246,0.20)', text:'#93c5fd' },
  info:     { dot:'#4ade80', bg:'rgba(74,222,128,0.07)', border:'rgba(74,222,128,0.15)', text:'#86efac' },
};

const SIZE_CONFIG: Record<ChipSize, {
  fontSize: number; padding: string; radius: number;
}> = {
  xs: { fontSize:  8, padding: '2px 6px',  radius:  6 },
  sm: { fontSize:  9, padding: '3px 8px',  radius: 99 },
  md: { fontSize: 10, padding: '4px 10px', radius: 99 },
};

export function SeverityChip({ severity, size = 'sm', pulse = false }: SeverityChipProps) {
  const s = SEV_CONFIG[severity] ?? SEV_CONFIG.low;
  const z = SIZE_CONFIG[size];

  return (
    <span
      style={{
        display:     'inline-flex',
        alignItems:  'center',
        gap:         5,
        fontSize:    z.fontSize,
        fontFamily:  'monospace',
        fontWeight:  800,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        padding:     z.padding,
        borderRadius: z.radius,
        background:  s.bg,
        border:      `1px solid ${s.border}`,
        color:       s.text,
        boxShadow:   `inset 0 1px 0 ${s.dot}30, 0 2px 8px ${s.dot}20`,
        whiteSpace:  'nowrap',
      }}
    >
      {pulse && (
        <span style={{ position:'relative', display:'inline-flex', width:6, height:6 }}>
          <span style={{
            position:'absolute', inset:0, borderRadius:'50%',
            background:s.dot, opacity:0.7,
            animation:'chip-ping 1.5s ease-in-out infinite',
          }} />
          <span style={{
            position:'relative', width:6, height:6, borderRadius:'50%',
            background:s.dot, boxShadow:`0 0 6px ${s.dot}`,
          }} />
        </span>
      )}
      {severity}
    </span>
  );
}
