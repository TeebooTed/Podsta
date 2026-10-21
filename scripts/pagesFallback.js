import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PAGES_HOME = 'https://teebooted.github.io/Podsta/';
export const PAGES_START = 'https://teebooted.github.io/Podsta/start/';

/**
 * GitHub Pages serves a missing path as 404.html and leaves the address in
 * the bar. Copying the built index.html makes React Router see /invite and
 * /post. The OIDC return stays on the real index.html, because a redirect
 * URI cannot include a fragment.
 * `/start/` is a real file so that guide can be crawled with status 200.
 */
export function copySpaFallback(distDir, base) {
  const normalized = String(base || '/');
  if (normalized === '/' || normalized === '') return false;
  const indexPath = join(distDir, 'index.html');
  if (!existsSync(indexPath)) return false;
  const html = readFileSync(indexPath, 'utf8');
  writeFileSync(join(distDir, '404.html'), html);
  const startDir = join(distDir, 'start');
  mkdirSync(startDir, { recursive: true });
  writeFileSync(join(startDir, 'index.html'), withStartCanonical(html));
  return true;
}

function withStartCanonical(html) {
  return html
    .replace(
      `<link rel="canonical" href="${PAGES_HOME}" />`,
      `<link rel="canonical" href="${PAGES_START}" />`,
    )
    .replace(
      `<meta property="og:url" content="${PAGES_HOME}" />`,
      `<meta property="og:url" content="${PAGES_START}" />`,
    );
}
