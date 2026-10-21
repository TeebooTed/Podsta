/**
 * Register the production service worker. Vite's dev server does not emit one.
 * Registration is a same-origin script so the Content-Security-Policy allows it.
 *
 * A returning visitor already has a controller. When a newer worker takes over,
 * reload once so this page runs the new scripts. The first install has no
 * controller yet, so it does not reload. updateViaCache "none" matters because
 * GitHub Pages caches sw.js and notice-click.js for ten minutes, and the
 * imported click handler is not content-hashed.
 */

export function shouldReloadForServiceWorkerUpdate(hadController, alreadyReloading) {
  return Boolean(hadController) && !alreadyReloading;
}

const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  if (hadController) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!shouldReloadForServiceWorkerUpdate(hadController, reloading)) return;
      reloading = true;
      window.location.reload();
    });
  }

  const register = () => {
    const url = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(url, { updateViaCache: 'none' })
      .then((registration) => {
        const check = () => {
          registration.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
        window.setInterval(check, UPDATE_INTERVAL_MS);
      })
      .catch((err) => {
        console.warn('Service worker was not registered', err);
      });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
