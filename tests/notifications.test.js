import test from 'node:test';
import assert from 'node:assert/strict';
import { PATHS, sectionFromPath } from '../src/lib/navigation.js';
import { PHONE_NAV, DESKTOP_NAV } from '../src/lib/navigation.js';
import {
  acknowledge,
  baselineSeen,
  nextSeenAfterPoll,
  readSeen,
  seenStorageKey,
  trimSeen,
  unseenItems,
  writeSeen,
} from '../src/lib/seenState.js';
import {
  POLL_BASE_MS,
  POLL_CHANNEL_MS,
  POLL_MAX_MS,
  nextPollDelay,
  pollStatusCopy,
  sourceOutcome,
} from '../src/lib/pollSchedule.js';
import {
  parseNotificationLinks,
  receiveFromResponse,
  safeChannelUrl,
  subscriptionBody,
  openSolidChannel,
} from '../src/lib/solidChannel.js';
import {
  contactNoticeTurtle,
  parseContactRequests,
  parseContainedUrls,
  parseMemberIris,
  parseNotice,
  resolveContained,
  responseDisposition,
  serializeContactRequests,
} from '../src/lib/contactRequest.js';
import { readPublicIndex } from '../src/lib/publicIndex.js';
import {
  badgeLabel,
  badgeText,
  buildNotifications,
  collectNotifications,
  mergeNotificationPoll,
} from '../src/lib/notifications.js';

const ME = 'https://me.example/profile/card#me';
const ADA = 'https://ada.example/profile/card#me';
const BOB = 'https://bob.example/profile/card#me';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test('notifications stay off the phone and desktop tab bars', () => {
  assert.equal(PATHS.notifications, '/notifications');
  assert.equal(sectionFromPath('/notifications'), 'notifications');
  assert.deepEqual(
    PHONE_NAV.map((item) => item.label),
    ['Home', 'Discover', 'New post', 'Profile'],
  );
  assert.deepEqual(
    DESKTOP_NAV.map((item) => item.label),
    ['Home', 'Discover', 'Profile'],
  );
});

test('the first check is a baseline so old posts do not light the badge', () => {
  const storage = memoryStorage();
  assert.equal(readSeen(storage, ME).initialized, false);
  const current = [{ id: 'post:a' }, { id: 'post:b' }];
  const baseline = baselineSeen(current);
  writeSeen(storage, ME, baseline);
  assert.equal(unseenItems(current, readSeen(storage, ME)).length, 0);
  const later = [...current, { id: 'post:c' }];
  assert.deepEqual(
    unseenItems(later, readSeen(storage, ME)).map((item) => item.id),
    ['post:c'],
  );
  assert.match(seenStorageKey(ME), /podsta\.notifications\.seen:/);
});

test('a partial check still baselines, and a total failure does not', () => {
  const request = [{ id: 'request:ada' }];
  const partial = nextSeenAfterPoll({ initialized: false, ids: [] }, request, { failed: 1, failedAll: false });
  assert.equal(partial.initialized, true);
  assert.deepEqual(partial.ids, ['request:ada']);
  const kept = nextSeenAfterPoll(partial, [...request, { id: 'post:new' }], { failed: 0, failedAll: false });
  assert.deepEqual(kept.ids, ['request:ada']);
  const blocked = nextSeenAfterPoll({ initialized: false, ids: [] }, [], { failed: 2, failedAll: true });
  assert.equal(blocked.initialized, false);
  const clean = nextSeenAfterPoll({ initialized: false, ids: [] }, [{ id: 'post:old' }], { failed: 0 });
  assert.deepEqual(clean.ids, ['post:old']);
});

test('seen state ignores a broken record and caps old ids', () => {
  const storage = memoryStorage();
  storage.setItem(seenStorageKey(ME), '{');
  assert.equal(readSeen(storage, ME).initialized, false);
  const trimmed = trimSeen(['old', 'keep'], ['keep'], 1);
  assert.deepEqual(trimmed, ['keep']);
  const acked = acknowledge({ initialized: true, ids: ['old'] }, ['post:1'], ['post:1'], 2);
  assert.equal(acked.initialized, true);
  assert.ok(acked.ids.includes('post:1'));
});

test('a failed poll waits longer, and a live channel slows the timer', () => {
  assert.equal(nextPollDelay(), POLL_BASE_MS);
  assert.equal(nextPollDelay({ hidden: true }), null);
  assert.equal(nextPollDelay({ failed: true, previousDelay: POLL_BASE_MS }), POLL_BASE_MS * 2);
  assert.equal(nextPollDelay({ failed: true, previousDelay: POLL_MAX_MS }), POLL_MAX_MS);
  assert.equal(nextPollDelay({ channelConnected: true }), POLL_CHANNEL_MS);
  assert.match(pollStatusCopy({ failing: true }), /wait longer/);
  assert.match(pollStatusCopy({ channelConnected: true }), /live channel/);
  assert.equal(sourceOutcome(['ok', 'failed']).failedAll, false);
  assert.equal(sourceOutcome(['failed', 'failed']).failedAll, true);
});

test('a Solid Link header points at the streaming channel', () => {
  const header =
    '<https://solidcommunity.net/.notifications/StreamingHTTPChannel2023/b0>; rel="http://www.w3.org/ns/solid/terms#updatesViaStreamingHttp2023", <wss://notify.example/socket>; rel="http://www.w3.org/ns/solid/terms#updatesViaWebSocket2023"';
  const links = parseNotificationLinks(header);
  assert.equal(links.streamingHttp, 'https://solidcommunity.net/.notifications/StreamingHTTPChannel2023/b0');
  assert.equal(links.websocket, 'wss://notify.example/socket');
  assert.equal(safeChannelUrl('javascript:alert(1)'), null);
  assert.match(subscriptionBody('http://www.w3.org/ns/solid/notifications#StreamingHTTPChannel2023', 'https://pod.example/inbox/'), /pod\.example/);
  assert.throws(() => subscriptionBody('t', 'javascript:alert(1)'));
  assert.equal(receiveFromResponse({ receiveFrom: 'https://notify.example/receive' }), 'https://notify.example/receive');
  assert.equal(receiveFromResponse({ receiveFrom: 'http://evil.example/x' }), null);
});

test('a streaming channel wakes the poll and does not invent a notification', async () => {
  const wakes = [];
  const fetchFn = async (url, options = {}) => {
    if (options.method === 'HEAD') {
      return {
        ok: true,
        headers: {
          get: (name) =>
            name.toLowerCase() === 'link'
              ? '<https://notify.example/stream>; rel="http://www.w3.org/ns/solid/terms#updatesViaStreamingHttp2023"'
              : '',
        },
      };
    }
    if (url === 'https://notify.example/stream') {
      return { ok: true, json: async () => ({ receiveFrom: 'https://notify.example/receive' }) };
    }
    const encoder = new TextEncoder();
    return {
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"type":"Update"}'));
          controller.close();
        },
      }),
    };
  };
  const handle = await openSolidChannel({
    fetchFn,
    resourceUrl: 'https://pod.example/inbox/',
    onWake: () => wakes.push('wake'),
  });
  assert.equal(handle.connected, true);
  assert.equal(handle.kind, 'streaming-http');
  await handle.done;
  assert.deepEqual(wakes, ['wake']);
});

test('contact requests round-trip and reject a script URL', () => {
  const turtle = serializeContactRequests([
    { authorWebId: ADA, recipientWebId: ME, created: '2026-04-01T12:00:00.000Z' },
  ]);
  const parsed = parseContactRequests(turtle);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].authorWebId, ADA);
  assert.equal(parsed[0].recipientWebId, ME);
  assert.throws(() =>
    contactNoticeTurtle({
      kind: 'request',
      authorWebId: 'javascript:alert(1)',
      recipientWebId: ME,
      created: '2026-04-01T12:00:00.000Z',
    }),
  );
  const notice = contactNoticeTurtle({
    kind: 'approval',
    authorWebId: ADA,
    recipientWebId: ME,
    created: '2026-04-02T12:00:00.000Z',
  });
  assert.equal(parseNotice(notice).kind, 'contact-approval');
  assert.equal(parseNotice(notice).authorWebId, ADA);
});

test('an inbox listing and a contacts group can be read back', () => {
  const listing = '@prefix ldp: <http://www.w3.org/ns/ldp#> .\n<> ldp:contains <note-1.ttl>, <note-2.ttl> .';
  assert.deepEqual(resolveContained('https://pod.example/inbox/', parseContainedUrls(listing)), [
    'https://pod.example/inbox/note-1.ttl',
    'https://pod.example/inbox/note-2.ttl',
  ]);
  const css = [
    '@prefix ldp: <http://www.w3.org/ns/ldp#>.',
    '@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.',
    '<> a ldp:Container, ldp:BasicContainer;',
    '    dc:modified "2026-10-10T03:12:06.334Z"^^xsd:dateTime;',
    '    posix:mtime 1791601926.',
    '<7c537daa-6bb8-4b1a-a921-45348bb3960d> a ldp:Resource, <http://www.w3.org/ns/iana/media-types/text/turtle#Resource>;',
    '    posix:mtime "2026-10-10T03:12:06.334Z"^^xsd:dateTime.',
    '<> ldp:contains <7c537daa-6bb8-4b1a-a921-45348bb3960d>.',
  ].join('\n');
  assert.deepEqual(resolveContained('https://pod.example/inbox/', parseContainedUrls(css)), [
    'https://pod.example/inbox/7c537daa-6bb8-4b1a-a921-45348bb3960d',
  ]);
  const group = '<> <http://www.w3.org/2006/vcard/ns#hasMember> <https://ada.example/profile/card#me> .';
  assert.deepEqual(parseMemberIris(group), [ADA]);
  assert.equal(responseDisposition(404), 'absent');
  assert.equal(responseDisposition(401), 'absent');
  assert.equal(responseDisposition(0), 'unreadable');
  assert.equal(responseDisposition(304), 'unreadable');
  assert.equal(responseDisposition(429), 'unreadable');
  assert.equal(responseDisposition(200), 'read');
});

test('notifications skip your own comments and keep one request', () => {
  const items = buildNotifications({
    webId: ME,
    feedEntries: [
      {
        url: 'https://ada.example/podsta/photos/a.jpg',
        dateCreated: '2026-04-02T00:00:00.000Z',
        ownerWebId: ADA,
        ownerName: 'Ada',
        caption: 'Morning',
      },
    ],
    commentThreads: [
      {
        postUrl: 'https://me.example/podsta/posts/1.ttl',
        comments: [
          { text: 'mine', date: '2026-04-03T00:00:00.000Z', author: ME },
          { text: 'hello', date: '2026-04-03T01:00:00.000Z', author: BOB },
        ],
      },
    ],
    requests: [
      { authorWebId: ADA, recipientWebId: ME, created: '2026-04-01T00:00:00.000Z', authorName: 'Ada' },
      { authorWebId: ADA, recipientWebId: ME, created: '2026-04-04T00:00:00.000Z', authorName: 'Ada' },
      { authorWebId: BOB, recipientWebId: ADA, created: '2026-04-04T00:00:00.000Z' },
    ],
    approvals: [{ webId: BOB, created: '2026-04-05T00:00:00.000Z', name: 'Bob' }],
  });
  assert.deepEqual(
    items.map((item) => item.kind),
    ['contact-approval', 'contact-request', 'comment', 'post'],
  );
  assert.equal(items.filter((item) => item.kind === 'contact-request').length, 1);
  assert.equal(items.find((item) => item.kind === 'comment').detail, 'hello');
  const unnamed = buildNotifications({
    webId: ME,
    requests: [
      {
        authorWebId: 'https://ada.solidcommunity.net/profile/card#me',
        recipientWebId: ME,
        created: '2026-04-01T00:00:00.000Z',
        authorName: 'profile',
      },
    ],
  });
  assert.equal(unnamed[0].title, '@ada asked to be a contact');
  assert.equal(badgeLabel(0), 'Notifications');
  assert.equal(badgeLabel(2), 'Notifications, 2 new');
  assert.equal(badgeText(12), '9+');
});

test('a followed pod can deliver a request when the inbox is empty', async () => {
  const result = await collectNotifications({
    webId: ME,
    podUrl: 'https://me.example/',
    friends: [{ webId: ADA, podUrl: 'https://ada.example/', name: 'Ada' }],
    posts: [{ url: 'https://me.example/podsta/posts/1.ttl', dateCreated: '2026-04-01T00:00:00.000Z' }],
    loadFeed: async () => ({
      entries: [
        {
          url: 'https://ada.example/podsta/photos/new.jpg',
          dateCreated: '2026-04-06T00:00:00.000Z',
          caption: 'New',
        },
      ],
      unreachable: 0,
    }),
    loadCommentsForPost: async () => ({ comments: [], error: null }),
    readRequests: async (podUrl) => {
      if (podUrl === 'https://ada.example/') {
        return [{ authorWebId: ADA, recipientWebId: ME, created: '2026-04-06T01:00:00.000Z' }];
      }
      return [{ authorWebId: ME, recipientWebId: BOB, created: '2026-04-01T00:00:00.000Z' }];
    },
    readMembers: async () => [ME],
    readInbox: async () => [],
    podUrlForWebId: async () => 'https://bob.example/',
  });
  const kinds = result.items.map((item) => item.kind);
  assert.ok(kinds.includes('post'));
  assert.ok(kinds.includes('contact-request'));
  assert.ok(kinds.includes('contact-approval'));
  assert.deepEqual(result.outgoingTargets, [BOB]);
  assert.equal(result.failedAll, false);
});

test('a feed index read does not reuse the browser cache', async () => {
  let cache = '';
  const fetchFn = async (_url, init = {}) => {
    cache = init.cache || '';
    return new Response('missing', { status: 404 });
  };
  assert.deepEqual(await readPublicIndex('https://ada.example/', fetchFn), []);
  assert.equal(cache, 'no-store');
});

test('a failed check keeps notifications the previous check already found', () => {
  const kept = [{ id: 'contact-request:ada', kind: 'contact-request', created: '2026-04-01T00:00:00.000Z' }];
  const merged = mergeNotificationPoll(kept, [], { failed: 1 });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, kept[0].id);
  assert.deepEqual(mergeNotificationPoll(kept, [], { failed: 0 }), []);
});

test('a private contacts group is not treated as an approval', async () => {
  const result = await collectNotifications({
    webId: ME,
    podUrl: 'https://me.example/',
    friends: [],
    posts: [],
    loadFeed: async () => ({ entries: [], unreachable: 0 }),
    readRequests: async () => [{ authorWebId: ME, recipientWebId: BOB, created: '2026-04-01T00:00:00.000Z' }],
    readMembers: async () => [],
    readInbox: async () => [],
    podUrlForWebId: async () => 'https://bob.example/',
  });
  assert.equal(result.items.some((item) => item.kind === 'contact-approval'), false);
});
