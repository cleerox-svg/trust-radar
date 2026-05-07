import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// averrow-tenant — customer-facing v3 app. Builds into the worker's
// /tenant assets path so Cloudflare can serve it from a single
// origin alongside averrow-ops (the staff back-office at /v2). The
// final routing decision (subdomain vs path) lands in Phase D.
export default defineConfig({
  plugins: [react()],
  base: '/tenant/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../trust-radar/public/tenant',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
