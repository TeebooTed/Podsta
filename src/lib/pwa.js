/**
 * Register the production service worker. Vite's dev server does not emit one.
 * Registration is a same-origin script so the Content-Security-Policy allows it.
 */
export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const url = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(url).catch((err) => {
      console.warn('Service worker was not registered', err);
    });
  });
}
