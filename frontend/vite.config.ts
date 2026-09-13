import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Node typings for the preview-proxy config below (no @types/node dependency needed).
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/live': { target: 'ws://localhost:3000', ws: true },
    },
  },
  // `vite preview` (used by the frontend container) needs the same proxy so
  // the relative VITE_API_URL="/api/v1" reaches backend-core.
  preview: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.BACKEND_ORIGIN ?? 'http://localhost:3000', changeOrigin: true },
      '/live': { target: process.env.BACKEND_WS_ORIGIN ?? 'ws://localhost:3000', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.spec.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
  },
});
