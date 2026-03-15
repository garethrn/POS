/**
 * vite.web.config.js
 *
 * Vite configuration for the **web / cPanel** build.
 * Produces a browser-ready SPA in `dist-web/` that connects to the
 * Express API server over HTTP (no Electron required).
 *
 * Usage:
 *   # Build (set VITE_API_URL to your API server URL, or leave empty
 *   # if the API is served from the same origin as the static files)
 *   VITE_API_URL=https://api.yourstore.com npm run build:web
 *
 *   # Preview locally
 *   npm run preview:web
 */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    // Use absolute paths — required for standard HTTP hosting
    // (unlike the Electron build which uses relative `./` paths for file://)
    base: env.VITE_BASE_PATH || '/',

    build: {
      outDir: 'dist-web',
      emptyOutDir: true,
    },

    // Expose the API URL to the browser bundle
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || ''),
    },

    // Development proxy: forward /api/* and /health to the local Express server
    // so you can run `npm run dev:web` without CORS issues during development.
    server: {
      port: 5174,
      proxy: {
        '/api':    { target: env.VITE_DEV_API || 'http://localhost:3001', changeOrigin: true },
        '/health': { target: env.VITE_DEV_API || 'http://localhost:3001', changeOrigin: true },
      },
    },
  };
});
