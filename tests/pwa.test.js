import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldReloadForServiceWorkerUpdate } from '../src/lib/pwa.js';

test('only a visitor who already had a worker reloads when a new one takes control', () => {
  assert.equal(shouldReloadForServiceWorkerUpdate(false, false), false);
  assert.equal(shouldReloadForServiceWorkerUpdate(true, false), true);
  assert.equal(shouldReloadForServiceWorkerUpdate(true, true), false);
});
