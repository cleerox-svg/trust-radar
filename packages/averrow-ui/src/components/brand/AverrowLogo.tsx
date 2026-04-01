export function AverrowLogo({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const dim = size === 'small' ? 24 : size === 'large' ? 40 : 28;

  return (
    <div className="flex items-center gap-2.5">
      <svg width={dim} height={dim} viewBox="0 0 32 32" fill="none" className="flex-shrink-0">
        <defs>
          <linearGradient id="sidebar-logo" x1="16" y1="5" x2="16" y2="26" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6B1010" />
            <stop offset="1" stopColor="#C83C3C" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="6" fill="#080E18" />
        <path d="M16 5L26 26H18L16 21L14 26H6Z" fill="url(#sidebar-logo)" />
        <path d="M14.5 22H17.5L16 18Z" fill="#080E18" />
      </svg>
      <div>
        <div className="font-display font-bold text-parchment tracking-[0.15em] text-sm">AVERROW</div>
        <div className="font-mono text-[7px] text-afterburner tracking-[0.2em]">THREAT INTERCEPTOR</div>
      </div>
    </div>
  );
}
