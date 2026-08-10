import assert from 'node:assert/strict';

import {
  buildAthleteHomeWeek,
  mergeAthleteHomeWeekPreview,
  scheduleDateKey,
} from '../lib/athlete-home-week.ts';

const todayDate = '2026-08-06';
const completedWeek = [
  { id: 1, date: '2026-08-03', status: 'completed' },
  { id: 2, date: '2026-08-04', status: 'logged' },
  { id: 3, date: '2026-08-05', status: 'done' },
  { id: 4, date: '2026-08-06', status: 'completed' },
  { id: 5, date: '2026-08-07', status: 'completed' },
];

const merged = mergeAthleteHomeWeekPreview(
  { date: todayDate },
  { week_preview: completedWeek },
);
assert.equal(merged.week_preview?.length, 5, 'top-level API week_preview is retained by Athlete Home');

const fiveCompleted = buildAthleteHomeWeek({ todayDate, sessions: merged.week_preview });
assert.deepEqual(
  fiveCompleted.slice(0, 5).map((day) => day.state),
  ['complete', 'complete', 'complete', 'complete', 'complete'],
  'five completed sessions populate the five corresponding day cells',
);

const mixedWeek = buildAthleteHomeWeek({
  todayDate,
  sessions: completedWeek.map((session, index) => (
    index < 3 ? session : { ...session, status: 'scheduled' }
  )),
});
assert.deepEqual(
  mixedWeek.slice(0, 5).map((day) => day.state),
  ['complete', 'complete', 'complete', 'session', 'session'],
  'completed and upcoming sessions preserve their individual day states',
);

assert.equal(fiveCompleted.find((day) => day.date === todayDate)?.state, 'complete', 'Today can show completed');
assert.equal(mixedWeek.find((day) => day.date === todayDate)?.state, 'session', 'Today can show incomplete');
assert.equal(mixedWeek.find((day) => day.date === '2026-08-08')?.state, 'empty', 'days without sessions remain empty');

assert.equal(scheduleDateKey('2026-08-03T00:05:00Z'), '2026-08-03', 'date-only scheduling identity does not shift at UTC midnight');
assert.equal(fiveCompleted[0].day, 'MON', 'the athlete-local week begins on Monday');

const beforeMove = buildAthleteHomeWeek({
  todayDate,
  sessions: [{ id: 9, date: '2026-08-04', status: 'scheduled' }],
});
const afterMove = buildAthleteHomeWeek({
  todayDate,
  sessions: [{ id: 9, date: '2026-08-08', status: 'scheduled' }],
});
assert.equal(beforeMove.find((day) => day.date === '2026-08-04')?.state, 'session');
assert.equal(afterMove.find((day) => day.date === '2026-08-04')?.state, 'empty');
assert.equal(afterMove.find((day) => day.date === '2026-08-08')?.state, 'session', 'a moved session repopulates its new day');

const multipleSessions = buildAthleteHomeWeek({
  todayDate,
  sessions: [
    { id: 10, date: todayDate, status: 'completed' },
    { id: 11, date: todayDate, status: 'scheduled' },
  ],
});
const multipleToday = multipleSessions.find((day) => day.date === todayDate);
assert.equal(multipleToday?.sessionCount, 2, 'multiple sessions on one day are not dropped');
assert.equal(multipleToday?.completedCount, 1);
assert.equal(multipleToday?.state, 'session', 'an actionable session takes precedence over a completed sibling');

const legacyFallback = buildAthleteHomeWeek({
  todayDate,
  fallbackSessions: [{ workout_id: 22, date: '2026-08-05', kind: 'session' }],
});
assert.equal(legacyFallback.find((day) => day.date === '2026-08-05')?.state, 'session', 'legacy cached payloads retain glance fallback');

const authoritativeEmpty = buildAthleteHomeWeek({
  todayDate,
  sessions: [],
  fallbackSessions: [{ workout_id: 22, date: '2026-08-05', kind: 'session' }],
});
assert.equal(authoritativeEmpty.find((day) => day.date === '2026-08-05')?.state, 'empty', 'an empty API week_preview remains authoritative');

const draftExcluded = buildAthleteHomeWeek({
  todayDate,
  sessions: [{ id: 30, date: '2026-08-05', status: 'draft' }],
});
assert.equal(draftExcluded.find((day) => day.date === '2026-08-05')?.state, 'empty', 'unassigned drafts do not disagree with the assigned-session summary');

console.log('Athlete Home current-week population tests passed.');
