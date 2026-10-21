import test from 'node:test';
import assert from 'node:assert/strict';
import { createThing, getStringNoLocale, setStringNoLocale } from '@inrupt/solid-client';
import {
  EXTRAS,
  MAX_PINNED,
  isPinnable,
  normalizePinned,
  pinnedFrom,
  readExtras,
  togglePinned,
  writeExtras,
} from '../src/lib/profileExtras.js';
import { wrapLines } from '../src/lib/wrapLines.js';

const A = 'https://pod.example/ada/podsta/posts/a.ttl';
const B = 'https://pod.example/ada/podsta/posts/b.ttl';
const C = 'https://pod.example/ada/podsta/posts/c.ttl';
const D = 'https://pod.example/ada/podsta/posts/d.ttl';

test('pins keep their order, drop duplicates and unsafe URLs, and stop at three', () => {
  assert.deepEqual(normalizePinned(`${B} ${A} ${B} javascript:alert(1) ${C} ${D}`), [B, A, C]);
  assert.deepEqual(normalizePinned([A, '', null]), [A]);
  assert.equal(MAX_PINNED, 3);
});

test('toggling a pin adds at the end, removes in place, and ignores a fourth', () => {
  assert.deepEqual(togglePinned([A], B), [A, B]);
  assert.deepEqual(togglePinned([A, B, C], B), [A, C]);
  assert.deepEqual(togglePinned([A, B, C], D), [A, B, C]);
});

test('cover and pins round-trip through the profile thing', () => {
  let thing = createThing({ url: 'https://pod.example/ada/podsta/profile.ttl' });
  thing = writeExtras(thing, {
    coverUrl: 'https://pod.example/ada/podsta/covers/c.jpg',
    pinned: [C, A],
  });
  assert.equal(getStringNoLocale(thing, EXTRAS.pinned), `${C} ${A}`);
  assert.deepEqual(readExtras(thing), {
    coverUrl: 'https://pod.example/ada/podsta/covers/c.jpg',
    pinned: [C, A],
  });
});

test('undefined fields are left alone and empty ones are removed', () => {
  let thing = createThing({ url: 'https://pod.example/ada/podsta/profile.ttl' });
  thing = writeExtras(thing, { coverUrl: 'https://pod.example/c.jpg', pinned: [A] });
  thing = writeExtras(thing, {});
  assert.deepEqual(readExtras(thing), { coverUrl: 'https://pod.example/c.jpg', pinned: [A] });
  thing = writeExtras(thing, { coverUrl: '', pinned: [] });
  assert.deepEqual(readExtras(thing), { coverUrl: '', pinned: [] });
});

test('a non-http cover is refused on write and ignored on read', () => {
  const thing = createThing({ url: 'https://pod.example/ada/podsta/profile.ttl' });
  assert.throws(() => writeExtras(thing, { coverUrl: 'javascript:alert(1)' }));
  const tampered = setStringNoLocale(thing, EXTRAS.cover, 'javascript:alert(1)');
  assert.equal(readExtras(tampered).coverUrl, '');
});

test('only public posts can be pinned or shown as pinned', () => {
  const posts = [
    { url: A, audience: 'public' },
    { url: B, audience: 'contacts' },
    { url: C, audience: 'private' },
    { url: D },
  ];
  assert.deepEqual(
    posts.map((post) => isPinnable(post)),
    [true, false, false, true],
  );
  assert.deepEqual(
    pinnedFrom([D, B, A], posts).map((post) => post.url),
    [D, A],
  );
  assert.deepEqual(pinnedFrom(['https://pod.example/gone.ttl'], posts), []);
});

test('card text wraps to the line limit and ends with an ellipsis when cut', () => {
  const measure = (text) => text.length * 10;
  assert.deepEqual(wrapLines('one two three', 200, 2, measure), ['one two three']);
  assert.deepEqual(wrapLines('aaaa bbbb cccc dddd eeee', 100, 2, measure), [
    'aaaa bbbb',
    'cccc dddd…',
  ]);
  const [long] = wrapLines('x'.repeat(40), 100, 1, measure);
  assert.ok(measure(long) <= 100 && long.endsWith('…'));
  assert.deepEqual(wrapLines('', 100, 2, measure), []);
});
