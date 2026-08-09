import assert from 'node:assert/strict';
import { buildSwapMovementGroups } from '../lib/swap-movement-options.ts';

const groups = buildSwapMovementGroups({
  current: 'Cable Row',
  prescribed: 'Barbell Row',
  approved: ['Cable Row', 'Chest Supported Row', 'Lat Pulldown'],
});
assert.deepEqual(groups.map((group) => group.title), [
  'Current movement',
  'Prescribed movement',
  'Approved alternatives',
]);
assert.equal(groups.flatMap((group) => group.options).length, 4);

const filtered = buildSwapMovementGroups({
  current: 'Cable Row',
  prescribed: 'Barbell Row',
  approved: ['Chest Supported Row'],
  query: 'chest',
});
assert.deepEqual(filtered.map((group) => group.title), ['Approved alternatives']);
assert.equal(filtered[0].options[0].movement, 'Chest Supported Row');

console.log('swap movement option grouping tests passed');
