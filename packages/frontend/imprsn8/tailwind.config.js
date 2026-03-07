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
        brand: {
          bg:     "#07071a",
          card:   "#0f0f1e",
          border: "#1e1b4b",
          muted:  "#6b7280",
          purple: "#8b5cf6",
          pink:   "#ec4899",
        },
        // Unified with brand-* so authenticated and public pages share one palette
        soc: {
          bg:              "#07071a",
          card:            "#0f0f1e",
          border:          "#1e1b4b",
          "border-bright": "#2d2a6a",
          navy:            "#0d0d2b",
        },
        // Remapped from gold → brand-purple family so all 'gold' references
        // across authenticated pages automatically adopt the purple/pink palette
        gold: {
          DEFAULT: "#8b5cf6",   // brand-purple
          dim:     "#7c3aed",   // deeper purple
          muted:   "#4c1d95",   // dark purple
          light:   "#a78bfa",   // lighter violet
        },
        purple: {
          DEFAULT: "#8b5cf6",   // aligned with brand-purple
          dim:     "#7c3aed",
          light:   "#a78bfa",
          subtle:  "#1e1b4b",
        },
        threat: {
          critical:  "#FF3B3B",
          high:      "#FF8C00",
          medium:    "#F5C518",
          low:       "#4CAF50",
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
