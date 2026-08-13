import assert from 'node:assert/strict';

import {
  LEDGER_DAILY_SIGNAL_PRIORITY,
  progressToNextMaturity,
  resolveLedgerIndexMaturity,
  selectLedgerDailySignal,
} from '../components/ledger/index-maturity.ts';

const expectedStates = [
  [0, 'seedling'],
  [1, 'seedling'],
  [5, 'seedling'],
  [9, 'seedling'],
  [10, 'building'],
  [25, 'building'],
  [11, 'building'],
  [99, 'building'],
  [100, 'established'],
  [250, 'established'],
  [101, 'established'],
  [499, 'established'],
  [500, 'veteran'],
  [1000, 'veteran'],
  [501, 'veteran'],
  [1500, 'veteran'],
];

for (const [completedWorkouts, expected] of expectedStates) {
  const result = resolveLedgerIndexMaturity({ completedWorkouts });
  assert.equal(result.name, expected, `${completedWorkouts} Training Sessions should resolve to ${expected}`);
  assert.match(result.reason, new RegExp(`^${completedWorkouts} canonical completed Training Session`));
}

const invalid = resolveLedgerIndexMaturity({ completedWorkouts: Number.NaN });
assert.equal(invalid.name, 'seedling');
assert.equal(invalid.nextBoundary, 10);

assert.deepEqual(
  [0, 10, 100, 500].map((completedWorkouts) => {
    const state = resolveLedgerIndexMaturity({ completedWorkouts });
    return [state.name, state.density, state.fallback, state.nextBoundary];
  }),
  [
    ['seedling', 'open', 'first-workout', 10],
    ['building', 'focused', 'next-honest-step', 100],
    ['established', 'layered', 'sparse-evidence', 500],
    ['veteran', 'deep', 'career-summary', null],
  ],
);

const building = resolveLedgerIndexMaturity({ completedWorkouts: 55 });
assert.equal(progressToNextMaturity(55, building), 0.5);
assert.equal(progressToNextMaturity(-20, building), 0);
assert.equal(progressToNextMaturity(1000, building), 1);
assert.equal(progressToNextMaturity(500, resolveLedgerIndexMaturity({ completedWorkouts: 500 })), 1);

assert.deepEqual(LEDGER_DAILY_SIGNAL_PRIORITY, [
  'anniversary',
  'major-pr',
  'achievement',
  'meet',
  'reviewed-video',
  'strength-change',
  'rediscovery',
  'next-milestone',
  'early-action',
]);
assert.equal(selectLedgerDailySignal({ meet: true, anniversary: true, 'major-pr': true }), 'anniversary');
assert.equal(selectLedgerDailySignal({ meet: true, achievement: true }), 'achievement');
assert.equal(selectLedgerDailySignal({ 'reviewed-video': true, 'strength-change': true }), 'reviewed-video');
assert.equal(selectLedgerDailySignal({}), 'early-action');

console.log('[ledger-index] maturity boundaries, evidence-aware resolver, daily priority, and progress passed');
