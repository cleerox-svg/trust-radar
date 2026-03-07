import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    join(__dirname, "index.html"),
    join(__dirname, "src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        // All surface + accent tokens use CSS variables so dark/light themes
        // switch instantly without touching component files.
        // Pattern: rgb(var(--x) / <alpha-value>) preserves opacity modifiers.
        brand: {
          bg:     "rgb(var(--surface-bg)   / <alpha-value>)",
          card:   "rgb(var(--surface-card) / <alpha-value>)",
          border: "rgb(var(--surface-border) / <alpha-value>)",
          muted:  "rgb(var(--text-muted)   / <alpha-value>)",
          purple: "rgb(var(--accent)       / <alpha-value>)",
          pink:   "rgb(var(--accent-pink)  / <alpha-value>)",
        },
        // soc-* unified with brand-* (same vars)
        soc: {
          bg:              "rgb(var(--surface-bg)           / <alpha-value>)",
          card:            "rgb(var(--surface-card)         / <alpha-value>)",
          border:          "rgb(var(--surface-border)       / <alpha-value>)",
          "border-bright": "rgb(var(--surface-border-bright) / <alpha-value>)",
          navy:            "rgb(var(--surface-navy)         / <alpha-value>)",
        },
        // gold remapped to primary accent (purple family) from previous commit
        gold: {
          DEFAULT: "rgb(var(--accent)       / <alpha-value>)",
          dim:     "rgb(var(--accent-dim)   / <alpha-value>)",
          muted:   "rgb(var(--accent-muted) / <alpha-value>)",
          light:   "rgb(var(--accent-light) / <alpha-value>)",
        },
        purple: {
          DEFAULT: "rgb(var(--accent)        / <alpha-value>)",
          dim:     "rgb(var(--accent-dim)    / <alpha-value>)",
          light:   "rgb(var(--accent-light)  / <alpha-value>)",
          subtle:  "rgb(var(--surface-navy)  / <alpha-value>)",
        },
        // Semantic/status colors — keep hardcoded, no theming needed
        threat: {
          critical: "#FF3B3B",
          high:     "#FF8C00",
          medium:   "#F5C518",
          low:      "#4CAF50",
        },
        status: {
          live:      "#22C55E",
          idle:      "#64748B",
          error:     "#EF4444",
          scheduled: "#3B82F6",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        syne: ["Syne", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-dot": "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "ping-slow":  "ping 3s cubic-bezier(0,0,0.2,1) infinite",
        "fade-in":    "fadeIn 0.3s ease",
        "slide-in":   "slideIn 0.25s ease",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideIn: { from: { opacity: "0", transform: "translateX(-8px)" }, to: { opacity: "1", transform: "translateX(0)" } },
      },
    },
  },
  plugins: [],
};
