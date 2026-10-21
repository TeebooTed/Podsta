import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEEKLY_PROMPTS,
  dismissWeeklyPrompt,
  friendsAreActive,
  promptDismissed,
  promptForDate,
} from '../src/lib/weeklyPrompt.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test('the same week always offers the same prompt', () => {
  const monday = new Date('2026-04-06T15:00:00.000Z');
  const sunday = new Date('2026-04-12T15:00:00.000Z');
  const next = new Date('2026-04-13T15:00:00.000Z');
  const first = promptForDate(monday);
  assert.equal(first.week, 15);
  assert.equal(promptForDate(sunday).title, first.title);
  assert.notEqual(promptForDate(next).title, first.title);
  assert.equal(WEEKLY_PROMPTS.length, 12);
  assert.ok(first.title);
  assert.ok(first.body);
});

test('a prompt is for an active friend graph only', () => {
  const now = Date.parse('2026-04-08T12:00:00.000Z');
  assert.equal(
    friendsAreActive([{ dateCreated: '2026-04-07T12:00:00.000Z' }], now),
    true,
  );
  assert.equal(
    friendsAreActive([{ dateCreated: '2026-03-01T12:00:00.000Z' }], now),
    false,
  );
  assert.equal(friendsAreActive([], now), false);
  assert.equal(friendsAreActive([{ dateCreated: 'not a date' }], now), false);
  const prompt = promptForDate(new Date(now));
  const storage = memoryStorage();
  assert.equal(promptDismissed(storage, 'https://ada.example/profile/card#me', prompt), false);
  dismissWeeklyPrompt(storage, 'https://ada.example/profile/card#me', prompt);
  assert.equal(promptDismissed(storage, 'https://ada.example/profile/card#me', prompt), true);
  assert.equal(promptDismissed(storage, 'https://bob.example/profile/card#me', prompt), false);
});
