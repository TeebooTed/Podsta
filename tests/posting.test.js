import test from 'node:test';
import assert from 'node:assert/strict';
import { cropRect, isIdentityAdjust, normalizeRotation, rotatedSize } from '../src/lib/photoAdjust.js';
import { overallRatio, progressBody, putPhotoFile, uploadRatio } from '../src/lib/uploadProgress.js';
import { audienceResourceUrls, isAlbumPost, photoUrls, primaryPhotoUrl } from '../src/lib/album.js';
import { publicIndexEntryFromPost } from '../src/lib/indexEntry.js';
import { createPhotoAlbum } from '../src/lib/posts.js';

const JPEG = new File([new Uint8Array([1, 2, 3, 4])], 'sun.jpg', { type: 'image/jpeg' });
const SECOND = new File([new Uint8Array([5, 6, 7, 8, 9])], 'moon.jpg', { type: 'image/jpeg' });

test('crop keeps the whole frame until you zoom, and rotation swaps the sides', () => {
  assert.equal(normalizeRotation(-90), 270);
  assert.deepEqual(rotatedSize(400, 200, 90), { width: 200, height: 400 });
  const full = cropRect({ width: 400, height: 200, zoom: 1 });
  assert.equal(full.sx, 0);
  assert.equal(full.sy, 0);
  assert.equal(full.destWidth, 400);
  assert.equal(full.destHeight, 200);
  const zoomed = cropRect({ width: 400, height: 200, zoom: 2, panX: 1, panY: 0 });
  assert.equal(zoomed.destWidth, 200);
  assert.ok(zoomed.sx > 0);
  assert.equal(isIdentityAdjust({ rotation: 360, zoom: 1, panX: 0, panY: 0 }), true);
  assert.equal(isIdentityAdjust({ rotation: 90, zoom: 1, panX: 0, panY: 0 }), false);
});

test('upload progress stays short of 100 percent until the Pod responds', async () => {
  assert.equal(uploadRatio(10, 10), 0.9);
  assert.ok(overallRatio(0, 2, uploadRatio(10, 10)) < 1);
  assert.equal(overallRatio(1, 2, 0.9, true), 1);

  const seen = [];
  const body = progressBody(JPEG, (sent, total) => seen.push([sent, total]));
  const reader = body.getReader();
  let bytes = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    bytes += step.value.byteLength;
  }
  assert.equal(bytes, JPEG.size);
  assert.ok(seen.length >= 1);
  assert.equal(seen.at(-1)[0], JPEG.size);
  assert.ok(uploadRatio(seen.at(-1)[0], seen.at(-1)[1]) < 1);
});

test('a failed photo is the one a retry sends again', async () => {
  let calls = 0;
  const fetchFn = async (url, init) => {
    calls += 1;
    if (typeof init.body?.getReader === 'function') {
      const reader = init.body.getReader();
      while (!(await reader.read()).done) {
        // drain
      }
    }
    if (String(url).endsWith('moon.jpg') || String(url).includes('-1-')) {
      return new Response('no', { status: 500 });
    }
    if (init.method === 'PUT' && String(url).includes('/podsta/photos/')) {
      return new Response(null, { status: 201 });
    }
    if (init.method === 'PUT') return new Response(null, { status: 201 });
    return new Response(null, { status: 201, headers: { Location: url } });
  };

  const session = { fetch: fetchFn, info: { webId: 'https://ada.example/profile/card#me' } };
  await assert.rejects(
    () => createPhotoAlbum({ podUrl: 'https://ada.example/', session, files: [JPEG, SECOND] }),
    (err) => {
      assert.equal(err.failedAt, 1);
      assert.equal(err.uploaded.length, 1);
      return true;
    },
  );

  const uploaded = ['https://ada.example/podsta/photos/already.jpg'];
  let secondPuts = 0;
  session.fetch = async (url, init) => {
    if (init?.method === 'PUT' && /\/podsta\/photos\/[^/]+$/.test(String(url))) secondPuts += 1;
    if (typeof init?.body?.getReader === 'function') {
      const reader = init.body.getReader();
      while (!(await reader.read()).done) {
        // drain
      }
    }
    return new Response(null, { status: 201 });
  };
  const created = await createPhotoAlbum({
    podUrl: 'https://ada.example/',
    session,
    files: [JPEG, SECOND],
    alreadyUploaded: uploaded,
    caption: 'Two',
  });
  assert.equal(secondPuts, 1);
  assert.equal(created.images[0], uploaded[0]);
  assert.equal(created.images.length, 2);
  assert.ok(created.url.endsWith('.ttl'));
  assert.ok(calls >= 1);
});

test('an album lists every image, and an older single photo still has its sidecar', () => {
  const album = {
    type: 'photo',
    url: 'https://ada.example/podsta/posts/1.ttl',
    images: ['https://ada.example/podsta/photos/a.jpg', 'https://ada.example/podsta/photos/b.jpg'],
  };
  assert.equal(isAlbumPost(album), true);
  assert.deepEqual(audienceResourceUrls(album), [album.url, ...album.images]);
  assert.equal(primaryPhotoUrl(album), album.images[0]);
  const single = { type: 'photo', url: 'https://ada.example/podsta/photos/a.jpg' };
  assert.equal(isAlbumPost(single), false);
  assert.deepEqual(photoUrls(single), [single.url]);
  assert.deepEqual(audienceResourceUrls(single), [single.url, `${single.url}.meta`]);
  const entry = publicIndexEntryFromPost({ ...album, caption: 'Day', dateCreated: '2026-04-01T00:00:00.000Z' });
  assert.deepEqual(entry.images, album.images);
});
