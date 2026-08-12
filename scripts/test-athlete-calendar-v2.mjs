import assert from 'node:assert/strict';

import {
  calendarDayMatchesFilter,
  primaryCalendarDayTone,
  resolveCalendarLensState,
} from '../lib/athlete-calendar-lens.ts';

const states = [
  [{}, 'rest', 'slate'],
  [{ sessionStatuses: ['assigned'] }, 'assigned', 'violet'],
  [{ sessionStatuses: ['not_started'] }, 'assigned', 'violet'],
  [{ sessionStatuses: ['in_progress'] }, 'in_progress', 'gold'],
  [{ sessionStatuses: ['completed'] }, 'completed', 'green'],
  [{ sessionStatuses: ['missed'] }, 'needs_attention', 'red'],
  [{ sessionStatuses: ['tardy'] }, 'needs_attention', 'red'],
  [{ personalItemCount: 1 }, 'personal', 'pink'],
  [{ sessionStatuses: ['completed'], personalItemCount: 1 }, 'completed', 'green'],
  [{ sessionStatuses: ['canceled'], personalItemCount: 1 }, 'personal', 'pink'],
  [{ sessionStatuses: ['completed', 'assigned'] }, 'assigned', 'violet'],
  [{ sessionStatuses: ['completed', 'missed'] }, 'needs_attention', 'red'],
  [{ sessionStatuses: ['completed', 'in_progress'] }, 'in_progress', 'gold'],
  [{ sessionStatuses: ['canceled'], checkInCount: 1 }, 'rest', 'slate'],
  [{ meetCount: 1 }, 'rest', 'pink'],
];

for (const [input, expectedState, expectedTone] of states) {
  assert.equal(resolveCalendarLensState(input), expectedState);
  assert.equal(primaryCalendarDayTone(input), expectedTone);
}

assert.equal(calendarDayMatchesFilter({ sessionStatuses: ['assigned'] }, 'sessions'), true);
assert.equal(calendarDayMatchesFilter({ sessionStatuses: ['canceled'] }, 'sessions'), false);
assert.equal(calendarDayMatchesFilter({ personalItemCount: 1 }, 'personal'), true);
assert.equal(calendarDayMatchesFilter({ sessionStatuses: ['completed', 'assigned'] }, 'completed'), true);
assert.equal(calendarDayMatchesFilter({ sessionStatuses: ['missed'] }, 'attention'), true);
assert.equal(calendarDayMatchesFilter({ sessionStatuses: ['assigned'] }, 'attention'), false);
assert.equal(calendarDayMatchesFilter({}, 'all'), true);

console.log('Athlete Calendar V2 state, tone, and filter regressions passed (15 deterministic states).');
