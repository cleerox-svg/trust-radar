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
        radar: {
          bg:         "#080c14",
          sidebar:    "#0c1220",
          card:       "#0f1726",
          border:     "#1a2744",
          "border-2": "#243352",
          cyan:       "#00d4d4",
          "cyan-dim": "#00a8a8",
          green:      "#00ff88",
          "green-dim":"#00cc6a",
          blue:       "#0ea5e9",
          red:        "#ff4444",
          yellow:     "#f59e0b",
          orange:     "#f97316",
          purple:     "#8b5cf6",
          muted:      "#4a5c7a",
          text:       "#c8d8f0",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":    "fadeIn 0.3s ease",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
