import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plainText } from '../src/lib/text.js';
import { safeHttpUrl, safeIssuer } from '../src/lib/urls.js';
import { normalizeWebId } from '../src/lib/webId.js';
import { describePodFailure, podStatus } from '../src/lib/errors.js';
import { hasStoredSession, SESSION_PREFIX } from '../src/lib/sessionHint.js';
import { snapshotKey } from '../src/lib/offlineStore.js';
import { fittedSize, MAX_IMAGE_EDGE, THUMB_EDGE } from '../src/lib/photoAdjust.js';
import { cardPhotoUrls } from '../src/lib/album.js';
import { CSP_HEADER, CSP_POLICY, cspPolicy } from '../src/lib/cspPolicy.js';

test('captions and comments drop tags and script URLs', () => {
  assert.equal(plainText('  hello "there"  '), 'hello "there"');
  assert.equal(plainText('I <3 this'), 'I <3 this');
  assert.equal(plainText('<script>alert(1)</script>nice'), 'alert(1)nice');
  assert.equal(plainText('<img src=x onerror=alert(1)>'), '');
  assert.equal(plainText('javascript:alert(1)'), 'alert(1)');
  assert.equal(plainText('line\u0000break'), 'linebreak');
});

test('pod and issuer URLs stay on https, with localhost as the http exception', () => {
  assert.equal(safeIssuer('https://solidcommunity.net/login'), 'https://solidcommunity.net');
  assert.equal(safeIssuer('http://localhost:3000/'), 'http://localhost:3000');
  assert.equal(safeIssuer('http://evil.example'), null);
  assert.equal(safeIssuer('javascript:alert(1)'), null);
  assert.equal(safeIssuer('https://user:pass@solid.example'), null);
  assert.equal(normalizeWebId('http://alice.example/profile/card#me'), null);
  assert.equal(
    normalizeWebId('http://127.0.0.1:3000/alice/profile/card'),
    'http://127.0.0.1:3000/alice/profile/card#me',
  );
  assert.equal(safeHttpUrl('data:text/html,hi'), null);
});

test('pod failures become a sentence a person can act on', () => {
  assert.equal(podStatus({ statusCode: 401 }), 401);
  assert.match(describePodFailure({ status: 401 }), /sign-in expired/i);
  assert.match(describePodFailure({ response: { status: 429 } }), /busy/i);
  assert.match(describePodFailure(new Error('Failed to fetch')), /isn't answering/i);
});

test('a stored Solid session is detected without loading the client', () => {
  const keys = ['other', `${SESSION_PREFIX}currentSession`];
  const storage = {
    length: keys.length,
    key: (index) => keys[index] || null,
  };
  assert.equal(hasStoredSession(storage, ''), true);
  assert.equal(hasStoredSession({ length: 0, key: () => null }, ''), false);
  assert.equal(hasStoredSession({ length: 0, key: () => null }, '?code=abc&state=xyz'), true);
  assert.equal(
    snapshotKey('feed', 'https://ada.example/profile/card#me').startsWith('feed:'),
    true,
  );
});

test('photos are scaled down and cards prefer thumbnails', () => {
  assert.deepEqual(fittedSize(4000, 2000, MAX_IMAGE_EDGE), { width: 2048, height: 1024 });
  assert.deepEqual(fittedSize(800, 600, THUMB_EDGE), { width: 640, height: 480 });
  assert.deepEqual(fittedSize(100, 80, THUMB_EDGE), { width: 100, height: 80 });
  const post = {
    type: 'photo',
    images: ['https://ada.example/full.jpg', 'javascript:alert(1)'],
    thumbnails: ['https://ada.example/full.thumb.jpg'],
  };
  assert.deepEqual(cardPhotoUrls(post), ['https://ada.example/full.thumb.jpg']);
});

test('the Pages policy matches the header policy, plus frame-ancestors', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const header = vercel.headers[0].headers.find((item) => item.key === 'Content-Security-Policy');
  assert.equal(header.value, CSP_HEADER);
  assert.equal(header.value.includes("script-src 'self'"), true);
  assert.equal(header.value.includes('unsafe-eval'), false);
  assert.equal(header.value.includes('fonts.googleapis.com'), false);
  assert.equal(CSP_POLICY.includes('http://localhost'), false);
  const local = cspPolicy({ allowLocalHttp: true });
  assert.equal(local.includes('connect-src \'self\' https: wss: http://localhost:* http://127.0.0.1:*'), true);
  assert.equal(local.includes('http://localhost:*'), true);
});
