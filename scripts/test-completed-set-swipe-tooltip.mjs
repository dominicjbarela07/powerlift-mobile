import assert from 'node:assert/strict';

import {
  completedSetSwipeTooltipEnabled,
  completedSetSwipeTooltipStorageKey,
  createCompletedSetSwipeTooltipStorage,
  shouldShowCompletedSetSwipeTooltip,
} from '../lib/completed-set-swipe-tooltip-core.ts';

const values = new Map();
const storage = createCompletedSetSwipeTooltipStorage({
  getItem: async (key) => values.get(key) || null,
  setItem: async (key, value) => { values.set(key, value); },
});

assert.equal(completedSetSwipeTooltipEnabled, true);
assert.equal(await storage.hasBeenShown(7), false);
assert.equal(shouldShowCompletedSetSwipeTooltip({ hasBeenShown: false, isPersistedNewSet: true, setLogId: 12 }), true);
assert.equal(shouldShowCompletedSetSwipeTooltip({ hasBeenShown: false, isPersistedNewSet: false, setLogId: 12 }), false);
assert.equal(shouldShowCompletedSetSwipeTooltip({ hasBeenShown: false, isPersistedNewSet: true, setLogId: null }), false);
assert.equal(shouldShowCompletedSetSwipeTooltip({ enabled: false, hasBeenShown: false, isPersistedNewSet: true, setLogId: 12 }), false);

await storage.markShown(7);
assert.equal(values.get(completedSetSwipeTooltipStorageKey(7)), 'shown');
assert.equal(await storage.hasBeenShown(7), true);
const reopenedStorage = createCompletedSetSwipeTooltipStorage({
  getItem: async (key) => values.get(key) || null,
  setItem: async (key, value) => { values.set(key, value); },
});
assert.equal(await reopenedStorage.hasBeenShown(7), true);
assert.equal(await storage.hasBeenShown(8), false);
assert.equal(shouldShowCompletedSetSwipeTooltip({ hasBeenShown: true, isPersistedNewSet: true, setLogId: 12 }), false);

console.log('[completed-set-swipe-tooltip] state, workout persistence, replay suppression, and enablement tests passed');
