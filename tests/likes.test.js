import test from 'node:test';
import assert from 'node:assert/strict';
import {
  absorbLikes,
  applyLikeNotices,
  likeSetAudience,
  noticeTurtle,
  parseLikeNotice,
  parseLikes,
  presentLikes,
  serializeLikes,
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
