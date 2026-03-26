import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cockpit: '#080E18',
        instrument: '#0C1525',
        console: '#142236',
        bulkhead: '#1A2E48',
        fuselage: '#243A54',
        parchment: '#F0EDE8',
        contrail: '#78A0C8',
        accent: {
          DEFAULT: '#C83C3C',
          hover: '#B03232',
        },
        warning: '#E87040',
        positive: '#3CB878',
        severity: {
          critical: '#C83C3C',
          high: '#E8923C',
          medium: '#DCAA32',
          low: '#78A0C8',
          clear: '#28A050',
        },
        // Orbital Lock logo-extracted colors
        'orbital-teal': '#00d4ff',
        'wing-blue': '#0a8ab5',
        'thrust': '#7aeaff',
        'ring-glow': '#00b8d9',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
