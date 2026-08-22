import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  accessorySwapActionForItem,
  itemHasPersistedSetLogs,
  persistedSetLogItemIds,
} from '../lib/accessory-swap-eligibility.ts';

const resolve = (overrides = {}) => accessorySwapActionForItem({
  canHotSwap: true,
  hasApprovedSubstitutions: false,
  isCoachPreview: false,
  sessionLifecycle: 'active_session',
  targetItemHasSetLogs: false,
  acceptedPersistedSetLogForItem: false,
  ...overrides,
});

const untouched = { id: 30, set_logs: [] };
const oneOfThree = { id: 31, set_logs: [{ id: 1 }] };
const twoOfThree = { id: 32, set_logs: [{ id: 2 }, { id: 3 }] };
const threeOfThree = { id: 33, set_logs: [{ id: 4 }, { id: 5 }, { id: 6 }] };
const untouchedFour = { id: 34, set_logs: [] };

assert.equal(resolve(), 'Swap', 'active Session + untouched target shows Swap');
assert.equal(resolve({ targetItemHasSetLogs: itemHasPersistedSetLogs(oneOfThree) }), 'Swap', 'one persisted target SetLog preserves future-set Swap');
assert.equal(resolve({ targetItemHasSetLogs: itemHasPersistedSetLogs(twoOfThree) }), 'Swap', '2/3 target completion preserves future-set Swap');
assert.equal(resolve({ targetItemHasSetLogs: itemHasPersistedSetLogs(threeOfThree) }), 'Swap', 'completed target still permits correction while Session is active');
assert.equal(resolve({ acceptedPersistedSetLogForItem: true }), 'Swap', 'successful persistence does not hide future-set Swap');
assert.equal(resolve({ acceptedPersistedSetLogForItem: false }), 'Swap', 'failed first persistence keeps target Swap');

const multiItemSession = {
  core_items: [{ id: 10, set_logs: [{ id: 10 }] }],
  accessory_groups: [{ items: [twoOfThree, untouched, untouchedFour] }],
};
assert.deepEqual(persistedSetLogItemIds(multiItemSession), [10, 32], 'persisted evidence is indexed by its own movement item');
assert.equal(resolve({ targetItemHasSetLogs: itemHasPersistedSetLogs(twoOfThree) }), 'Swap', 'accessory A at 2/3 remains swappable for future sets');
assert.equal(resolve({ targetItemHasSetLogs: itemHasPersistedSetLogs(untouched) }), 'Swap', 'accessory B at 0/3 remains swappable');
assert.equal(resolve({ targetItemHasSetLogs: itemHasPersistedSetLogs(untouchedFour) }), 'Swap', 'accessory C at 0/4 remains swappable');

assert.equal(resolve({ canHotSwap: false }), null, 'unauthorized coached athlete does not gain Swap');
assert.equal(resolve({ canHotSwap: false, hasApprovedSubstitutions: true }), 'Sub', 'approved substitution is visible for an untouched target');
assert.equal(resolve({ canHotSwap: false, hasApprovedSubstitutions: true, targetItemHasSetLogs: true }), 'Sub', 'target evidence preserves approved future-set substitution');
assert.equal(resolve({ sessionLifecycle: 'pre_session' }), 'Swap', 'pre-Session untouched target shows Swap');
assert.equal(resolve({ sessionLifecycle: 'finished_session' }), null, 'post-Session Swap is hidden');
assert.equal(resolve({ sessionLifecycle: 'completed' }), null, 'completed Session Swap is hidden');
assert.equal(resolve({ isCoachPreview: true }), null, 'coach preview remains read-only');
assert.equal(resolve({ targetItemHasSetLogs: false }), 'Swap', 'deleting target evidence restores eligibility while lifecycle allows');

const loggerSource = readFileSync(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url), 'utf8');
assert.match(
  loggerSource,
  /acceptedSetEvidenceItemIds\.has\(Number\(it\.id\)\)/,
  'logger applies accepted persistence evidence to the exact rendered movement item',
);
assert.match(
  loggerSource,
  /handleCanonicalSetFeedback\(json, itemId\)/,
  'successful canonical persistence reports the submitted movement item immediately',
);
assert.match(
  loggerSource,
  /\{swapLabel \? \(/,
  'ineligible swap action is removed from layout instead of rendered disabled',
);
assert.doesNotMatch(
  loggerSource,
  /disabled=\{!swapLabel\}/,
  'logger does not reserve a disabled swap placeholder',
);
assert.doesNotMatch(
  loggerSource,
  /swapAccQuery|setSwapAccQuery|visible=\{false\}[\s\S]*Swap accessory/,
  'obsolete free-text swap modal must not be evaluated behind the governed picker',
);
assert.match(
  loggerSource,
  /<GovernedAccessoryPickerModal[\s\S]*visible=\{swapPickerVisible\}[\s\S]*onSelect=\{\(identity\) =>/,
  'accessory substitution must remain wired through the governed movement picker',
);

console.log('accessory swap per-movement gating regression: PASS');
