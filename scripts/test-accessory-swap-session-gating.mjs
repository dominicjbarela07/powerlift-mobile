import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  accessorySwapActionForItem,
  itemHasPersistedSetLogs,
} from '../lib/accessory-swap-eligibility.ts';

assert.equal(itemHasPersistedSetLogs({ set_logs: [] }), false);
assert.equal(itemHasPersistedSetLogs({ set_logs: [{ id: 1 }] }), true);
assert.equal(itemHasPersistedSetLogs({ set_logs: [], has_performed_evidence: true }), true);

const base = {
  canHotSwap: true,
  hasApprovedSubstitutions: false,
  isCoachPreview: false,
  sessionStatus: 'in_progress',
};
assert.equal(accessorySwapActionForItem({ ...base, item: { set_logs: [] } }), 'Swap');
assert.equal(
  accessorySwapActionForItem({ ...base, item: { set_logs: [{ id: 10 }] } }),
  null,
);
assert.equal(
  accessorySwapActionForItem({
    ...base,
    canHotSwap: false,
    hasApprovedSubstitutions: true,
    item: { set_logs: [] },
  }),
  'Sub',
);
assert.equal(
  accessorySwapActionForItem({
    ...base,
    canHotSwap: false,
    hasApprovedSubstitutions: true,
    item: { has_performed_evidence: true },
  }),
  null,
);
assert.equal(
  accessorySwapActionForItem({ ...base, sessionStatus: 'completed', item: { set_logs: [] } }),
  null,
);

const source = fs.readFileSync(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url), 'utf8');
assert.match(source, /accessorySwapActionForItem\(\{/);
assert.match(source, /itemHasPersistedSetLogs\(currentItem \|\| swapAccItem\)/);
assert.match(source, /has_performed_evidence\?: boolean/);

console.log('Accessory swap session gating checks passed.');
