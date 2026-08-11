import assert from 'node:assert/strict';

import {
  accessorySwapActionForSession,
  sessionHasPersistedSetLogs,
} from '../lib/accessory-swap-eligibility.ts';

const emptySession = {
  core_items: [{ set_logs: [] }],
  accessory_groups: [{ items: [{ set_logs: [] }, { set_logs: [] }] }],
};
const coreLoggedSession = {
  ...emptySession,
  core_items: [{ set_logs: [{ id: 1 }] }],
};
const accessoryLoggedSession = {
  ...emptySession,
  accessory_groups: [{ items: [{ set_logs: [{ id: 2 }] }, { set_logs: [] }] }],
};

const resolve = (overrides = {}) => accessorySwapActionForSession({
  canHotSwap: true,
  hasApprovedSubstitutions: false,
  isCoachPreview: false,
  sessionLifecycle: 'active_session',
  sessionHasSetLogs: false,
  acceptedPersistedSetLog: false,
  ...overrides,
});

assert.equal(sessionHasPersistedSetLogs(emptySession), false, 'zero-log Session remains swappable');
assert.equal(resolve(), 'Swap', 'self-coached active Session with zero logs shows Swap');
assert.equal(resolve({ sessionLifecycle: 'pre_session' }), 'Swap', 'pre-Session zero-log state shows Swap');
assert.equal(resolve({ acceptedPersistedSetLog: true }), null, 'accepted first SetLog hides Swap immediately');
assert.equal(resolve({ acceptedPersistedSetLog: false }), 'Swap', 'failed first SetLog does not hide Swap');
assert.equal(sessionHasPersistedSetLogs(coreLoggedSession), true, 'Core SetLog is Session-level evidence');
assert.equal(resolve({ sessionHasSetLogs: sessionHasPersistedSetLogs(coreLoggedSession) }), null, 'Core SetLog hides accessory Swap');
assert.equal(sessionHasPersistedSetLogs(accessoryLoggedSession), true, 'accessory SetLog is Session-level evidence');
assert.equal(resolve({ sessionHasSetLogs: sessionHasPersistedSetLogs(accessoryLoggedSession) }), null, 'Movement A SetLog hides Movement B Swap');
assert.equal(resolve({ canHotSwap: false }), null, 'unauthorized coached athlete does not gain Swap');
assert.equal(resolve({ canHotSwap: false, hasApprovedSubstitutions: true }), 'Sub', 'existing approved substitution remains available before logging');
assert.equal(resolve({ canHotSwap: false, hasApprovedSubstitutions: true, sessionHasSetLogs: true }), null, 'Session SetLog also hides approved substitution');
assert.equal(resolve({ sessionLifecycle: 'finished_session' }), null, 'post-Session Swap is hidden');
assert.equal(resolve({ sessionLifecycle: 'completed' }), null, 'completed Session Swap is hidden');
assert.equal(resolve({ isCoachPreview: true }), null, 'coach preview remains read-only');
assert.equal(sessionHasPersistedSetLogs({ accessory_groups: [{ items: [{ set_logs: [] }, { set_logs: [{ id: 3 }] }] }] }), true, 'superset/accessory grouping obeys Session gate');
assert.equal(resolve({ sessionHasSetLogs: false }), 'Swap', 'authoritative return to zero logs restores eligibility while lifecycle allows');

console.log('accessory swap Session-level gating regression: PASS');
