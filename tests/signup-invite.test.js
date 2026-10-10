import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { displayHandle, parsePersonInput } from '../src/lib/handles.js';
import {
  invitePath,
  inviteUrl,
  webIdFromInvite,
  sameOriginRedirect,
  rememberSignup,
  consumeSignup,
  rememberFollow,
  consumeFollow,
  strangerNotice,
  SIGNUP_KEY,
  FOLLOW_KEY,
} from '../src/lib/invite.js';
import { RECOMMENDED_PROVIDER, SIGNUP_STEPS, OTHER_PROVIDERS } from '../src/lib/provider.js';
import { ONBOARDING_STEPS } from '../src/lib/onboarding.js';
import { sectionFromPath } from '../src/lib/navigation.js';

const ADA = 'https://ada.solidcommunity.net/profile/card#me';
const PATH_STYLE = 'https://solidcommunity.net/ada/profile/card#me';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('a short name is derived from the WebID and is not a registry entry', () => {
  assert.deepEqual(displayHandle(ADA), {
    handle: '@ada',
    qualified: '@ada@solidcommunity.net',
    user: 'ada',
    host: 'solidcommunity.net',
  });
  assert.equal(displayHandle(PATH_STYLE).qualified, '@ada@solidcommunity.net');
  assert.equal(
    displayHandle('https://bob.solidweb.org/profile/card#me').qualified,
    '@bob@solidweb.org',
  );
  assert.notEqual(
    displayHandle(ADA).qualified,
    displayHandle('https://ada.solidweb.org/profile/card#me').qualified,
  );
});

test('a bare @name means the recommended provider, and @name@host stays explicit', () => {
  assert.equal(parsePersonInput('@Ada'), ADA);
  assert.equal(parsePersonInput('ada'), ADA);
  assert.equal(parsePersonInput('@ada@solidweb.org'), 'https://ada.solidweb.org/profile/card#me');
  assert.equal(parsePersonInput(ADA), ADA);
  assert.equal(parsePersonInput('https://ada.example/profile/card'), 'https://ada.example/profile/card#me');
  assert.equal(parsePersonInput('@ada@localhost'), null);
  assert.equal(parsePersonInput('not a person'), null);
  assert.equal(parsePersonInput(''), null);
  assert.equal(RECOMMENDED_PROVIDER.host, 'solidcommunity.net');
});

test('an invite link round-trips the WebID and cannot redirect off this app', () => {
  const path = invitePath(ADA);
  assert.equal(webIdFromInvite(path.split('?')[1]), ADA);
  assert.equal(inviteUrl('https://podsta.example/', ADA), `https://podsta.example${path}`);
  assert.equal(
    sameOriginRedirect('https://podsta.example/invite?webid=1', 'https://podsta.example'),
    'https://podsta.example/invite?webid=1',
  );
  assert.equal(
    sameOriginRedirect('https://evil.example/phish', 'https://podsta.example'),
    'https://podsta.example/',
  );
  assert.equal(
    sameOriginRedirect('javascript:alert(1)', 'https://podsta.example'),
    'https://podsta.example/',
  );
});

test('signup and follow intents survive one redirect and are then forgotten', () => {
  const storage = memoryStorage();
  rememberSignup(storage);
  assert.equal(storage.getItem(SIGNUP_KEY), '1');
  assert.equal(consumeSignup(storage), true);
  assert.equal(consumeSignup(storage), false);

  rememberFollow(storage, 'ada.solidcommunity.net/profile/card');
  assert.equal(consumeFollow(storage), ADA);
  assert.equal(storage.getItem(FOLLOW_KEY), null);
  assert.equal(consumeFollow(storage), '');
});

test('a private invite explains that the link does not open the profile', () => {
  assert.match(strangerNotice({ profileShared: false, posts: [] }), /Hidden and Contacts/);
  assert.match(strangerNotice({ profileShared: false, posts: [] }), /does not open/);
  assert.match(strangerNotice({ profileShared: false, posts: [{ url: 'https://ada.example/a.jpg' }] }), /not public/);
  assert.equal(strangerNotice({ profileShared: true, posts: [] }), '');
});

test('a stranger view does not read the contacts index', () => {
  const source = readFileSync(new URL('../src/lib/stranger.js', import.meta.url), 'utf8');
  assert.equal(source.includes('readContactsIndex'), false);
  assert.equal(source.includes('contacts-index'), false);
  assert.equal(source.includes('contactsIndex'), false);
  assert.match(source, /readPublicIndex/);
});

test('new people are sent to Solid Community, and a short name is not described as registered', () => {
  assert.equal(RECOMMENDED_PROVIDER.issuer, 'https://solidcommunity.net');
  assert.match(RECOMMENDED_PROVIDER.registerUrl, /solidcommunity\.net/);
  assert.equal(SIGNUP_STEPS.length, 4);
  const copy = SIGNUP_STEPS.map((step) => `${step.title} ${step.body}`).join(' ');
  assert.match(copy, /solidcommunity\.net/);
  assert.match(copy, /never sees the password/);
  assert.equal(/registry/i.test(copy), false);
  assert.equal(
    OTHER_PROVIDERS.some((provider) => provider.url === 'https://login.inrupt.com'),
    true,
  );
  assert.equal(OTHER_PROVIDERS.some((provider) => provider.url === RECOMMENDED_PROVIDER.issuer), false);

  const webid = ONBOARDING_STEPS.find((step) => step.id === 'webid');
  assert.match(webid.body, /invite link/);
  assert.match(webid.body, /not a global registry/);
  assert.equal(sectionFromPath('/start'), 'start');
  assert.equal(sectionFromPath('/invite'), 'invite');
  assert.equal(sectionFromPath('/'), 'home');
});
