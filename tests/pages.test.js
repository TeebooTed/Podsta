import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appPostUrl } from '../src/lib/navigation.js';
import { inviteUrl } from '../src/lib/invite.js';
import { appRoot, routerBasename } from '../src/lib/appUrl.js';
import { clientIdDocument, oidcLoginRequest, PAGES_ORIGIN } from '../src/lib/clientId.js';
import { copySpaFallback } from '../scripts/pagesFallback.js';

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

test('a project-site build copies index.html to 404.html', () => {
  const dir = mkdtempSync(join(tmpdir(), 'podsta-pages-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
  assert.equal(copySpaFallback(dir, '/'), false);
  assert.equal(copySpaFallback(dir, '/Podsta/'), true);
  assert.equal(readFileSync(join(dir, '404.html'), 'utf8'), readFileSync(join(dir, 'index.html'), 'utf8'));
});
