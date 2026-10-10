import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copySpaFallback } from './scripts/pagesFallback.js';

// Vite config for Podsta.
// - React plugin for JSX/Fast Refresh.
// - `define: { global: 'window' }` is required because some Inrupt deps
//   reference `global` (a Node-ism) at module load time.
// - PAGES_BASE is set only by the GitHub Pages workflow (`/Podsta/`).
//   Localhost and CI stay at `/` so existing OIDC registrations keep working.
const base = process.env.PAGES_BASE || '/';

function pagesSpaFallback(basePath) {
  return {
    name: 'pages-spa-fallback',
    apply: 'build',
    closeBundle() {
      copySpaFallback('dist', basePath);
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), pagesSpaFallback(base)],
  define: {
    global: 'window',
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'inrupt-vendor': [
            '@inrupt/solid-client',
            '@inrupt/solid-client-authn-browser',
            '@inrupt/vocab-common-rdf',
          ],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
