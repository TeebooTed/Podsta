import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEEKLY_PROMPTS,
  dismissWeeklyPrompt,
  friendsPostedThisWeek,
  isWeeklyPromptDismissed,
  promptForDate,
  weekId,
} from '../src/lib/weeklyPrompt.js';

const ADA = 'https://ada.example/profile/card#me';

test('the week id follows the ISO week, including the year boundary', () => {
  assert.equal(weekId(new Date(2020, 11, 31)), '2020-W53');
  assert.equal(weekId(new Date(2021, 0, 1)), '2020-W53');
  assert.equal(weekId(new Date(2026, 0, 1)), '2026-W01');
});

test('the same week keeps one prompt, and the list stays short', () => {
  assert.equal(WEEKLY_PROMPTS.length, 10);
  assert.ok(WEEKLY_PROMPTS.includes('Something green'));
  assert.equal(new Set(WEEKLY_PROMPTS).size, WEEKLY_PROMPTS.length);
  const wednesday = new Date(2026, 9, 21);
  const thursday = new Date(2026, 9, 22);
  assert.equal(promptForDate(wednesday), promptForDate(thursday));
  assert.equal(WEEKLY_PROMPTS.includes(promptForDate(wednesday)), true);
});

test('a prompt needs a followed post from the last seven days', () => {
  const now = new Date('2026-10-21T12:00:00.000Z');
  const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const edge = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const old = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(friendsPostedThisWeek([{ dateCreated: recent }], now), true);
  assert.equal(friendsPostedThisWeek([{ dateCreated: edge }], now), true);
  assert.equal(friendsPostedThisWeek([{ dateCreated: old }], now), false);
  assert.equal(friendsPostedThisWeek([{ dateCreated: 'not-a-date' }, {}], now), false);
  assert.equal(friendsPostedThisWeek([], now), false);
});

test('skipping lasts for this week and this person only', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  };
  const now = new Date(2026, 9, 21);
  const nextWeek = new Date(2026, 9, 28);
  assert.equal(isWeeklyPromptDismissed(storage, ADA, now), false);
  dismissWeeklyPrompt(storage, ADA, now);
  assert.equal(isWeeklyPromptDismissed(storage, ADA, now), true);
  assert.equal(isWeeklyPromptDismissed(storage, 'https://bob.example/profile/card#me', now), false);
  assert.equal(isWeeklyPromptDismissed(storage, ADA, nextWeek), false);
  assert.equal(isWeeklyPromptDismissed(null, ADA, now), true);
  assert.equal(isWeeklyPromptDismissed(storage, '', now), true);
});
