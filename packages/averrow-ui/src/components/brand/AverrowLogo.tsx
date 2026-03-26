export function AverrowLogo({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const h = size === 'small' ? 'h-6' : size === 'large' ? 'h-10' : 'h-8';

  return (
    <div className="flex items-center gap-2">
      <svg className={h} viewBox="0 0 36 36" fill="none">
        <defs>
          <linearGradient id="logo-grad" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C83C3C" />
            <stop offset="1" stopColor="#78A0C8" />
          </linearGradient>
        </defs>
        <path d="M18 2L32 34H4L18 2Z" fill="url(#logo-grad)" opacity="0.9" />
        <path d="M18 10L14 34H22L18 10Z" fill="#080E18" />
      </svg>
      <div>
        <div className="font-display font-bold text-parchment tracking-[0.15em] text-sm">AVERROW</div>
        <div className="font-mono text-[7px] text-accent tracking-[0.2em]">THREAT INTERCEPTOR</div>
      </div>
    </div>
  );
}
