import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DESKTOP_NAV,
  PHONE_NAV,
  PATHS,
  personPath,
  postPath,
  appPostUrl,
  sectionFromPath,
  emptyFeedCopy,
  feedErrorCopy,
} from '../src/lib/navigation.js';
import {
  ONBOARDING_STEPS,
  hasFinishedOnboarding,
  markOnboardingDone,
} from '../src/lib/onboarding.js';
import { mergeFeedResults } from '../src/lib/feed.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test('phone navigation is Home, Discover, New post, Profile', () => {
  assert.deepEqual(
    PHONE_NAV.map((item) => item.label),
    ['Home', 'Discover', 'New post', 'Profile'],
  );
  assert.equal(PHONE_NAV[2].action, 'compose');
  assert.equal(PHONE_NAV.filter((item) => item.to).length, 3);
});

test('desktop navigation has no separate Friends tab', () => {
  const labels = DESKTOP_NAV.map((item) => item.label);
  assert.deepEqual(labels, ['Home', 'Discover', 'Profile']);
  assert.equal(labels.includes('Friends'), false);
  assert.equal(DESKTOP_NAV[0].to, PATHS.home);
  assert.equal(PATHS.home, '/');
});

test('routes point Home at the feed and keep profile and discover', () => {
  assert.equal(sectionFromPath('/'), 'home');
  assert.equal(sectionFromPath('/discover'), 'discover');
  assert.equal(sectionFromPath('/profile'), 'profile');
  assert.equal(sectionFromPath('/people'), 'people');
  assert.equal(sectionFromPath('/post'), 'post');
  assert.match(personPath('https://ada.example/profile/card#me'), /webid=https%3A%2F%2Fada.example/);
  assert.equal(
    appPostUrl('https://podsta.example/', 'https://ada.example/podsta/photos/a.jpg'),
    'https://podsta.example' + postPath('https://ada.example/podsta/photos/a.jpg'),
  );
});

test('an empty feed tells a new person to copy a WebID or follow someone', () => {
  const copy = emptyFeedCopy();
  assert.match(copy.title, /one person/);
  assert.match(copy.message, /WebID/);
  assert.equal(copy.followPath, '/discover');
  assert.equal(copy.copyLabel, 'Copy my WebID');
  assert.equal(copy.followLabel, 'Follow someone');
});

test('a failed feed names how many Pods did not respond', () => {
  const copy = feedErrorCopy(2);
  assert.match(copy.message, /2 Pods/);
  assert.equal(copy.retryLabel, 'Try again');
});

test('onboarding can be skipped and is remembered per WebID', () => {
  const storage = memoryStorage();
  const webId = 'https://ada.example/profile/card#me';
  assert.equal(hasFinishedOnboarding(storage, webId), false);
  assert.equal(ONBOARDING_STEPS[0].id, 'pod');
  assert.equal(ONBOARDING_STEPS.at(-1).id, 'compose');
  assert.ok(ONBOARDING_STEPS.some((step) => step.id === 'webid'));
  assert.ok(ONBOARDING_STEPS.some((step) => step.id === 'visibility'));
  markOnboardingDone(storage, webId);
  assert.equal(hasFinishedOnboarding(storage, webId), true);
  assert.equal(hasFinishedOnboarding(storage, 'https://someone.else/profile/card#me'), false);
});

test('feed merges successful friends and counts the ones it could not reach', () => {
  const merged = mergeFeedResults([
    {
      status: 'fulfilled',
      value: [{ url: 'https://a.example/old', dateCreated: '2026-01-01T00:00:00.000Z' }],
    },
    { status: 'rejected', reason: new Error('timeout') },
    {
      status: 'fulfilled',
      value: [{ url: 'https://b.example/new', dateCreated: '2026-04-01T00:00:00.000Z' }],
    },
  ]);
  assert.equal(merged.unreachable, 1);
  assert.deepEqual(
    merged.entries.map((entry) => entry.url),
    ['https://b.example/new', 'https://a.example/old'],
  );
});
