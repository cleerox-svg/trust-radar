/**
 * PlatformIcon — platform color-coded icon pill + mobile-friendly filter bar
 */
import type { Platform } from "../../lib/types";

export const PLATFORM_CONFIG: Record<string, { label: string; name: string; color: string; bg: string }> = {
  tiktok:    { label: "TK",  name: "TikTok",    color: "#fff", bg: "#010101" },
  instagram: { label: "IG",  name: "Instagram",  color: "#fff", bg: "#E1306C" },
  x:         { label: "𝕏",   name: "X",          color: "#fff", bg: "#14171A" },
  youtube:   { label: "YT",  name: "YouTube",    color: "#fff", bg: "#FF0000" },
  facebook:  { label: "FB",  name: "Facebook",   color: "#fff", bg: "#1877F2" },
  linkedin:  { label: "LI",  name: "LinkedIn",   color: "#fff", bg: "#0A66C2" },
  twitch:    { label: "TW",  name: "Twitch",     color: "#fff", bg: "#9146FF" },
  threads:   { label: "TH",  name: "Threads",    color: "#fff", bg: "#101010" },
  snapchat:  { label: "SC",  name: "Snapchat",   color: "#000", bg: "#FFFC00" },
  pinterest: { label: "PT",  name: "Pinterest",  color: "#fff", bg: "#E60023" },
  bluesky:   { label: "BS",  name: "Bluesky",    color: "#fff", bg: "#0085FF" },
  reddit:    { label: "RD",  name: "Reddit",     color: "#fff", bg: "#FF4500" },
  github:    { label: "GH",  name: "GitHub",     color: "#fff", bg: "#24292E" },
  mastodon:  { label: "MT",  name: "Mastodon",   color: "#fff", bg: "#6364FF" },
  rss:       { label: "RSS", name: "RSS / Atom", color: "#fff", bg: "#F26522" },
};

interface PlatformIconProps {
  platform: Platform | string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const SIZE_MAP = { sm: "w-6 h-6 text-[9px]", md: "w-8 h-8 text-xs", lg: "w-10 h-10 text-sm" };

export function PlatformIcon({ platform, size = "md", showLabel = false }: PlatformIconProps) {
  const cfg = PLATFORM_CONFIG[platform.toLowerCase()] ?? {
    label: platform.slice(0, 2).toUpperCase(), name: platform, color: "#fff", bg: "#1E1B54",
  };
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
        <span className="text-sm text-slate-300">{cfg.name}</span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold ${sz}`}
      style={{ background: cfg.bg, color: cfg.color }}
      title={cfg.name}
    >
      {cfg.label}
    </span>
  );
}

// ─── Platform filter bar ──────────────────────────────────────────────────────
// Horizontally scrollable on mobile. Each chip shows a brand-colour dot + full
// platform name. The active chip is filled with the platform's brand colour.
// Pass `platforms` to restrict which platforms appear (e.g. only ones in the
// current data set). Omit / pass undefined to show all known platforms.

interface PlatformFilterBarProps {
  selected: string;
  onChange: (p: string) => void;
  platforms?: string[]; // subset to display; defaults to all PLATFORM_CONFIG keys
  showCount?: Record<string, number>; // optional count badge per platform key
}

export function PlatformFilterBar({
  selected,
  onChange,
  platforms,
  showCount,
}: PlatformFilterBarProps) {
  const keys = platforms ?? Object.keys(PLATFORM_CONFIG);

  return (
    // Outer: relative so the fade overlays can be positioned
    <div className="relative">
      {/* Right-edge scroll hint */}
      <div
        className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10"
        style={{ background: "linear-gradient(to left, var(--color-soc-bg, #0a0a1a), transparent)" }}
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {/* ALL chip */}
        <button
          onClick={() => onChange("all")}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
            whitespace-nowrap transition-all border ${
            selected === "all"
              ? "bg-gold border-gold text-soc-bg"
              : "bg-soc-border/20 border-soc-border/40 text-slate-400 hover:border-soc-border-bright hover:text-slate-200"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
          All Platforms
          {showCount?.["all"] !== undefined && (
            <span className="ml-0.5 opacity-60 font-normal">({showCount["all"]})</span>
          )}
        </button>

        {keys.map((key) => {
          const cfg = PLATFORM_CONFIG[key] ?? {
            label: key.slice(0, 2).toUpperCase(), name: key, color: "#fff", bg: "#555",
          };
          const isActive = selected === key;

          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              style={isActive ? { background: cfg.bg, color: cfg.color, borderColor: cfg.bg } : undefined}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                font-semibold whitespace-nowrap transition-all border ${
                isActive
                  ? "border-transparent"
                  : "bg-soc-border/20 border-soc-border/40 text-slate-400 hover:border-soc-border-bright hover:text-slate-200"
              }`}
            >
              {/* Brand colour dot (always visible, even when inactive) */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-black/20"
                style={{ background: cfg.bg }}
              />
              {cfg.name}
              {showCount?.[key] !== undefined && (
                <span className="ml-0.5 opacity-60 font-normal">({showCount[key]})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
