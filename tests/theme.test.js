import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeTheme, readTheme, resolveTheme, writeTheme, THEME_KEY, THEME_COLORS } from '../src/lib/theme.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('an unknown or missing preference follows the system', () => {
  assert.equal(normalizeTheme(undefined), 'system');
  assert.equal(normalizeTheme('sepia'), 'system');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('nonsense', true), 'dark');
});

test('a forced choice wins over the system setting', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('the choice is stored, and Auto clears it', () => {
  const storage = memoryStorage();
  assert.equal(readTheme(storage), 'system');
  writeTheme(storage, 'dark');
  assert.equal(storage.getItem(THEME_KEY), 'dark');
  assert.equal(readTheme(storage), 'dark');
  writeTheme(storage, 'system');
  assert.equal(storage.getItem(THEME_KEY), null);
});

test('blocked storage does not throw', () => {
  const blocked = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(readTheme(blocked), 'system');
  assert.equal(writeTheme(blocked, 'light'), 'light');
});

test('the pre-paint script uses the same key and colors', () => {
  const script = readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8');
  assert.ok(script.includes(`'${THEME_KEY}'`));
  assert.ok(script.includes(THEME_COLORS.dark));
  assert.ok(script.includes(THEME_COLORS.light));
});
