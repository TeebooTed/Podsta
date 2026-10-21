import test from 'node:test';
import assert from 'node:assert/strict';
import { captionParts, hashtagsIn, normalizeTag, postsForTag, postTags } from '../src/lib/hashtags.js';
import { publicIndexEntryFromPost } from '../src/lib/indexEntry.js';
import { sectionFromPath, tagPath } from '../src/lib/navigation.js';

const MINE = 'https://ada.example/podsta/posts/mine.ttl';
const THEIRS = 'https://bob.example/podsta/posts/theirs.ttl';
const HIDDEN = 'https://cara.example/podsta/posts/hidden.ttl';

test('hashtags are words, capped, and not pieces of a longer word', () => {
  assert.deepEqual(hashtagsIn('Walk in #Garden and #garden, then #sea_salt.'), ['garden', 'sea_salt']);
  assert.deepEqual(hashtagsIn('email me@host and use #ok'), ['ok']);
  assert.deepEqual(hashtagsIn('not#tagged'), []);
  assert.equal(hashtagsIn(`#${'a'.repeat(41)}`).length, 0);
  assert.equal(hashtagsIn(Array.from({ length: 12 }, (_, i) => `#t${i}`).join(' ')).length, 8);
  assert.equal(normalizeTag(' #Café '), 'café');
  assert.equal(normalizeTag('no spaces'), '');
  assert.equal(normalizeTag('javascript:alert'), '');
});

test('caption parts keep the surrounding text and name the tag', () => {
  const parts = captionParts('Hello #Garden there');
  assert.deepEqual(
    parts.map((part) => part.type),
    ['text', 'tag', 'text'],
  );
  assert.equal(parts[1].tag, 'garden');
  assert.equal(parts[1].value, '#Garden');
  assert.equal(parts.map((part) => part.value).join(''), 'Hello #Garden there');
});

test('a tag page includes your private post and only followed posts you were given', () => {
  const own = [
    { url: MINE, caption: 'Rain #garden', dateCreated: '2026-04-01T00:00:00.000Z', audience: 'private' },
  ];
  const followed = [
    { url: THEIRS, caption: 'Sun #garden', dateCreated: '2026-04-02T00:00:00.000Z', audience: 'public' },
    { url: HIDDEN, caption: 'Secret #garden', dateCreated: '2026-04-03T00:00:00.000Z', audience: 'private' },
  ];
  const visible = postsForTag('Garden', { own, followed: followed.filter((post) => post.audience !== 'private') });
  assert.deepEqual(
    visible.map((post) => post.url),
    [THEIRS, MINE],
  );
  assert.equal(visible.some((post) => post.url === HIDDEN), false);
  assert.deepEqual(postsForTag('nope', { own, followed }), []);
  assert.deepEqual(postTags({ tags: ['Garden'], caption: '#sea' }), ['garden', 'sea']);
});

test('an index entry keeps tags from the full note, and the route is /tag', () => {
  const entry = publicIndexEntryFromPost({
    url: MINE,
    type: 'text',
    title: 'Note',
    body: `${'y'.repeat(220)} #lighthouse`,
    dateCreated: '2026-04-01T00:00:00.000Z',
  });
  assert.equal(entry.caption.length, 200);
  assert.equal(entry.caption.includes('#lighthouse'), false);
  assert.deepEqual(entry.tags, ['lighthouse']);
  assert.equal(tagPath('Garden'), '/tag?name=garden');
  assert.equal(sectionFromPath('/tag'), 'tag');
  assert.equal(tagPath(''), '');
});
