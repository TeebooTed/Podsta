import test from 'node:test';
import assert from 'node:assert/strict';
import { groupReadTurtle, publicReadTurtle } from '../src/lib/aclTurtle.js';
import {
  audienceAllowed,
  ceilingNote,
  clampAudience,
  composerChoices,
  currentAudience,
  DEFAULT_LEVEL,
  effectiveAudience,
  followListAudience,
  groupShouldBePublic,
  postsToRewrite,
  profileAudience,
  resolveLevel,
} from '../src/lib/discoverability.js';
import { postedToast } from '../src/lib/shareFeedback.js';

const OWNER = 'https://owner.example/profile/card#me';
const GROUP = 'https://owner.example/podsta/contacts/group.ttl#contacts';
const RESOURCE = 'https://owner.example/podsta/profile.ttl';

test('a contacts ACL names the group and not the public', () => {
  const turtle = groupReadTurtle(RESOURCE, OWNER, GROUP);
  assert.match(turtle, /acl:agentGroup/);
  assert.match(turtle, new RegExp(GROUP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(turtle.includes('foaf:Agent'), false);
  assert.equal(turtle.includes('acl:Append'), false);
  assert.equal(turtle.includes('acl:default'), false);
  assert.match(publicReadTurtle(RESOURCE, OWNER), /foaf:Agent/);
});

test('discoverability defaults to hidden and caps post audiences', () => {
  assert.equal(DEFAULT_LEVEL, 'hidden');
  assert.equal(clampAudience('hidden', 'public'), 'private');
  assert.equal(clampAudience('hidden', 'contacts'), 'private');
  assert.equal(clampAudience('contacts', 'public'), 'contacts');
  assert.equal(clampAudience('contacts', 'private'), 'private');
  assert.equal(clampAudience('public', 'public'), 'public');
  assert.equal(audienceAllowed('hidden', 'contacts'), false);
  assert.equal(audienceAllowed('public', 'contacts'), true);

  const hiddenChoices = composerChoices('hidden');
  assert.deepEqual(
    hiddenChoices.map((choice) => choice.enabled),
    [true, false, false],
  );
  assert.match(ceilingNote('hidden'), /Hidden/);
  assert.equal(composerChoices('public').every((choice) => choice.enabled), true);
});

test('raising discoverability does not rewrite private posts', () => {
  const posts = [
    { url: 'a', audience: 'private' },
    { url: 'b', audience: 'contacts' },
    { url: 'c', isPublic: true },
  ];
  assert.equal(postsToRewrite('public', posts).length, 0);
  assert.deepEqual(
    postsToRewrite('hidden', posts).map((post) => post.url),
    ['b', 'c'],
  );
  assert.deepEqual(
    postsToRewrite('contacts', posts).map((post) => post.url),
    ['c'],
  );
  assert.equal(currentAudience({ isPublic: true }), 'public');
  assert.equal(effectiveAudience({ stored: 'public', isPublic: false }), 'private');
  assert.equal(effectiveAudience({ stored: 'contacts', isPublic: false }), 'contacts');
  assert.equal(effectiveAudience({ stored: 'private', isPublic: true }), 'public');
});

test('an already public profile is not inferred as hidden', () => {
  assert.deepEqual(resolveLevel({ stored: '', profilePublic: true, indexPublic: false }), {
    level: 'public',
    inferred: true,
  });
  assert.deepEqual(resolveLevel({ stored: '', profilePublic: false, indexPublic: false }), {
    level: 'hidden',
    inferred: true,
  });
  assert.deepEqual(resolveLevel({ stored: 'contacts', profilePublic: true, indexPublic: true }), {
    level: 'contacts',
    inferred: false,
  });
});

test('the group file is public when contacts can be granted', () => {
  assert.equal(groupShouldBePublic('contacts', ['private']), true);
  assert.equal(groupShouldBePublic('public', ['contacts']), true);
  assert.equal(groupShouldBePublic('public', ['public']), false);
  assert.equal(groupShouldBePublic('hidden', ['private']), false);
  assert.equal(profileAudience('hidden'), 'private');
  assert.equal(profileAudience('contacts'), 'contacts');
  assert.equal(followListAudience('contacts'), 'private');
  assert.equal(followListAudience('public'), 'public');
});

test('a contacts share failure is not described as public', () => {
  const failed = postedToast({
    audience: 'contacts',
    makePublic: false,
    shareFailed: true,
    shareMessage: 'Pod denied the group',
  });
  assert.equal(failed.type, 'error');
  assert.match(failed.message, /sharing failed: Pod denied the group/);
  assert.equal(failed.message.includes('Posted publicly'), false);
  assert.equal(
    postedToast({ audience: 'contacts', shareFailed: false }).message,
    'Posted for your contacts',
  );
});
