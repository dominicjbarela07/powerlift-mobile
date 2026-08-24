import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  accessorySwapActionForItem,
  itemHasPersistedSetLogs,
  persistedSetLogItemIds,
  resolveSubstitutionAuthority,
} from '../lib/accessory-swap-eligibility.ts';

const resolve = (overrides = {}) => accessorySwapActionForItem({
  substitutionAuthority: 'self_governed',
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

assert.equal(resolve({ substitutionAuthority: 'coach_restricted' }), null, 'externally coached athlete without approved choices does not gain Swap');
assert.equal(resolve({ substitutionAuthority: 'coach_restricted', hasApprovedSubstitutions: true }), 'Sub', 'approved substitution is visible for an untouched target');
assert.equal(resolve({ substitutionAuthority: 'coach_restricted', hasApprovedSubstitutions: true, targetItemHasSetLogs: true }), 'Sub', 'target evidence preserves approved future-set substitution');
assert.equal(resolve({ substitutionAuthority: 'none', hasApprovedSubstitutions: true }), null, 'read-only viewer receives no substitution action');
assert.equal(resolve({ sessionLifecycle: 'pre_session' }), 'Swap', 'pre-Session untouched target shows Swap');
assert.equal(resolve({ sessionLifecycle: 'finished_session' }), null, 'post-Session Swap is hidden');
assert.equal(resolve({ sessionLifecycle: 'completed' }), null, 'completed Session Swap is hidden');
assert.equal(resolve({ isCoachPreview: true }), null, 'coach preview remains read-only');
assert.equal(resolve({ targetItemHasSetLogs: false }), 'Swap', 'deleting target evidence restores eligibility while lifecycle allows');

for (const mobileMode of ['athlete', 'individual']) {
  assert.equal(resolveSubstitutionAuthority({ serverAuthority: null, canHotSwap: false, permissionIsSelfCoached: false, accountIsSelfCoached: true, isCoachPreview: false }), 'self_governed', `self-coached relationship remains free-swap in ${mobileMode} mode`);
}
assert.equal(resolveSubstitutionAuthority({ serverAuthority: 'coach_restricted', canHotSwap: false, permissionIsSelfCoached: false, accountIsSelfCoached: false, isCoachPreview: false }), 'coach_restricted', 'explicit external-coach authority remains restricted');
assert.equal(resolveSubstitutionAuthority({ serverAuthority: 'self_governed', canHotSwap: true, permissionIsSelfCoached: true, accountIsSelfCoached: true, isCoachPreview: true }), 'none', 'coach preview cannot inherit the self athlete free-swap authority');

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
assert.match(loggerSource, /approvedOnly=\{substitutionAuthority !== 'self_governed'\}/, 'picker restriction must follow server relationship authority rather than UI mode');
assert.doesNotMatch(loggerSource, /title=\{data\?\.permissions\?\.can_browse_hot_swap_catalog/, 'ambiguous catalog-boolean copy gate must not choose the approved-substitution experience');

const authSource = readFileSync(new URL('../context/AuthContext.tsx', import.meta.url), 'utf8');
assert.match(authSource, /payloadAthlete\.is_self_coached === true/, 'mobile auth must retain server relationship truth when presentation mode changes');

console.log('accessory swap per-movement gating regression: PASS');
