import assert from 'node:assert/strict';

import {
  accessoryPerSetPrescription,
  accessoryPerSetRepsLabel,
} from '../lib/accessory-logger-prescription.ts';

assert.equal(
  accessoryPerSetPrescription({ sets: 3, reps: 0, reps_text: '8–10', rir_target: 1 }),
  '8–10 @1 RIR',
  'range accessories must use reps_text and must not repeat the aggregate set count',
);
assert.equal(
  accessoryPerSetPrescription({ reps: 10, reps_text: null, rir_target: 2.5 }),
  '10 @2.5 RIR',
);
assert.equal(accessoryPerSetRepsLabel({ reps: 0, reps_text: '8–10' }), '8–10 reps');

console.log('[accessory-logger-prescription] per-set range guards passed');
