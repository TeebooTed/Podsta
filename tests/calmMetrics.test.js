import test from 'node:test';
import assert from 'node:assert/strict';
import { countsArePrivate, parseHideLikeCounts } from '../src/lib/calmMetrics.js';
import { publishedLikeAudience } from '../src/lib/likes.js';

test('a new profile hides counts, and an older profile keeps showing them', () => {
  assert.equal(countsArePrivate({ stored: '', profileFound: false }), true);
  assert.equal(countsArePrivate({ stored: 'yes', profileFound: true }), true);
  assert.equal(countsArePrivate({ stored: 'no', profileFound: true }), false);
  assert.equal(countsArePrivate({ stored: '', profileFound: true }), false);
  assert.equal(countsArePrivate({ stored: 'maybe', profileFound: true }), false);
});

test('the profile file records yes or no, and a missing file does not', () => {
  assert.deepEqual(parseHideLikeCounts(''), { profileFound: false, stored: '' });
  assert.deepEqual(parseHideLikeCounts('   '), { profileFound: false, stored: '' });
  const legacy = '<https://ada.example/podsta/profile.ttl> <http://xmlns.com/foaf/0.1/name> "Ada" .';
  assert.deepEqual(parseHideLikeCounts(legacy), { profileFound: true, stored: '' });
  const hidden =
    '<https://ada.example/podsta/profile.ttl> <https://podsta.app/vocab#hideLikeCounts> "yes" .';
  assert.deepEqual(parseHideLikeCounts(hidden), { profileFound: true, stored: 'yes' });
  const shown = 'podsta:hideLikeCounts "no" .';
  assert.equal(parseHideLikeCounts(shown).stored, 'no');
});

test('a private count uses a private file, otherwise the post audience', () => {
  const post = { audience: 'public' };
  assert.equal(publishedLikeAudience(post, false), 'public');
  assert.equal(publishedLikeAudience(post, true), 'private');
  assert.equal(publishedLikeAudience({ audience: 'contacts' }, true), 'private');
  assert.equal(publishedLikeAudience({ audience: 'contacts' }, false), 'contacts');
});
