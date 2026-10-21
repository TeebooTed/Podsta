import test from 'node:test';
import assert from 'node:assert/strict';
import { shareAudience, shareOrCopy, sharePayload } from '../src/lib/shareOut.js';

const POST = 'https://ada.example/podsta/posts/1.ttl';
const ORIGIN = 'https://teebooted.github.io/Podsta';

test('a private post is not shared, and a contacts post omits the caption', () => {
  assert.equal(sharePayload({ origin: ORIGIN, post: { url: POST, audience: 'private', caption: 'secret' } }), null);
  assert.equal(shareAudience({ isPublic: false }), 'private');
  const contacts = sharePayload({
    origin: ORIGIN,
    post: { url: POST, audience: 'contacts', caption: 'only friends' },
    authorName: 'Ada',
  });
  assert.equal(contacts.text, '');
  assert.equal(contacts.url.includes(encodeURIComponent(POST)), true);
  assert.equal(contacts.title, 'Ada on Podsta');
});

test('a public post can include a short excerpt and nothing else is uploaded', async () => {
  const payload = sharePayload({
    origin: ORIGIN,
    post: { url: POST, audience: 'public', title: 'North light', caption: 'x'.repeat(300) },
  });
  assert.equal(payload.title, 'North light');
  assert.equal(payload.text.length, 180);
  assert.equal(payload.url.startsWith(`${ORIGIN}/post?url=`), true);

  const shared = [];
  const sent = await shareOrCopy(payload, {
    share: async (data) => {
      shared.push(data);
    },
    copy: async () => {
      throw new Error('copy should not run');
    },
  });
  assert.equal(sent.method, 'share');
  assert.equal(shared[0].url, payload.url);
  assert.equal(shared.length, 1);

  const copied = [];
  const fallback = await shareOrCopy(payload, {
    share: async () => {
      throw new Error('no share sheet');
    },
    copy: async (url) => {
      copied.push(url);
      return true;
    },
  });
  assert.equal(fallback.method, 'copy');
  assert.equal(copied[0], payload.url);

  const dismissed = await shareOrCopy(payload, {
    share: async () => {
      const err = new Error('cancel');
      err.name = 'AbortError';
      throw err;
    },
    copy: async () => true,
  });
  assert.equal(dismissed.reason, 'dismissed');
  assert.equal(dismissed.ok, false);
  assert.deepEqual(await shareOrCopy(null, {}), { ok: false, reason: 'private' });
});
