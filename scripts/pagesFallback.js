import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GitHub Pages serves a missing path as 404.html and leaves the address in
 * the bar. Copying the built index.html makes React Router see /invite and
 * /post. The OIDC return stays on the real index.html, because a redirect
 * URI cannot include a fragment.
 */
export function copySpaFallback(distDir, base) {
  const normalized = String(base || '/');
  if (normalized === '/' || normalized === '') return false;
  const indexPath = join(distDir, 'index.html');
  if (!existsSync(indexPath)) return false;
  copyFileSync(indexPath, join(distDir, '404.html'));
  return true;
}
