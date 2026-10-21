import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WHATS_NEW,
  WHATS_NEW_ID,
  WHATS_NEW_KEY,
  markWhatsNewSeen,
  whatsNewState,
} from '../src/lib/whatsNew.js';
import { markOnboardingDone } from '../src/lib/onboarding.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

const ME = 'https://pod.example/ada/profile/card#me';

test('someone who finished the tour sees the list once', () => {
  const storage = memoryStorage();
  markOnboardingDone(storage, ME);
  assert.equal(whatsNewState(storage, ME), 'show');
  markWhatsNewSeen(storage);
  assert.equal(storage.getItem(WHATS_NEW_KEY), WHATS_NEW_ID);
  assert.equal(whatsNewState(storage, ME), 'seen');
});

test('a brand-new person on the tour is not shown a second sheet', () => {
  assert.equal(whatsNewState(memoryStorage(), ME), 'new-user');
});

test('an older list counts as unseen', () => {
  const storage = memoryStorage();
  markOnboardingDone(storage, ME);
  storage.setItem(WHATS_NEW_KEY, '2020-01');
  assert.equal(whatsNewState(storage, ME), 'show');
});

test('no storage or no address means no sheet', () => {
  assert.equal(whatsNewState(null, ME), 'skip');
  assert.equal(whatsNewState(memoryStorage(), ''), 'skip');
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(whatsNewState(broken, ME), 'skip');
  assert.doesNotThrow(() =>
    markWhatsNewSeen({
      setItem: () => {
        throw new Error('full');
      },
    }),
  );
});

test('the list is short and every item has a title and body', () => {
  assert.ok(WHATS_NEW.length > 0 && WHATS_NEW.length <= 6);
  for (const item of WHATS_NEW) assert.ok(item.id && item.title && item.body && item.tint);
});
