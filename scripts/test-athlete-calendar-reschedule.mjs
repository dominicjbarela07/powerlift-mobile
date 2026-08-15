import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  athleteCalendarDateAtPoint,
  canSelfCoachRescheduleSessions,
  isAthleteCalendarDropTargetValid,
  isAthleteCalendarSessionMovable,
  withAthleteCalendarSessionDate,
} from '../lib/athlete-calendar-reschedule.ts';

const [route, storyboard, scheduleSheet] = await Promise.all([
  readFile(new URL('../app/(tabs)/athlete-calendar.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/calendar/AthleteCalendarStoryboardV2.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/calendar/TrainingScheduleSheet.tsx', import.meta.url), 'utf8'),
]);

assert.equal(canSelfCoachRescheduleSessions({ canEditProgramming: true, isSelfCoached: true }), true);
assert.equal(canSelfCoachRescheduleSessions({ canEditProgramming: true, isSelfCoached: false }), false);
assert.equal(canSelfCoachRescheduleSessions({ canEditProgramming: false, isSelfCoached: true }), false);

for (const status of ['assigned', 'draft', 'in_progress', 'missed']) {
  assert.equal(isAthleteCalendarSessionMovable({ status }), true, `${status} follows the canonical movable lifecycle`);
}
for (const status of ['completed', 'logged', 'done']) {
  assert.equal(isAthleteCalendarSessionMovable({ status }), false, `${status} remains immutable`);
}

const session = { date: '2026-08-16', status: 'assigned' };
assert.equal(isAthleteCalendarDropTargetValid({ session, destinationDate: '2026-08-15', today: '2026-08-16' }), false, 'past date rejected');
assert.equal(isAthleteCalendarDropTargetValid({ session, destinationDate: '2026-08-16', today: '2026-08-16' }), false, 'same-date drop is a no-op');
assert.equal(isAthleteCalendarDropTargetValid({ session, destinationDate: '2026-08-18', today: '2026-08-16' }), true, 'future date accepted');
assert.equal(isAthleteCalendarDropTargetValid({ session, destinationDate: '2026-09-01', today: '2026-08-16' }), true, 'cross-month date accepted');
assert.equal(isAthleteCalendarDropTargetValid({ session: { ...session, status: 'completed' }, destinationDate: '2026-08-18', today: '2026-08-16' }), false, 'completed Session rejected');

const measuredCells = [
  { date: '2026-08-18', x: 10, y: 20, width: 40, height: 50 },
  { date: '2026-08-19', x: 50, y: 20, width: 40, height: 50 },
];
assert.equal(athleteCalendarDateAtPoint(25, 45, measuredCells), '2026-08-18');
assert.equal(athleteCalendarDateAtPoint(75, 45, measuredCells), '2026-08-19');
assert.equal(athleteCalendarDateAtPoint(5, 5, measuredCells), null);

const payload = {
  days: [
    { date: '2026-08-16', sessions: [{ workout_id: 7, date: '2026-08-16', title: 'W3 Back' }] },
    { date: '2026-08-18', sessions: [{ workout_id: 8, date: '2026-08-18', title: 'W3 Push' }] },
  ],
};
const moved = withAthleteCalendarSessionDate(payload, payload.days[0].sessions[0], '2026-08-18');
assert.deepEqual(moved?.days[0].sessions, [], 'source projection removes the Session');
assert.deepEqual(moved?.days[1].sessions?.map((item) => item.workout_id), [8, 7], 'destination preserves existing Sessions and adds exactly one');
const rolledBack = withAthleteCalendarSessionDate(moved, payload.days[0].sessions[0], '2026-08-16');
assert.deepEqual(rolledBack?.days[0].sessions?.map((item) => item.workout_id), [7], 'rollback restores the source exactly once');
assert.deepEqual(rolledBack?.days[1].sessions?.map((item) => item.workout_id), [8], 'rollback removes the optimistic destination copy');

assert.match(storyboard, /activateAfterLongPress\(320\)/, 'Session pill uses deliberate long press before pickup');
assert.match(storyboard, /measureInWindow/, 'drop targets use measured date-cell geometry');
assert.match(storyboard, /scrollEnabled=\{!dragState\}/, 'month scrolling pauses while a Session is carried');
assert.match(storyboard, /dayCellDragInvalid[\s\S]*dayCellDragValid[\s\S]*dayCellDragTarget/, 'invalid, valid, and active target states are distinct');
assert.match(storyboard, /onPress=\{onPress\}/, 'ordinary date tap remains available');
assert.match(route, /canSelfCoachRescheduleSessions\(\{[\s\S]*canEditProgramming:[\s\S]*isSelfCoached:/, 'UI gate requires backend permission and self-coached identity');
assert.match(route, /\/coach\/mobile\/workouts\/\$\{session\.id\}\/move/, 'Athlete Calendar reuses the canonical scheduling mutation');
assert.match(route, /withAthleteCalendarSessionDate\(current, projectedSession, date\)/, 'move is projected optimistically');
assert.match(route, /withAthleteCalendarSessionDate\(current, projectedSession, originalDate\)/, 'failed move rolls back');
assert.match(route, /dayDetailCacheRef\.current\.delete\(originalDate\)[\s\S]*dayDetailCacheRef\.current\.delete\(date\)[\s\S]*await load\(true, true\)/, 'successful move invalidates local Calendar projections');
assert.match(storyboard, /Manage Session schedule/, 'Day Lens keeps a non-drag scheduling path');
assert.match(scheduleSheet, /minimumDate[\s\S]*Move Session/, 'accessible date picker enforces today as the minimum destination');
assert.match(route, /onMoveDate=\{\(date\).*moveSession\(scheduleEditor, date\)/, 'date-picker fallback reuses the same canonical move handler');

console.log('Self-coached Athlete Calendar rescheduling contracts passed.');
