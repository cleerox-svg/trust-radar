export function LiveIndicator({
  label = 'LIVE',
  active = true,
  size = 'sm',
}: {
  label?: string;
  active?: boolean;
  size?: 'xs' | 'sm';
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex">
        {active && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={`relative inline-flex rounded-full ${
            active ? 'bg-emerald-500' : 'bg-white/20'
          } ${size === 'xs' ? 'h-1.5 w-1.5' : 'h-2 w-2'}`}
        />
      </div>
      <span
        className={`font-mono tracking-widest text-white/40 uppercase ${
          size === 'xs' ? 'text-[9px]' : 'text-[10px]'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
