import test from 'node:test';
import assert from 'node:assert/strict';
import { altForPhoto, altsForImages, cleanAlt, packImageAlt, unpackImageAlts } from '../src/lib/altText.js';
import { publicIndexEntryFromPost } from '../src/lib/indexEntry.js';

const PHOTO = 'https://ada.example/podsta/photos/1.jpg';

test('alt text is trimmed, capped, and packed with its photo URL', () => {
  assert.equal(cleanAlt('  a   red\nboat  '), 'a red boat');
  assert.equal(cleanAlt('x'.repeat(250)).length, 200);
  assert.equal(packImageAlt(PHOTO, '   '), '');
  const packed = packImageAlt(PHOTO, 'A red boat');
  assert.deepEqual(unpackImageAlts([packed, 'no separator']), [{ url: PHOTO, alt: 'A red boat' }]);
  assert.equal(altForPhoto({ alts: [{ url: PHOTO, alt: 'A red boat' }] }, PHOTO), 'A red boat');
  assert.equal(altForPhoto({ caption: 'not the description' }, PHOTO), '');
});

test('an index entry carries alt text only for photos that have one', () => {
  const entry = publicIndexEntryFromPost({
    url: 'https://ada.example/podsta/posts/1.ttl',
    type: 'photo',
    caption: 'Harbour',
    images: [PHOTO],
    alts: altsForImages([PHOTO], ['A red boat at dusk']),
    dateCreated: '2026-04-01T00:00:00.000Z',
  });
  assert.deepEqual(entry.alts, [{ url: PHOTO, alt: 'A red boat at dusk' }]);
  assert.equal(entry.caption, 'Harbour');
  const cleared = publicIndexEntryFromPost({
    url: entry.url,
    type: 'photo',
    caption: 'Harbour',
    images: [PHOTO],
    alts: [],
    dateCreated: entry.dateCreated,
  });
  assert.deepEqual(cleared.alts, []);
});
