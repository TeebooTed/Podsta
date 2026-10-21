import test from 'node:test';
import assert from 'node:assert/strict';
import { aclGrantsPublicRead } from '../src/lib/aclTurtle.js';
import { PATHS, sectionFromPath } from '../src/lib/navigation.js';
import {
  isSaved,
  loadSaves,
  parseSaves,
  serializeSaves,
  setSaved,
  withSave,
} from '../src/lib/saves.js';

const ADA = 'https://ada.example/profile/card#me';
const POST = 'https://ada.example/podsta/posts/1.ttl';
const OTHER = 'https://bob.example/podsta/posts/2.ttl';

test('a saved post round-trips as a URL and rejects a script URL', () => {
  const turtle = serializeSaves([{ postUrl: POST, savedAt: '2026-04-01T00:00:00.000Z' }]);
  assert.equal(parseSaves(turtle)[0].postUrl, POST);
  assert.equal(parseSaves(turtle)[0].savedAt, '2026-04-01T00:00:00.000Z');
  assert.equal(turtle.includes('caption'), false);
  assert.equal(turtle.includes('schema:text'), false);
  assert.throws(() => serializeSaves([{ postUrl: 'javascript:alert(1)', savedAt: '2026-04-01T00:00:00.000Z' }]));
  assert.equal(parseSaves('not a save').length, 0);
});

test('saving twice keeps one row, and removing one leaves the others', () => {
  const once = withSave([], POST, true, '2026-04-01T00:00:00.000Z');
  const twice = withSave(once, POST, true, '2026-04-02T00:00:00.000Z');
  assert.equal(twice.length, 1);
  assert.equal(twice[0].savedAt, '2026-04-02T00:00:00.000Z');
  const both = withSave(twice, OTHER, true, '2026-04-03T00:00:00.000Z');
  assert.equal(withSave(both, POST, false).length, 1);
  assert.equal(isSaved(both, POST), true);
  assert.equal(isSaved(both, 'https://ada.example/podsta/posts/missing.ttl'), false);
});

test('saved posts have their own route and stay off the main tab bars', () => {
  assert.equal(PATHS.saved, '/saved');
  assert.equal(sectionFromPath('/saved'), 'saved');
  assert.equal(sectionFromPath('/'), 'home');
});

test('an unreadable saved list is not treated as empty', async () => {
  const denied = async () => new Response('no', { status: 403 });
  await assert.rejects(() => loadSaves('https://ada.example/', denied), /Could not read your saved posts/);
  const missing = async () => new Response('', { status: 404 });
  assert.deepEqual(await loadSaves('https://ada.example/', missing), []);
});

test('a save writes only the URL and an owner-only access file', async () => {
  const puts = [];
  const session = {
    info: { webId: ADA },
    fetch: async (url, init = {}) => {
      const method = init.method || 'GET';
      const target = String(url);
      let body = '';
      if (init.body && typeof init.body.text === 'function') body = await init.body.text();
      else if (typeof init.body === 'string') body = init.body;
      puts.push({ method, target, body });
      return new Response('', { status: method === 'PUT' ? 201 : 404 });
    },
  };
  const entries = await setSaved({
    podUrl: 'https://ada.example/',
    session,
    postUrl: OTHER,
    saved: true,
    knownEntries: [{ postUrl: POST, savedAt: '2026-04-01T00:00:00.000Z' }],
    savedAt: '2026-04-04T00:00:00.000Z',
  });
  assert.equal(entries.length, 2);
  const file = puts.find((call) => call.method === 'PUT' && call.target.endsWith('/podsta/favorites.ttl'));
  assert.ok(file);
  assert.equal(file.body.includes(OTHER), true);
  assert.equal(file.body.includes(POST), true);
  assert.equal(file.body.includes('caption'), false);
  const acl = puts.find((call) => call.method === 'PUT' && call.target.endsWith('/podsta/favorites.ttl.acl'));
  assert.ok(acl);
  assert.equal(aclGrantsPublicRead(acl.body), false);
  assert.equal(acl.body.includes(ADA), true);
});

test('a save is refused when the existing list was not read', async () => {
  const session = {
    info: { webId: ADA },
    fetch: async () => new Response('', { status: 201 }),
  };
  await assert.rejects(
    () => setSaved({ podUrl: 'https://ada.example/', session, postUrl: POST, saved: true }),
    /Could not read your saved posts/,
  );
});
