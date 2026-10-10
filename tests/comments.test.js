import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCommentNotices,
  commentNoticeTurtle,
  commentResultCopy,
  commentSetAudience,
  commenterLabel,
  legacyCommentId,
  mergeLegacy,
  parseCommentNotice,
  parseCommentSet,
  parseHides,
  parseOwnComments,
  presentThread,
  serializeCommentSet,
  serializeHides,
  serializeOwnComments,
} from '../src/lib/comments.js';
import { filterBlocked, parseBlocks, parseReports, serializeBlocks, serializeReports } from '../src/lib/blocks.js';

const ADA = 'https://ada.example/profile/card#me';
const BOB = 'https://bob.solidcommunity.net/profile/card#me';
const POST = 'https://ada.example/podsta/posts/1.ttl';

test('a comment round-trips, including quotes, and rejects a script URL', () => {
  const turtle = serializeOwnComments([
    {
      id: 'c1',
      postUrl: POST,
      text: 'He said "hi"\nnext',
      date: '2026-04-01T00:00:00.000Z',
      modified: '2026-04-01T00:00:00.000Z',
    },
  ]);
  const parsed = parseOwnComments(turtle);
  assert.equal(parsed[0].text, 'He said "hi"\nnext');
  assert.equal(parsed[0].postUrl, POST);
  assert.throws(() =>
    serializeOwnComments([
      { id: 'c1', postUrl: 'javascript:alert(1)', text: 'no', date: '2026-04-01T00:00:00.000Z' },
    ]),
  );

  const notice = commentNoticeTurtle({
    authorWebId: BOB,
    postUrl: POST,
    id: 'c1',
    text: 'Hello',
    action: 'add',
    created: '2026-04-02T00:00:00.000Z',
  });
  assert.equal(parseCommentNotice(notice).authorWebId, BOB);
  assert.equal(parseCommentNotice(notice).action, 'add');
  const removed = commentNoticeTurtle({
    authorWebId: BOB,
    postUrl: POST,
    id: 'c1',
    action: 'remove',
    created: '2026-04-03T00:00:00.000Z',
  });
  assert.equal(parseCommentNotice(removed).removed, true);
});

test('a published list keeps comment text and does not treat the set itself as a notice', () => {
  const turtle = serializeCommentSet({
    postUrl: POST,
    migrated: true,
    comments: [
      {
        id: 'c1',
        author: BOB,
        text: 'On the post',
        date: '2026-04-01T00:00:00.000Z',
        modified: '2026-04-01T00:00:00.000Z',
      },
    ],
  });
  const parsed = parseCommentSet(turtle);
  assert.equal(parsed.migrated, true);
  assert.equal(parsed.comments[0].text, 'On the post');
  assert.equal(parsed.comments[0].author, BOB);
  assert.equal(parseCommentNotice(turtle), null);
  assert.equal(commentSetAudience({ audience: 'contacts' }), 'contacts');
  assert.equal(commentSetAudience({ isPublic: true }), 'public');
});

test('an author hide survives a later copy of the original notice', () => {
  const added = applyCommentNotices(
    [],
    [
      {
        id: 'c1',
        authorWebId: BOB,
        postUrl: POST,
        text: 'Hello',
        action: 'add',
        created: '2026-04-01T00:00:00.000Z',
      },
    ],
  );
  assert.equal(added[0].text, 'Hello');
  const hidden = applyCommentNotices(added, [
    {
      id: 'c1',
      authorWebId: BOB,
      postUrl: POST,
      text: 'Hello again',
      action: 'edit',
      created: '2026-04-02T00:00:00.000Z',
    },
  ], { hiddenIds: ['c1'] });
  assert.deepEqual(hidden, []);
  const edited = applyCommentNotices(added, [
    {
      id: 'c1',
      authorWebId: BOB,
      postUrl: POST,
      text: 'Changed',
      action: 'edit',
      created: '2026-04-02T00:00:00.000Z',
    },
  ]);
  assert.equal(edited[0].text, 'Changed');
  assert.equal(edited[0].date, '2026-04-01T00:00:00.000Z');
  const removed = applyCommentNotices(edited, [
    { id: 'c1', authorWebId: BOB, postUrl: POST, action: 'remove', removed: true, created: '2026-04-03T00:00:00.000Z' },
  ]);
  assert.deepEqual(removed, []);
});

test('old owner-only comments still show, and a blocked person is left out', () => {
  const legacy = [{ text: 'Note to self', date: '2026-03-01T00:00:00.000Z', author: ADA, postUrl: POST }];
  const id = legacyCommentId(legacy[0]);
  const merged = mergeLegacy([], [], legacy);
  assert.equal(merged[0].id, id);
  const again = mergeLegacy([], [id], legacy);
  assert.equal(again.length, 0);
  assert.equal(mergeLegacy(merged, [], legacy).length, 1);

  const shown = presentThread({
    published: [
      { id: 'c1', author: BOB, text: 'Hi', date: '2026-04-01T00:00:00.000Z' },
      { id: 'c2', author: ADA, text: 'Mine', date: '2026-04-02T00:00:00.000Z' },
    ],
    own: [{ id: 'c3', postUrl: POST, text: 'Waiting', date: '2026-04-03T00:00:00.000Z' }],
    hiddenIds: [],
    blocked: [BOB],
    viewerWebId: ADA,
  });
  assert.deepEqual(
    shown.map((comment) => comment.id),
    ['c2', 'c3'],
  );
  assert.equal(shown.find((comment) => comment.id === 'c3').status, 'unpublished');

  const label = commenterLabel({ webId: BOB, me: ADA, name: 'Bob', nameReadable: false });
  assert.equal(label.primary, '@bob');
  const named = commenterLabel({ webId: BOB, me: ADA, name: 'Bob', nameReadable: true });
  assert.equal(named.primary, 'Bob');
  assert.equal(named.handle, '@bob');
});

test('hides, blocks, and reports stay private lists', () => {
  const hides = parseHides(serializeHides([{ postUrl: POST, id: 'c1' }]));
  assert.deepEqual(hides, [{ postUrl: POST, id: 'c1' }]);
  const blocks = parseBlocks(serializeBlocks([BOB, BOB]));
  assert.equal(blocks.length, 1);
  assert.deepEqual(filterBlocked([ADA, BOB], blocks), [ADA]);
  const reports = parseReports(
    serializeReports([
      { commentId: 'c1', authorWebId: BOB, postUrl: POST, text: 'spam', created: '2026-04-04T00:00:00.000Z' },
    ]),
  );
  assert.equal(reports[0].text, 'spam');
  assert.equal(reports[0].authorWebId, BOB);
});

test('success copy tells the truth about a missed inbox notice', () => {
  assert.match(commentResultCopy({ published: true, shared: true }, 'add'), /Published/);
  assert.match(commentResultCopy({ published: false, notified: true }, 'add'), /notified/);
  assert.match(commentResultCopy({ published: false, notified: false }, 'add'), /not notified/);
  assert.match(commentResultCopy({ published: false, notified: false }, 'delete'), /may still show/);
});
