/**
 * PlatformIcon — platform color-coded icon pill
 */
import type { Platform } from "../../lib/types";

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  tiktok:    { label: "TK",  color: "#fff",     bg: "#010101" },
  instagram: { label: "IG",  color: "#fff",     bg: "#E1306C" },
  x:         { label: "𝕏",   color: "#fff",     bg: "#14171A" },
  youtube:   { label: "YT",  color: "#fff",     bg: "#FF0000" },
  facebook:  { label: "FB",  color: "#fff",     bg: "#1877F2" },
  linkedin:  { label: "LI",  color: "#fff",     bg: "#0A66C2" },
  twitch:    { label: "TW",  color: "#fff",     bg: "#9146FF" },
  threads:   { label: "TH",  color: "#fff",     bg: "#101010" },
  snapchat:  { label: "SC",  color: "#000",     bg: "#FFFC00" },
  pinterest: { label: "PT",  color: "#fff",     bg: "#E60023" },
};

interface PlatformIconProps {
  platform: Platform | string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const SIZE_MAP = { sm: "w-6 h-6 text-[9px]", md: "w-8 h-8 text-xs", lg: "w-10 h-10 text-sm" };

export function PlatformIcon({ platform, size = "md", showLabel = false }: PlatformIconProps) {
  const cfg = PLATFORM_CONFIG[platform.toLowerCase()] ?? { label: platform.slice(0, 2).toUpperCase(), color: "#fff", bg: "#1E1B54" };
  const sz = SIZE_MAP[size];

  if (showLabel) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center rounded-md font-bold ${sz}`}
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
        <span className="text-sm text-slate-300 capitalize">{platform}</span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold ${sz}`}
      style={{ background: cfg.bg, color: cfg.color }}
      title={platform}
    >
      {cfg.label}
    </span>
  );
}

export function PlatformFilterBar({
  selected, onChange
}: {
  selected: string;
  onChange: (p: string) => void;
}) {
  const platforms = ["all", ...Object.keys(PLATFORM_CONFIG)];
  return (
    <div className="flex gap-1.5 flex-wrap">
      {platforms.slice(0, 9).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
            selected === p
              ? "bg-gold text-soc-bg"
              : "bg-soc-border/30 text-slate-400 hover:bg-soc-border/60"
          }`}
        >
          {p === "all" ? "ALL" : p.slice(0, 2).toUpperCase()}
        </button>
      ))}
    </div>
  );
}
