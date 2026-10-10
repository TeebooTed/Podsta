import test from 'node:test';
import assert from 'node:assert/strict';
import {
  absorbLikes,
  applyLikeNotices,
  containedLikeUrls,
  likeSetAudience,
  noticeTurtle,
  parseLikeNotice,
  parseLikes,
  presentLikes,
  serializeLikes,
  setOwnLike,
  loadOwnLikes,
} from '../src/lib/likes.js';

const ADA = 'https://ada.example/profile/card#me';
const BOB = 'https://bob.solidcommunity.net/profile/card#me';
const POST = 'https://ada.example/podsta/posts/1.ttl';

test('a like round-trips and rejects a script URL', () => {
  const turtle = serializeLikes([{ postUrl: POST, created: '2026-04-01T00:00:00.000Z' }]);
  assert.equal(parseLikes(turtle)[0].postUrl, POST);
  assert.throws(() => serializeLikes([{ postUrl: 'javascript:alert(1)', created: '2026-04-01T00:00:00.000Z' }]));
  const notice = noticeTurtle({ authorWebId: BOB, postUrl: POST, created: '2026-04-02T00:00:00.000Z' });
  assert.equal(parseLikeNotice(notice).authorWebId, BOB);
  assert.equal(parseLikeNotice(notice).removed, false);
  const removed = noticeTurtle({
    authorWebId: BOB,
    postUrl: POST,
    created: '2026-04-03T00:00:00.000Z',
    removed: true,
  });
  assert.equal(parseLikeNotice(removed).removed, true);
});

test('a Community Solid Server inbox listing is readable without an ldp prefix', () => {
  const inbox = 'https://ada.example/inbox/';
  const turtle = `<> <http://www.w3.org/ns/ldp#contains> <${inbox}like-1>, <${inbox}like-2> .`;
  assert.deepEqual(containedLikeUrls(turtle, inbox), [`${inbox}like-1`, `${inbox}like-2`]);
  const prefixed = `@prefix ldp: <http://www.w3.org/ns/ldp#> .\n<> ldp:contains <${inbox}like-1> .`;
  assert.deepEqual(containedLikeUrls(prefixed, inbox), [`${inbox}like-1`]);
});

test('a later removal drops that person, and names stay hidden until the list is readable', () => {
  const added = applyLikeNotices([], [{ authorWebId: BOB, postUrl: POST, created: '2026-04-01T00:00:00.000Z' }]);
  assert.deepEqual(added, [BOB]);
  const cleared = applyLikeNotices(added, [
    { authorWebId: BOB, postUrl: POST, created: '2026-04-02T00:00:00.000Z', removed: true },
  ]);
  assert.deepEqual(cleared, []);
  assert.deepEqual(absorbLikes({ existing: [ADA], incoming: [ADA] }), [ADA]);

  const hidden = presentLikes({ webIds: [BOB], readable: false, mine: true, me: ADA });
  assert.equal(hidden.liked, true);
  assert.equal(hidden.count, null);
  assert.deepEqual(hidden.names, []);

  const shown = presentLikes({ webIds: [BOB, ADA], readable: true, mine: true, me: ADA });
  assert.equal(shown.count, 2);
  assert.deepEqual(shown.names, ['@bob', 'You']);
  assert.equal(likeSetAudience({ audience: 'private' }), 'private');
  assert.equal(likeSetAudience({ audience: 'contacts' }), 'contacts');
  assert.equal(likeSetAudience({ isPublic: true }), 'public');
});

function mockPod(handler) {
  return {
    info: { webId: ADA },
    fetch: async (url, init = {}) => {
      const method = init.method || 'GET';
      const target = String(url);
      return handler({ method, target, init });
    },
  };
}

function turtleResponse(status, body = '') {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/turtle' },
  });
}

test('an unreadable likes file is not treated as an empty list', async () => {
  const fetchFn = async () => new Response('no', { status: 401 });
  await assert.rejects(() => loadOwnLikes('https://ada.example/', fetchFn), /Could not read your likes/);
  const missing = async () => new Response('no', { status: 404 });
  assert.deepEqual(await loadOwnLikes('https://ada.example/', missing), []);
});

test('a missing likes file is created without reading it, and an existing file is not replaced', async () => {
  const calls = [];
  const created = mockPod(({ method, target, init }) => {
    calls.push(`${method} ${target}`);
    if (method === 'GET' && target.endsWith('/podsta/likes.ttl')) {
      throw new TypeError('Failed to fetch');
    }
    if (method === 'GET') return turtleResponse(404, 'missing');
    if (method === 'PUT' && target.endsWith('/podsta/likes.ttl')) {
      assert.equal(init.headers['If-None-Match'], '*');
    }
    return turtleResponse(201);
  });
  const result = await setOwnLike({
    podUrl: 'https://ada.example/',
    session: created,
    post: { url: POST, ownerWebId: ADA, audience: 'private' },
    liked: true,
  });
  assert.equal(result.liked, true);
  assert.equal(result.entries[0].postUrl, POST);
  assert.equal(result.notified, true);
  assert.ok(result.webIds.includes(ADA));
  assert.equal(calls.some((call) => call.startsWith('GET') && call.includes('/podsta/likes.ttl')), false);
  assert.equal(calls.some((call) => call.startsWith('PUT') && call.endsWith('/podsta/likes.ttl')), true);

  const blocked = mockPod(({ method, target }) => {
    calls.push(`blocked ${method} ${target}`);
    if (method === 'PUT' && target.endsWith('/podsta/likes.ttl')) return turtleResponse(412, 'exists');
    return turtleResponse(201);
  });
  await assert.rejects(
    () =>
      setOwnLike({
        podUrl: 'https://ada.example/',
        session: blocked,
        post: { url: POST, ownerWebId: ADA, audience: 'private' },
        liked: true,
      }),
    /Could not read your likes/,
  );
});

test('a known likes list is replaced, and a failed public count still keeps the like', async () => {
  const calls = [];
  const session = mockPod(({ method, target }) => {
    calls.push(`${method} ${target}`);
    if (method === 'GET' && target.endsWith('/podsta/likes.ttl')) {
      throw new TypeError('Failed to fetch');
    }
    if (target.includes('/podsta/like-sets/') && !target.endsWith('/')) return turtleResponse(500, 'no');
    if (method === 'GET') return turtleResponse(404, 'missing');
    return turtleResponse(201);
  });
  const result = await setOwnLike({
    podUrl: 'https://ada.example/',
    session,
    post: { url: POST, ownerWebId: ADA, audience: 'private' },
    liked: true,
    knownEntries: [{ postUrl: 'https://ada.example/podsta/posts/older.ttl', created: '2026-04-01T00:00:00.000Z' }],
  });
  assert.equal(result.liked, true);
  assert.equal(result.notified, false);
  assert.equal(result.webIds, null);
  assert.equal(result.entries.length, 2);
  assert.equal(calls.some((call) => call.startsWith('GET') && call.includes('/podsta/likes.ttl')), false);
  const likesPut = calls.find((call) => call.startsWith('PUT') && call.endsWith('/podsta/likes.ttl'));
  assert.ok(likesPut);
});
