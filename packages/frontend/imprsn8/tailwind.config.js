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
        /* ── Brand Gold ─────────────────────────── */
        gold: {
          50:  "#FFFBF0",
          100: "#FFF3CC",
          200: "#FFE08A",
          300: "#FFC947",
          400: "#F0A500",
          500: "#C47F00",
          600: "#8A5900",
          DEFAULT: "#F0A500",
          dim:     "#C47F00",
          muted:   "#8A5900",
          light:   "#FFC947",
        },
        /* ── Intelligence Violet ────────────────── */
        violet: {
          100: "#EDE9FE",
          200: "#C4B5FD",
          300: "#8B6FF5",
          400: "#6D40ED",
          500: "#5127C4",
          600: "#3516A0",
          DEFAULT: "#6D40ED",
          dim:     "#5127C4",
          light:   "#8B6FF5",
        },
        /* ── Threat semantic ─────────────────────── */
        threat: {
          critical: "#E8163B",
          high:     "#F97316",
          medium:   "#EF9F0A",
          low:      "#16A34A",
          none:     "#0D9488",
        },
        /* ── Status ──────────────────────────────── */
        status: {
          live:      "#22C55E",
          idle:      "#6B5F82",
          error:     "#E8163B",
          scheduled: "#6D40ED",
        },
        /* ── Legacy brand aliases (backward compat) ─ */
        brand: {
          bg:     "rgb(var(--surface-bg)   / <alpha-value>)",
          card:   "rgb(var(--surface-card) / <alpha-value>)",
          border: "rgb(var(--surface-border) / <alpha-value>)",
          muted:  "rgb(var(--text-muted)   / <alpha-value>)",
          purple: "rgb(var(--accent)       / <alpha-value>)",
          pink:   "rgb(var(--accent-pink)  / <alpha-value>)",
        },
        soc: {
          bg:              "rgb(var(--surface-bg)           / <alpha-value>)",
          card:            "rgb(var(--surface-card)         / <alpha-value>)",
          border:          "rgb(var(--surface-border)       / <alpha-value>)",
          "border-bright": "rgb(var(--surface-border-bright) / <alpha-value>)",
          navy:            "rgb(var(--surface-navy)         / <alpha-value>)",
        },
        purple: {
          DEFAULT: "rgb(var(--accent)        / <alpha-value>)",
          dim:     "rgb(var(--accent-dim)    / <alpha-value>)",
          light:   "rgb(var(--accent-light)  / <alpha-value>)",
          subtle:  "rgb(var(--surface-navy)  / <alpha-value>)",
        },
      },

      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["Syne", "system-ui", "sans-serif"],
        syne:    ["Syne", "system-ui", "sans-serif"],
      },

      boxShadow: {
        "glow-gold":   "0 0 60px rgba(240, 165, 0, 0.12)",
        "glow-violet": "0 0 60px rgba(109, 64, 237, 0.15)",
        "glow-red":    "0 0 40px rgba(232, 22, 59, 0.18)",
        "card-raised": "0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)",
      },

      animation: {
        "pulse-dot":   "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "ping-slow":   "ping 3s cubic-bezier(0,0,0.2,1) infinite",
        "fade-in":     "fadeIn 0.3s ease",
        "slide-in":    "slideIn 0.25s ease",
        "card-reveal": "cardReveal 300ms ease-out forwards",
      },

      keyframes: {
        fadeIn:     { from: { opacity: "0" }, to: { opacity: "1" } },
        slideIn:    { from: { opacity: "0", transform: "translateX(-8px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        cardReveal: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },

      maxWidth: {
        content: "1440px",
      },

      fontSize: {
        11: ["11px", { lineHeight: "1.4" }],
        18: ["18px", { lineHeight: "1.3" }],
        22: ["22px", { lineHeight: "1.2" }],
        38: ["38px", { lineHeight: "1.1" }],
      },
    },
  },
  plugins: [],
};
