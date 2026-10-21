import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appPostUrl } from '../src/lib/navigation.js';
import { inviteUrl } from '../src/lib/invite.js';
import { appRoot, routerBasename } from '../src/lib/appUrl.js';
import { clientIdDocument, oidcLoginRequest, PAGES_ORIGIN } from '../src/lib/clientId.js';
import { copySpaFallback, PAGES_HOME, PAGES_START } from '../scripts/pagesFallback.js';

const ADA = 'https://ada.solidcommunity.net/profile/card#me';
const POST = 'https://ada.example/podsta/posts/1.ttl';
const PAGES_ROOT = appRoot(PAGES_ORIGIN, '/Podsta/');

test('Pages links include /Podsta and localhost links do not', () => {
  assert.equal(PAGES_ROOT, 'https://teebooted.github.io/Podsta');
  assert.equal(appRoot('http://localhost:5173', '/'), 'http://localhost:5173');
  assert.equal(inviteUrl(PAGES_ROOT, ADA), `${PAGES_ROOT}/invite?webid=${encodeURIComponent(ADA)}`);
  assert.equal(inviteUrl('https://podsta.example', ADA).startsWith('https://podsta.example/invite'), true);
  assert.equal(appPostUrl(PAGES_ROOT, POST), `${PAGES_ROOT}/post?url=${encodeURIComponent(POST)}`);
  assert.equal(routerBasename('/Podsta/'), '/Podsta');
  assert.equal(routerBasename('/'), '/');
});

test('the published client id matches the Pages home and is used only there', () => {
  const published = JSON.parse(readFileSync(new URL('../public/solid-client-id.json', import.meta.url)));
  const document = clientIdDocument();
  assert.deepEqual(published, document);
  assert.equal(document.client_id, 'https://teebooted.github.io/Podsta/solid-client-id.json');
  assert.deepEqual(document.redirect_uris, ['https://teebooted.github.io/Podsta/']);

  const pagesLogin = oidcLoginRequest({
    origin: PAGES_ORIGIN,
    redirectUrl: inviteUrl(PAGES_ROOT, ADA),
    oidcIssuer: 'https://solidcommunity.net',
  });
  assert.equal(pagesLogin.clientId, document.client_id);
  assert.equal(pagesLogin.redirectUrl, 'https://teebooted.github.io/Podsta/');

  const localLogin = oidcLoginRequest({
    origin: 'http://localhost:5173',
    redirectUrl: 'http://localhost:5173/start',
    oidcIssuer: 'https://solidweb.org',
  });
  assert.equal(localLogin.clientId, undefined);
  assert.equal(localLogin.redirectUrl, 'http://localhost:5173/start');

  const custom = oidcLoginRequest({
    origin: PAGES_ORIGIN,
    redirectUrl: 'https://teebooted.github.io/Podsta/',
    oidcIssuer: 'https://example-pod.example',
  });
  assert.equal(custom.clientId, document.client_id);
  assert.equal(custom.redirectUrl, 'https://teebooted.github.io/Podsta/');
});

test('a project-site build copies index.html to 404.html and a crawlable /start/', () => {
  const dir = mkdtempSync(join(tmpdir(), 'podsta-pages-'));
  const html = `<!doctype html><link rel="canonical" href="${PAGES_HOME}" /><meta property="og:url" content="${PAGES_HOME}" /><div id="root"></div>`;
  writeFileSync(join(dir, 'index.html'), html);
  assert.equal(copySpaFallback(dir, '/'), false);
  assert.equal(copySpaFallback(dir, '/Podsta/'), true);
  assert.equal(readFileSync(join(dir, '404.html'), 'utf8'), html);
  const start = readFileSync(join(dir, 'start', 'index.html'), 'utf8');
  assert.match(start, new RegExp(`canonical" href="${PAGES_START}"`));
  assert.match(start, new RegExp(`og:url" content="${PAGES_START}"`));
  assert.equal(start.includes(`canonical" href="${PAGES_HOME}"`), false);
});

test('the public site names itself for crawlers, without an email address', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="canonical" href="https:\/\/teebooted\.github\.io\/Podsta\/"/);
  assert.match(html, /property="og:url" content="https:\/\/teebooted\.github\.io\/Podsta\/"/);
  assert.match(html, /property="og:image" content="https:\/\/teebooted\.github\.io\/Podsta\/podsta-share-1200x630\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /"@type": "SoftwareApplication"/);
  assert.match(html, /<noscript>/);
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.theme_color, '#2B1B3D');
  assert.equal(manifest.background_color, '#FFF7EE');
  assert.equal(manifest.icons[0].src, 'icons/icon-192.png');
  const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/teebooted\.github\.io\/Podsta\/sitemap\.xml/);
  const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  assert.match(sitemap, /https:\/\/teebooted\.github\.io\/Podsta\/</);
  assert.match(sitemap, /https:\/\/teebooted\.github\.io\/Podsta\/start\//);
  const llms = readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');
  assert.equal(llms.includes('@'), false);
  assert.equal(readFileSync(new URL('../public/podsta-share-1200x630.png', import.meta.url)).length > 1000, true);
  assert.equal(readFileSync(new URL('../public/favicon.ico', import.meta.url)).length > 100, true);
});
