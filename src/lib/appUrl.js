/**
 * Where this copy of Podsta is mounted.
 * Localhost and CI use `/`. GitHub Pages uses `/Podsta/`.
 */

export function appRoot(origin, basePath = '/') {
  const root = String(origin || '').replace(/\/$/, '');
  const base = String(basePath || '/');
  if (base === '/') return root;
  return `${root}${base.replace(/\/$/, '')}`;
}

export function currentBasePath() {
  const base = import.meta.env?.BASE_URL;
  return base || '/';
}

export function currentAppRoot() {
  const origin = typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin;
  return appRoot(origin, currentBasePath());
}

export function appUrl(path = '/') {
  const root = currentAppRoot();
  if (!path || path === '/') return `${root}/`;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${root}${suffix}`;
}

/** React Router wants a leading slash and no trailing slash. `/` stays `/`. */
export function routerBasename(baseUrl = '/') {
  const trimmed = String(baseUrl || '/').replace(/\/$/, '');
  return trimmed || '/';
}
