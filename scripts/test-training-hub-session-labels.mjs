import assert from 'node:assert/strict';

import {
  trainingHubSessionDayLabel,
  trainingHubSessionStatusLabel,
} from '../lib/training-hub-session-labels.ts';

assert.equal(trainingHubSessionDayLabel('2026-07-27', '2026-07-27'), 'Today');
assert.equal(trainingHubSessionDayLabel('2026-07-28', '2026-07-27'), 'Tomorrow');
assert.equal(trainingHubSessionDayLabel('2026-07-29', '2026-07-27'), 'Wednesday');
assert.equal(trainingHubSessionDayLabel('2026-07-26', '2026-07-27'), 'Sunday');

assert.equal(
  trainingHubSessionStatusLabel({ status: 'assigned', kind: 'today' }),
  'Not Started',
);
assert.equal(
  trainingHubSessionStatusLabel({ status: 'assigned', kind: 'upcoming' }),
  'Not Started',
);
assert.equal(
  trainingHubSessionStatusLabel({ status: 'in_progress', kind: 'in_progress' }),
  'In Progress',
);
assert.equal(
  trainingHubSessionStatusLabel({ status: 'completed', kind: 'completed' }),
  'Completed',
);
assert.equal(
  trainingHubSessionStatusLabel({ status: 'missed', kind: 'missed' }),
  'Missed',
);
assert.equal(
  trainingHubSessionStatusLabel({ status: 'incomplete', kind: 'incomplete' }),
  'Incomplete',
);

console.log('training hub session label tests passed');
