import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for Podsta.
// - React plugin for JSX/Fast Refresh.
// - `define: { global: 'window' }` is required because some Inrupt deps
//   reference `global` (a Node-ism) at module load time.
// - Polyfill alias for `buffer` is included for the same reason; if you
//   hit a "Buffer is not defined" error on auth, uncomment the resolve line.
build: {
     target: 'es2022',
     cssCodeSplit: false,
     // existing
   }
export default defineConfig({
  plugins: [react()],
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
