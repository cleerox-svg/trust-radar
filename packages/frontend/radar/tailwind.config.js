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
          bg: "#050810",
          card: "#0d1424",
          border: "#1a2744",
          green: "#00ff88",
          "green-dim": "#00cc6a",
          blue: "#0ea5e9",
          red: "#ef4444",
          yellow: "#f59e0b",
          muted: "#64748b",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
