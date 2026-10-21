import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { copySpaFallback } from './scripts/pagesFallback.js';
import { cspPolicy } from './src/lib/cspPolicy.js';

// Vite config for Podsta.
// - React plugin for JSX/Fast Refresh.
// - `define: { global: 'window' }` is required because some Inrupt deps
//   reference `global` (a Node-ism) at module load time.
// - PAGES_BASE is set only by the GitHub Pages workflow (`/Podsta/`).
//   Localhost and CI stay at `/` so existing OIDC registrations keep working.
const base = process.env.PAGES_BASE || '/';
// Pages stays https-only. Localhost and CI may use a local pod host.
const policy = cspPolicy({ allowLocalHttp: !process.env.PAGES_BASE });

function pagesSpaFallback(basePath) {
  return {
    name: 'pages-spa-fallback',
    apply: 'build',
    closeBundle() {
      copySpaFallback('dist', basePath);
    },
  };
}

function contentSecurityPolicy() {
  return {
    name: 'podsta-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const tag = `    <meta http-equiv="Content-Security-Policy" content="${policy}" />`;
      return html.replace('</head>', `${tag}\n  </head>`);
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    pagesSpaFallback(base),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon-180.png', 'icons/*.png'],
      workbox: {
        importScripts: ['notice-click.js'],
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2,txt,json}'],
        globIgnores: ['**/*.map', '**/solid-client-id.json'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.+\.(?:png|jpe?g|gif|webp|avif)(?:\?.*)?$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'podsta-images',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  define: {
    global: 'window',
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2022',
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
