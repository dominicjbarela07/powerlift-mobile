import assert from 'node:assert/strict';

import { resolveTrainingProgramProgress } from '../lib/training-program-progress.ts';

const range = {
  startDate: '2026-07-27',
  endDate: '2026-09-20',
};

assert.equal(resolveTrainingProgramProgress({ ...range, today: '2026-07-26' }), 0);
assert.equal(resolveTrainingProgramProgress({ ...range, today: '2026-07-27' }), 1 / 56);
assert.equal(resolveTrainingProgramProgress({ ...range, today: '2026-08-02' }), 7 / 56);
assert.equal(resolveTrainingProgramProgress({ ...range, today: '2026-08-03' }), 8 / 56);
assert.equal(resolveTrainingProgramProgress({ ...range, today: '2026-09-20' }), 1);
assert.equal(resolveTrainingProgramProgress({ ...range, today: '2026-09-21' }), 1);
assert.equal(
  resolveTrainingProgramProgress({
    startDate: '2026-07-27',
    endDate: '2026-07-27',
    today: '2026-07-27',
  }),
  1,
);
assert.equal(
  resolveTrainingProgramProgress({
    startDate: 'invalid',
    endDate: '2026-09-20',
    today: '2026-07-27',
  }),
  null,
);

console.log('Training program progress checks passed.');
