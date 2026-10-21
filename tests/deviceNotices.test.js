import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNotifications } from '../src/lib/notifications.js';
import { inboxItemFromText } from '../src/lib/contactRequest.js';
import { noticeTurtle } from '../src/lib/likes.js';
import { emptySeen } from '../src/lib/seenState.js';
import {
  applyAppBadge,
  deviceCandidates,
  devicePromptChoice,
  dismissPrompt,
  hasDismissedPrompt,
  hasSocial,
  markSocial,
  readAnnounced,
  showDeviceNotices,
  takeFreshNotices,
  writeAnnounced,
} from '../src/lib/deviceNotices.js';

const ME = 'https://me.example/profile/card#me';
const ADA = 'https://ada.solidcommunity.net/profile/card#me';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

test('the prompt waits until a person has done something social', () => {
  assert.equal(devicePromptChoice({ social: false, permission: 'default' }), 'hidden');
  assert.equal(devicePromptChoice({ social: true, permission: 'default' }), 'ask');
  assert.equal(devicePromptChoice({ social: true, permission: 'granted' }), 'hidden');
  assert.equal(devicePromptChoice({ social: true, permission: 'denied' }), 'hidden');
  assert.equal(devicePromptChoice({ social: true, permission: 'default', dismissed: true }), 'hidden');
  const storage = memoryStorage();
  assert.equal(hasSocial(storage, ME), false);
  markSocial(ME, storage);
  assert.equal(hasSocial(storage, ME), true);
  assert.equal(hasSocial(storage, ADA), false);
  dismissPrompt(ME, storage);
  assert.equal(hasDismissedPrompt(storage, ME), true);
});

test('turning notices on stays quiet about what is already unseen', () => {
  const candidates = [
    { id: 'comment:1', kind: 'comment' },
    { id: 'post:1', kind: 'post' },
    { id: 'like:1', kind: 'like' },
  ];
  const seen = { initialized: true, ids: [] };
  const eligible = deviceCandidates(candidates, seen);
  assert.deepEqual(eligible.map((item) => item.id), ['comment:1', 'like:1']);
  const first = takeFreshNotices(readAnnounced(null, ME), eligible);
  assert.deepEqual(first.show, []);
  assert.equal(first.next.seeded, true);
  const later = takeFreshNotices(first.next, [
    ...eligible,
    { id: 'contact-request:ada', kind: 'contact-request', title: '@ada asked to be a contact' },
  ]);
  assert.deepEqual(
    later.show.map((item) => item.id),
    ['contact-request:ada'],
  );
  const storage = memoryStorage();
  writeAnnounced(storage, ME, later.next);
  assert.equal(readAnnounced(storage, ME).seeded, true);
  assert.equal(deviceCandidates([{ id: 'post:2', kind: 'post' }], emptySeen()).length, 0);
  assert.equal(
    deviceCandidates(
      [{ id: 'invite-accept:ada', kind: 'invite-accept' }],
      { initialized: true, ids: [] },
    ).length,
    1,
  );
});

test('a like in the inbox becomes a notification, and an unlike does not', () => {
  const like = inboxItemFromText(
    noticeTurtle({
      authorWebId: ADA,
      postUrl: 'https://me.example/podsta/posts/1.ttl',
      created: '2026-04-02T00:00:00.000Z',
    }),
  );
  assert.equal(like.kind, 'like');
  const removed = inboxItemFromText(
    noticeTurtle({
      authorWebId: ADA,
      postUrl: 'https://me.example/podsta/posts/1.ttl',
      created: '2026-04-02T01:00:00.000Z',
      removed: true,
    }),
  );
  assert.equal(removed, null);
  const items = buildNotifications({
    webId: ME,
    likes: [like, { authorWebId: ME, postUrl: 'https://me.example/podsta/posts/1.ttl' }],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'like');
  assert.equal(items[0].title, '@ada liked your post');
  assert.match(items[0].href, /\/post\?url=/);
});

test('the app badge tracks the unseen count and a notice uses the installed app', async () => {
  const calls = [];
  await applyAppBadge(2, {
    setAppBadge: async (count) => calls.push(['set', count]),
    clearAppBadge: async () => calls.push(['clear']),
  });
  await applyAppBadge(0, {
    setAppBadge: async (count) => calls.push(['set', count]),
    clearAppBadge: async () => calls.push(['clear']),
  });
  assert.deepEqual(calls, [['set', 2], ['clear']]);

  const shown = [];
  const ids = await showDeviceNotices(
    [
      { id: 'comment:1', kind: 'comment', title: '@ada commented on your post', detail: 'Hello', href: '/post?url=1' },
      { id: 'like:1', kind: 'like', title: '@bob liked your post' },
    ],
    {
      registration: {
        showNotification: async (title, options) => shown.push([title, options.tag, options.data.href]),
      },
      urlFor: (href) => `https://podsta.example${href || '/'}`,
    },
  );
  assert.deepEqual(ids, ['comment:1', 'like:1']);
  assert.equal(shown[0][0], '@ada commented on your post');
  assert.equal(shown[0][2], '/post?url=1');

  const notes = [];
  class FakeNote {
    constructor(title) {
      notes.push(title);
    }
  }
  const failed = await showDeviceNotices([{ id: 'like:2', title: 'Liked' }], {
    registration: {
      showNotification: async () => {
        throw new Error('denied');
      },
    },
    NotificationApi: FakeNote,
  });
  assert.deepEqual(failed, []);
  assert.deepEqual(notes, []);
});
