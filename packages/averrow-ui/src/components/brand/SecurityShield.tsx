interface SecurityShieldProps {
  spf: string | null;
  dkim: string | null;
  dmarc: string | null;
  grade: string | null;
}

export function SecurityShield({ spf, dkim, dmarc, grade }: SecurityShieldProps) {
  const getColor = (result: string | null) => {
    if (!result || result === 'none') return { fill: '#1A2E48', stroke: '#2A3E58', icon: '\u2014', textColor: '#5A80A8' };
    if (result === 'pass') return { fill: '#28A05015', stroke: '#28A050', icon: '\u2713', textColor: '#28A050' };
    return { fill: '#C83C3C15', stroke: '#C83C3C', icon: '\u2717', textColor: '#C83C3C' };
  };

  const spfStyle = getColor(spf);
  const dkimStyle = getColor(dkim);
  const dmarcStyle = getColor(dmarc);

  const gradeColors: Record<string, string> = {
    'A+': '#28A050', 'A': '#28A050', 'B': '#78A0C8', 'C': '#E8923C', 'D': '#C83C3C', 'F': '#C83C3C',
  };
  const gradeColor = gradeColors[grade || ''] || '#5A80A8';

  return (
    <div className="flex items-center gap-6">
      {/* Shield SVG */}
      <svg width="80" height="96" viewBox="0 0 80 96" fill="none">
        {/* Shield outline */}
        <path d="M40 4L72 20V52C72 72 56 88 40 92C24 88 8 72 8 52V20L40 4Z"
          fill="#0E1A2B" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

        {/* SPF layer (top) */}
        <rect x="16" y="22" width="48" height="18" rx="4"
          fill={spfStyle.fill} stroke={spfStyle.stroke} strokeWidth="1" />
        <text x="28" y="34" fontSize="9" fontFamily="'IBM Plex Mono'" fontWeight="600" fill={spfStyle.textColor}>SPF</text>
        <text x="56" y="34" fontSize="11" fontFamily="'IBM Plex Mono'" fontWeight="700" fill={spfStyle.textColor}>{spfStyle.icon}</text>

        {/* DKIM layer (middle) */}
        <rect x="16" y="44" width="48" height="18" rx="4"
          fill={dkimStyle.fill} stroke={dkimStyle.stroke} strokeWidth="1" />
        <text x="24" y="56" fontSize="9" fontFamily="'IBM Plex Mono'" fontWeight="600" fill={dkimStyle.textColor}>DKIM</text>
        <text x="56" y="56" fontSize="11" fontFamily="'IBM Plex Mono'" fontWeight="700" fill={dkimStyle.textColor}>{dkimStyle.icon}</text>

        {/* DMARC layer (bottom) */}
        <rect x="16" y="66" width="48" height="18" rx="4"
          fill={dmarcStyle.fill} stroke={dmarcStyle.stroke} strokeWidth="1" />
        <text x="20" y="78" fontSize="9" fontFamily="'IBM Plex Mono'" fontWeight="600" fill={dmarcStyle.textColor}>DMARC</text>
        <text x="56" y="78" fontSize="11" fontFamily="'IBM Plex Mono'" fontWeight="700" fill={dmarcStyle.textColor}>{dmarcStyle.icon}</text>
      </svg>

      {/* Grade display */}
      <div className="flex flex-col items-center">
        <div className="font-display text-4xl font-extrabold" style={{ color: gradeColor }}>{grade || '\u2014'}</div>
        <div className="font-mono text-[9px] text-contrail/40 uppercase tracking-wider mt-1">Email Grade</div>
      </div>
    </div>
  );
}
