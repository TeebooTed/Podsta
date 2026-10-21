import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const home = 'https://teebooted.github.io/Podsta/';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const start = readFileSync(join(dist, 'start', 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
const client = JSON.parse(readFileSync(join(dist, 'solid-client-id.json'), 'utf8'));
const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
const llms = readFileSync(join(dist, 'llms.txt'), 'utf8');
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!html.includes('/Podsta/')) fail('index.html is missing the /Podsta/ base');
if (!html.includes(`rel="canonical" href="${home}"`)) fail('home canonical is missing');
if (!html.includes('property="og:image" content="https://teebooted.github.io/Podsta/podsta-share-1200x630.png"')) {
  fail('og:image is missing');
}
if (!html.includes('name="twitter:card" content="summary_large_image"')) fail('twitter card is missing');
if (!html.includes('"@type": "SoftwareApplication"')) fail('JSON-LD SoftwareApplication is missing');
if (!html.includes('<noscript>')) fail('noscript fallback is missing');
if (readFileSync(join(dist, '404.html'), 'utf8') !== html) fail('404.html is not the app shell');
if (!start.includes('rel="canonical" href="https://teebooted.github.io/Podsta/start/"')) {
  fail('start canonical is missing');
}
if (manifest.start_url !== './' || manifest.scope !== './') fail('manifest scope is not ./');
if (manifest.theme_color !== '#2B1B3D' || manifest.background_color !== '#FFF7EE') {
  fail('manifest colors are not Plum and Cream');
}
if (!robots.includes(`Sitemap: ${home}sitemap.xml`)) fail('robots.txt has no sitemap');
if (!sitemap.includes(`${home}</loc>`) || !sitemap.includes(`${home}start/`)) fail('sitemap locs are wrong');
if (llms.includes('@')) fail('llms.txt contains an email address');
if (!existsSync(join(dist, 'podsta-share-1200x630.png'))) fail('share image was not copied');
if (!existsSync(join(dist, 'favicon.ico'))) fail('favicon.ico was not copied');
if (client.redirect_uris[0] !== home) fail('Solid redirect URI is not the Pages home');
if (!sw.includes('createHandlerBoundToURL("index.html")')) {
  fail('service worker is missing the app-shell navigation route');
}
const themeAt = html.indexOf('theme-init.js');
const styleAt = html.indexOf('rel="stylesheet"');
const moduleAt = html.indexOf('type="module"');
if (themeAt < 0 || styleAt < 0 || moduleAt < 0 || themeAt < styleAt || themeAt < moduleAt) {
  fail('theme-init.js is blocking discovery of the stylesheet or module');
}

if (process.exitCode) process.exit(process.exitCode);
console.log('Pages build matches /Podsta/');
