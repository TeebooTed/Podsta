import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNotice } from '../src/lib/contactRequest.js';
import {
  INVITE_CONNECT_KEY,
  connectPair,
  consumeInviteConnect,
  inviteAcceptTurtle,
  parseInviteAccept,
  planInviteAccept,
  planInviteReturn,
  rememberInviteConnect,
} from '../src/lib/inviteConnect.js';

const ME = 'https://ada.solidcommunity.net/profile/card#me';
const BOB = 'https://bob.solidcommunity.net/profile/card#me';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('an invite connection is remembered once across the sign-in redirect', () => {
  const storage = memoryStorage();
  rememberInviteConnect(storage, 'bob.solidcommunity.net/profile/card');
  assert.equal(storage.getItem(INVITE_CONNECT_KEY), BOB);
  assert.equal(consumeInviteConnect(storage), BOB);
  assert.equal(storage.getItem(INVITE_CONNECT_KEY), null);
  assert.equal(consumeInviteConnect(storage), '');
  rememberInviteConnect(storage, 'not a person');
  assert.equal(storage.getItem(INVITE_CONNECT_KEY), null);
});

test('an invite accept names both people and survives the inbox parser', () => {
  const turtle = inviteAcceptTurtle({
    authorWebId: ME,
    recipientWebId: BOB,
    created: '2026-04-08T12:00:00.000Z',
  });
  assert.match(turtle, /podsta:InviteAccept/);
  assert.equal(parseInviteAccept(turtle).authorWebId, ME);
  assert.equal(parseInviteAccept(turtle).recipientWebId, BOB);
  assert.equal(parseNotice(turtle).kind, 'invite-accept');
  assert.equal(parseInviteAccept('not a notice'), null);
  assert.throws(() => inviteAcceptTurtle({ authorWebId: 'javascript:alert(1)', recipientWebId: BOB }));
});

test('opening an invite follows, approves, and notifies; the return does not notify again', () => {
  assert.deepEqual(planInviteAccept({ me: ME, inviter: BOB }), {
    follow: true,
    contact: true,
    notify: true,
    webId: BOB,
  });
  assert.deepEqual(
    planInviteAccept({ me: ME, inviter: BOB, following: true, contact: true }),
    { follow: false, contact: false, notify: true, webId: BOB },
  );
  assert.deepEqual(planInviteAccept({ me: ME, inviter: ME }), {
    follow: false,
    contact: false,
    notify: false,
    webId: '',
  });
  assert.deepEqual(planInviteReturn({ me: BOB, invitee: ME, following: true }), {
    follow: false,
    contact: true,
    webId: ME,
  });
  assert.deepEqual(planInviteReturn({ me: BOB, invitee: BOB }), {
    follow: false,
    contact: false,
    webId: '',
  });
});

test('connecting loads the contact list before adding someone', async () => {
  const followed = [];
  const saved = [];
  const notices = [];
  const result = await connectPair({
    podUrl: 'https://ada.solidcommunity.net/',
    session: { info: { webId: ME }, fetch: async () => ({ ok: true, status: 201 }) },
    webId: BOB,
    discoverability: 'hidden',
    notify: true,
    followPerson: async ({ webId }) => {
      followed.push(webId);
      return { webId, name: 'Bob' };
    },
    loadContacts: async () => ['https://cara.solidcommunity.net/profile/card#me'],
    saveContacts: async ({ webIds }) => {
      saved.push(webIds);
      return webIds;
    },
    sendNotice: async ({ targetWebId }) => {
      notices.push(targetWebId);
      return { delivered: true, error: '' };
    },
  });
  assert.deepEqual(followed, [BOB]);
  assert.equal(saved[0].length, 2);
  assert.ok(saved[0].includes('https://cara.solidcommunity.net/profile/card#me'));
  assert.ok(saved[0].includes(BOB));
  assert.deepEqual(notices, [BOB]);
  assert.equal(result.followed.name, 'Bob');
  assert.equal(result.notice.delivered, true);
});
