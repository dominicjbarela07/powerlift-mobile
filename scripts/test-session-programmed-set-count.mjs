import assert from 'node:assert/strict';

import {
  programmedSetCountForDraft,
  programmedSetCountForItem,
  programmedSetCountForSession,
} from '../lib/session-programmed-set-count.ts';

assert.equal(programmedSetCountForItem({ variant: 'STRAIGHT', sets: 5 }), 5);
assert.equal(programmedSetCountForItem({ variant: 'FULL_CUSTOM', sets: 9, planned_sets: [{}, {}, {}] }), 3);

assert.equal(programmedSetCountForDraft({ sourceVariant: 'STRAIGHT', scheme: 'STRAIGHT', sets: '5' }, 'core'), 5);
assert.equal(programmedSetCountForDraft({ sourceVariant: 'TOP', scheme: 'TOP_BACKDOWN', sets: '1', backdownSets: '3' }, 'core'), 4);
assert.equal(programmedSetCountForDraft({ sourceVariant: 'FULL_CUSTOM', scheme: 'FULL_CUSTOM', sets: '9', plannedSets: [{}, {}, {}, {}] }, 'core'), 4);
assert.equal(programmedSetCountForDraft({ scheme: 'STRAIGHT', sets: '4' }, 'accessory'), 4);

assert.equal(programmedSetCountForSession({
  coreItems: [
    { variant: 'TOP', sets: 1 },
    { variant: 'BK', sets: 3 },
    { variant: 'FULL_CUSTOM', sets: 8, planned_sets: [{}, {}] },
  ],
  accessoryGroups: [{ items: [{ sets: 4 }, { sets: 2 }] }],
}), 12);

const straightSession = { coreItems: [{ variant: 'STRAIGHT', sets: 5 }], accessoryGroups: [{ items: [{ sets: 3 }] }] };
assert.equal(programmedSetCountForSession(straightSession), 8);
assert.equal(programmedSetCountForSession({ ...straightSession, accessoryGroups: [{ items: [{ sets: 3 }, { sets: 3 }] }] }), 11, 'duplicating a movement updates the authoritative total');
assert.equal(programmedSetCountForSession({ ...straightSession, accessoryGroups: [] }), 5, 'deleting a movement updates the authoritative total');

console.log('[session-programmed-set-count] straight, top/backdown, Full Custom, and Session totals passed');
