import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    join(__dirname, "index.html"),
    join(__dirname, "src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        /* ── Primary (Electric Blue) ──────────────── */
        primary: {
          DEFAULT: "#3B82F6",
          hover:   "#2563EB",
          dim:     "#1D4ED8",
          light:   "#60A5FA",
        },
        /* ── Secondary Cyan (status/health only) ──── */
        cyan: {
          50:  "#ECFEFF",
          100: "#CFFAFE",
          200: "#A5F3FC",
          300: "#67E8F9",
          400: "#22D3EE",   // SECONDARY — status/health indicators only
          500: "#06B6D4",   // Interactive states
          600: "#0891B2",
          DEFAULT: "#22D3EE",
        },
        /* ── Intelligence Blue ─────────────────────── */
        blue: {
          400: "#60A5FA",
          500: "#3B82F6",
          DEFAULT: "#3B82F6",
        },
        /* ── Threat Severity ──────────────────────── */
        threat: {
          critical: "#EF4444",
          high:     "#F97316",
          medium:   "#EAB308",
          low:      "#22C55E",
          none:     "#06B6D4",
        },
        /* ── Agent/Status ─────────────────────────── */
        status: {
          live:      "#22C55E",
          idle:      "#64748B",
          error:     "#EF4444",
          scheduled: "#06B6D4",
          running:   "#8B5CF6",
        },
        /* ── Surfaces (via CSS custom properties) ─── */
        surface: {
          void:    "var(--surface-void)",
          base:    "var(--surface-base)",
          raised:  "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
          float:   "var(--surface-float)",
        },
        /* ── Text (via CSS custom properties) ──────── */
        txt: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary:  "var(--text-tertiary)",
          disabled:  "var(--text-disabled)",
        },
        /* ── Legacy radar-* aliases (backward compat) */
        radar: {
          bg:         "var(--surface-base)",
          sidebar:    "var(--surface-void)",
          card:       "var(--surface-raised)",
          border:     "var(--border-default-hex)",
          "border-2": "var(--border-strong-hex)",
          primary:    "#3B82F6",  // primary alias (replaces cyan as primary)
          cyan:       "#22D3EE",  // retained for status/health use
          "cyan-dim": "#06B6D4",
          green:      "#22C55E",
          "green-dim":"#16A34A",
          blue:       "#3B82F6",
          red:        "#EF4444",
          yellow:     "#EAB308",
          orange:     "#F97316",
          purple:     "#8B5CF6",
          muted:      "var(--text-secondary)",
          text:       "var(--text-primary)",
        },
      },

      fontFamily: {
        sans:    ["Geist", "Inter", "system-ui", "sans-serif"],
        mono:    ["Geist Mono", "JetBrains Mono", "Consolas", "monospace"],
        display: ["Clash Display", "Geist", "system-ui", "sans-serif"],
      },

      boxShadow: {
        "glow-primary": "0 0 60px rgba(59, 130, 246, 0.20)",
        "glow-cyan":    "0 0 60px rgba(34, 211, 238, 0.12)",
        "glow-blue":    "0 0 60px rgba(59, 130, 246, 0.15)",
        "glow-red":     "0 0 40px rgba(239, 68, 68, 0.18)",
        "card-raised":  "0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)",
      },

      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },

      spacing: {
        /* 4pt grid system */
        "0.5": "2px",
        "1":   "4px",
        "1.5": "6px",
        "2":   "8px",
        "2.5": "10px",
        "3":   "12px",
        "4":   "16px",
        "5":   "20px",
        "6":   "24px",
        "8":   "32px",
        "10":  "40px",
        "12":  "48px",
        "16":  "64px",
        "20":  "80px",
      },

      fontSize: {
        "2xs": ["10px", { lineHeight: "1.4" }],
        xs:    ["12px", { lineHeight: "1.5" }],
        sm:    ["14px", { lineHeight: "1.5" }],
        base:  ["16px", { lineHeight: "1.5" }],
        lg:    ["18px", { lineHeight: "1.4" }],
        xl:    ["20px", { lineHeight: "1.3" }],
        "2xl": ["24px", { lineHeight: "1.2" }],
        "3xl": ["30px", { lineHeight: "1.2" }],
        "4xl": ["36px", { lineHeight: "1.1" }],
        "5xl": ["48px", { lineHeight: "1.1" }],
      },

      maxWidth: {
        content: "1440px",
      },

      animation: {
        "fade-in":     "fadeIn 0.3s ease",
        "slide-in":    "slideIn 0.25s ease",
        "slide-up":    "slideUp 0.3s ease",
        "card-reveal": "cardReveal 300ms ease-out forwards",
        "pulse-slow":  "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow":   "ping 3s cubic-bezier(0,0,0.2,1) infinite",
        "spin-slow":   "spin 2s linear infinite",
      },

      keyframes: {
        fadeIn:     { from: { opacity: "0" },                                         to: { opacity: "1" } },
        slideIn:    { from: { opacity: "0", transform: "translateX(-8px)" },          to: { opacity: "1", transform: "translateX(0)" } },
        slideUp:    { from: { opacity: "0", transform: "translateY(8px)" },           to: { opacity: "1", transform: "translateY(0)" } },
        cardReveal: { from: { opacity: "0", transform: "translateY(8px)" },           to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
