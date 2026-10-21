import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryOutbox,
  deliverPost,
  flushOutbox,
  isRetryableFailure,
  outboxLabel,
  postDraftItem,
  queueSocialItem,
} from '../src/lib/outbox.js';

const webId = 'https://ada.example/profile/card#me';

test('a dead connection is queued and a refusal is not', () => {
  assert.equal(isRetryableFailure(new TypeError('Failed to fetch')), true);
  assert.equal(isRetryableFailure({ status: 503, message: 'unavailable' }), true);
  assert.equal(isRetryableFailure({ status: 0, message: 'The Pod did not respond' }), true);
  assert.equal(isRetryableFailure(new Error('nope'), false), true);
  assert.equal(isRetryableFailure({ status: 403, message: 'no' }), false);
  assert.equal(isRetryableFailure({ status: 401, message: 'expired' }), false);
  assert.equal(isRetryableFailure(new Error('Caption stops at 280 characters')), false);
});

test('an offline post stays on the device with its caption and photo', async () => {
  const store = createMemoryOutbox();
  const photo = new File([new Uint8Array([1, 2, 3])], 'sun.jpg', { type: 'image/jpeg' });
  let sends = 0;
  const result = await deliverPost({
    draft: {
      draftId: 'draftone',
      type: 'photo',
      caption: 'On the step',
      audience: 'private',
      files: [photo],
      thumbnails: [],
    },
    webId,
    store,
    online: () => false,
    send: async () => {
      sends += 1;
    },
  });
  assert.equal(result.queued, true);
  assert.equal(sends, 0);
  const [saved] = await store.list(webId);
  assert.equal(saved.caption, 'On the step');
  assert.equal(saved.files[0].name, 'sun.jpg');
  assert.equal(saved.files[0].size, 3);
  assert.equal(outboxLabel(saved), 'On the step');
});

test('a failed upload keeps the photos that landed and a later flush sends the rest', async () => {
  const store = createMemoryOutbox();
  let sends = 0;
  const first = await deliverPost({
    draft: { draftId: 'drafttwo', type: 'text', body: 'Hello', title: '', audience: 'private' },
    webId,
    store,
    online: () => true,
    send: async () => {
      sends += 1;
      const error = new Error('The Pod did not respond');
      error.uploaded = ['https://ada.example/podsta/photos/one.jpg'];
      throw error;
    },
  });
  assert.equal(first.queued, true);
  const partial = (await store.list(webId))[0];
  assert.deepEqual(partial.alreadyUploaded, ['https://ada.example/podsta/photos/one.jpg']);

  const flushed = await flushOutbox({
    webId,
    store,
    send: async (item) => {
      sends += 1;
      assert.deepEqual(item.alreadyUploaded, ['https://ada.example/podsta/photos/one.jpg']);
      assert.equal(item.id, 'drafttwo');
    },
  });
  assert.equal(flushed.sent, 1);
  assert.equal(flushed.items.length, 0);
  assert.equal(sends, 2);
});

test('one refusal does not drop the next item, and a dead pod stops the queue', async () => {
  const store = createMemoryOutbox();
  await store.put({ id: 'a', webId, kind: 'like', liked: true, createdAt: '2020-01-01T00:00:00.000Z', postUrl: 'https://ada.example/a' });
  await store.put({ id: 'b', webId, kind: 'comment', text: 'Nice', createdAt: '2020-01-02T00:00:00.000Z', postUrl: 'https://ada.example/b' });
  const seen = [];
  const mixed = await flushOutbox({
    webId,
    store,
    send: async (item) => {
      seen.push(item.id);
      if (item.id === 'a') {
        const error = new Error('refused');
        error.status = 403;
        throw error;
      }
    },
  });
  assert.deepEqual(seen, ['a', 'b']);
  assert.equal(mixed.sent, 1);
  assert.equal(mixed.items.length, 1);
  assert.equal(mixed.items[0].id, 'a');

  await store.put({ id: 'c', webId, kind: 'post', postType: 'text', body: 'Later', createdAt: '2020-01-03T00:00:00.000Z' });
  const stopped = await flushOutbox({
    webId,
    store,
    send: async (item) => {
      seen.push(item.id);
      if (item.id === 'a') throw new TypeError('Failed to fetch');
    },
  });
  assert.equal(stopped.sent, 0);
  assert.equal(seen.includes('c'), false);
  assert.equal((await store.list(webId)).some((item) => item.id === 'c'), true);
});

test('a like or comment is kept when the device is offline and not sent twice', async () => {
  const store = createMemoryOutbox();
  const like = await queueSocialItem(
    {
      id: 'like1',
      kind: 'like',
      liked: true,
      postUrl: 'https://ada.example/podsta/posts/1.ttl',
      ownerWebId: 'https://bea.example/profile/card#me',
    },
    { webId, store, online: () => false, send: async () => assert.fail('sent') },
  );
  assert.equal(like.queued, true);
  const comment = await queueSocialItem(
    { id: 'cmt1', kind: 'comment', text: 'Hello there', postUrl: 'https://ada.example/podsta/posts/1.ttl' },
    {
      webId,
      store,
      online: () => true,
      send: async (item) => {
        assert.equal(item.text, 'Hello there');
        return { notified: true };
      },
    },
  );
  assert.equal(comment.queued, false);
  const left = await store.list(webId);
  assert.deepEqual(left.map((item) => item.id), ['like1']);
  const draft = postDraftItem({
    webId,
    draft: { draftId: 'draftone', type: 'text', body: 'Same', audience: 'private' },
  });
  assert.equal(draft.id, 'draftone');
});
