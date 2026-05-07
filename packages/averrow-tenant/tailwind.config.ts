import type { Config } from 'tailwindcss';

// averrow-tenant inherits the Averrow design language but does NOT
// share averrow-ui's frozen widgets (ThreatMap, ExposureGauge, etc.).
// Eventually the design-system primitives port into this package via
// a workspace import; for now we redeclare the minimum.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-page':    '#060A14',
        'bg-card':    'rgba(22,30,48,0.85)',
        'bg-sidebar': 'rgba(10,16,30,0.96)',
        // Accents
        'amber':      '#E5A832',
        'amber-dim':  '#B8821F',
        'red':        '#C83C3C',
        'red-dim':    '#8B1A1A',
        'green':      '#3CB878',
        // Severity
        'sev-critical': '#f87171',
        'sev-high':     '#fb923c',
        'sev-medium':   '#fbbf24',
        'sev-low':      '#60a5fa',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
