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
        // ── Brand Cyan/Teal ──
        cyan: {
          50:  "#ECFEFF",
          100: "#CFFAFE",
          200: "#A5F3FC",
          300: "#67E8F9",
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
          700: "#0E7490",
          800: "#155E75",
          900: "#164E63",
        },
        // ── Intelligence Blue ──
        blue: {
          400: "#60A5FA",
          500: "#3B82F6",
        },
        // ── Surfaces (dark) ──
        surface: {
          void:    "#060A12",
          base:    "#0A0E1A",
          raised:  "#111827",
          overlay: "#1E293B",
          float:   "#334155",
        },
        // ── Threat severity ──
        threat: {
          critical: "#EF4444",
          high:     "#F97316",
          medium:   "#EAB308",
          low:      "#22C55E",
          none:     "#0D9488",
        },
        // ── Legacy aliases for existing pages ──
        radar: {
          bg:         "#0A0E1A",
          sidebar:    "#060A12",
          card:       "#111827",
          border:     "#1E293B",
          "border-2": "#334155",
          cyan:       "#22D3EE",
          "cyan-dim": "#06B6D4",
          green:      "#22C55E",
          "green-dim":"#16A34A",
          blue:       "#3B82F6",
          red:        "#EF4444",
          yellow:     "#EAB308",
          orange:     "#F97316",
          purple:     "#8B5CF6",
          muted:      "#64748B",
          text:       "#F1F5F9",
        },
      },
      fontFamily: {
        display: ["'Clash Display'", "'Inter'", "system-ui", "sans-serif"],
        sans:    ["'Geist'", "'Inter'", "system-ui", "sans-serif"],
        mono:    ["'Geist Mono'", "'JetBrains Mono'", "Consolas", "monospace"],
      },
      fontSize: {
        "11": ["11px", { lineHeight: "16px", letterSpacing: "0.06em" }],
        "12": ["12px", { lineHeight: "18px", letterSpacing: "0.02em" }],
        "14": ["14px", { lineHeight: "22px" }],
        "16": ["16px", { lineHeight: "26px" }],
        "18": ["18px", { lineHeight: "28px" }],
        "22": ["22px", { lineHeight: "30px" }],
        "28": ["28px", { lineHeight: "34px" }],
        "38": ["38px", { lineHeight: "44px" }],
        "54": ["54px", { lineHeight: "58px" }],
      },
      borderRadius: {
        sm:   "6px",
        md:   "10px",
        lg:   "16px",
        xl:   "24px",
        full: "9999px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":    "fadeIn 300ms ease-out",
        "card-reveal": "cardReveal 300ms ease-out forwards",
        "slide-in-right": "slideInRight 200ms ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        cardReveal: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%":   { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
