import assert from 'node:assert/strict';

import { formatSessionContentSnapshot } from '../lib/session-content-snapshot.ts';

assert.equal(
  formatSessionContentSnapshot({
    movements: ['Squat', 'Bench', 'Deadlift'],
    accessoryCount: 2,
  }),
  'SBD · 2 Accessories',
);

assert.equal(
  formatSessionContentSnapshot({
    movements: ['Squat', 'Bench'],
    accessoryCount: 0,
  }),
  'Squat · Bench',
);

assert.equal(
  formatSessionContentSnapshot({
    movements: ['Pause Squat', 'Close-Grip Bench', 'Deadlift', 'Overhead Press'],
    accessoryCount: 1,
  }),
  'SBD · Overhead Press · 1 Accessory',
);

assert.equal(
  formatSessionContentSnapshot({
    movements: ['Bench', 'Bench'],
    accessoryCount: 3,
  }),
  'Bench · 3 Accessories',
);

assert.equal(
  formatSessionContentSnapshot({
    movements: [],
    accessoryCount: 2,
  }),
  '2 Accessories',
);

console.log('session content snapshot tests passed');
