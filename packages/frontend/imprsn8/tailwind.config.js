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
          bg: "#06060f",
          card: "#0f0f1e",
          border: "#1e1b4b",
          purple: "#8b5cf6",
          "purple-dim": "#7c3aed",
          pink: "#ec4899",
          muted: "#6b7280",
        },
      },
      animation: {
        "gradient-x": "gradient-x 4s ease infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        "gradient-x": {
          "0%, 100%": { "background-position": "0% 50%" },
          "50%": { "background-position": "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
