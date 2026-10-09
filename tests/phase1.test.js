import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aclGrantsPublicRead,
  assertAllSucceeded,
  ownerOnlyTurtle,
  publicReadTurtle,
} from '../src/lib/aclTurtle.js';
import { publicIndexEntryFromPost } from '../src/lib/indexEntry.js';
import { postedToast } from '../src/lib/shareFeedback.js';
import { withTimeout } from '../src/lib/timeoutFetch.js';
import { safeHttpUrl } from '../src/lib/urls.js';
import { normalizeWebId } from '../src/lib/webId.js';

const RESOURCE = 'https://storage.example/alice/podsta/photos/1.jpg';
const OWNER = 'https://alice.example/profile/card#me';

describe('access-control documents', () => {
  it('grants public read on a shared resource and full control to the owner', () => {
    const turtle = publicReadTurtle(RESOURCE, OWNER);
    assert.match(turtle, /acl:agentClass foaf:Agent/);
    assert.match(turtle, /acl:mode acl:Read \./);
    assert.match(turtle, new RegExp(`acl:agent <${OWNER}>`));
    assert.equal(turtle.includes('acl:Append'), false);
    assert.equal(turtle.includes('acl:default'), false);
    assert.equal(aclGrantsPublicRead(turtle), true);
  });

  it('locks a container to the owner, including children, with no public append', () => {
    const turtle = ownerOnlyTurtle(`${RESOURCE}/comments/`, OWNER, { inherit: true });
    assert.match(turtle, /acl:default </);
    assert.match(turtle, /acl:mode acl:Read, acl:Write, acl:Control \./);
    assert.equal(turtle.includes('foaf:Agent'), false);
    assert.equal(turtle.includes('acl:Append'), false);
    assert.equal(aclGrantsPublicRead(turtle), false);
  });

  it('refuses a non-https URL and encodes characters that would close a Turtle IRI', () => {
    assert.throws(() => publicReadTurtle('javascript:alert(1)', OWNER), /https/);
    const turtle = publicReadTurtle('https://evil.example/a>b', OWNER);
    assert.equal(turtle.includes('a>b'), false);
    assert.match(turtle, /a%3Eb/);
    assert.equal(safeHttpUrl('javascript:alert(1)'), null);
    assert.equal(safeHttpUrl('http://storage.example/alice/'), null);
    assert.match(safeHttpUrl('http://localhost:3000/alice/'), /^http:\/\/localhost:3000\/alice\/$/);
  });

  it('fails the whole share when any sibling write fails', () => {
    assert.doesNotThrow(() =>
      assertAllSucceeded([{ status: 'fulfilled' }, { status: 'fulfilled' }], 'share'),
    );
    assert.throws(
      () =>
        assertAllSucceeded(
          [{ status: 'fulfilled' }, { status: 'rejected', reason: new Error('meta denied') }],
          'share',
        ),
      /Share incomplete \(1 of 2 failed\): meta denied/,
    );
    assert.throws(
      () => assertAllSucceeded([{ status: 'rejected', reason: new Error('nope') }], 'unshare'),
      /Failed to unshare: nope/,
    );
  });
});

describe('public index entries', () => {
  it('keeps an empty caption so an edit can clear what friends see', () => {
    const entry = publicIndexEntryFromPost(
      { url: RESOURCE, type: 'photo', caption: 'old', dateCreated: '2026-01-01T00:00:00.000Z' },
      { caption: '' },
    );
    assert.equal(entry.caption, '');
    assert.equal(entry.type, 'photo');
  });

  it('stores a short text excerpt, not the whole body', () => {
    const entry = publicIndexEntryFromPost(
      { url: RESOURCE, type: 'text', body: 'x'.repeat(500), title: 'Note', dateCreated: '2026-01-01T00:00:00.000Z' },
      { title: 'Note', body: 'y'.repeat(500) },
    );
    assert.equal(entry.caption.length, 200);
    assert.equal(entry.title, 'Note');
  });
});

describe('share toasts', () => {
  it('does not announce a public post when sharing failed', () => {
    const toast = postedToast({
      makePublic: true,
      shareFailed: true,
      shareMessage: 'ACL rejected',
    });
    assert.equal(toast.type, 'error');
    assert.match(toast.message, /sharing failed: ACL rejected/);
    assert.equal(toast.message.includes('Posted publicly'), false);
  });

  it('distinguishes a private post from a public one', () => {
    assert.equal(postedToast({ makePublic: false, shareFailed: false }).message, 'Posted privately');
    assert.equal(postedToast({ makePublic: true, shareFailed: false }).message, 'Posted publicly');
  });
});

describe('WebIDs', () => {
  it('adds https and the #me fragment on a profile card', () => {
    assert.equal(
      normalizeWebId('alice.solidcommunity.net/profile/card'),
      'https://alice.solidcommunity.net/profile/card#me',
    );
  });

  it('rejects values that are not web addresses', () => {
    assert.equal(normalizeWebId(''), null);
    assert.equal(normalizeWebId('javascript:alert(1)'), null);
  });
});

describe('timeouts', () => {
  it('aborts a fetch that never settles', async () => {
    const hung = () => new Promise(() => {});
    const timed = withTimeout(hung, 20);
    await assert.rejects(timed('https://pod.example/index.ttl'), /aborted|AbortError/);
  });
});
