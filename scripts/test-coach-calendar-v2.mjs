import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addCalendarDays,
  calendarRange,
  calendarSessionMatchesStatus,
  COACH_CALENDAR_WEEK_DAYS,
  COACH_CALENDAR_WEEK_WINDOW_WEEKS,
  coachCalendarRequestRange,
  coachCalendarWeekIndex,
  coachCalendarWeekWindow,
  coachCalendarWindowNeedsShift,
  fromLocalYMD,
  isCalendarSessionMovable,
  monthGridRows,
  sameAthleteDateMove,
  selectedAthleteLabel,
  startOfCalendarWeek,
  toLocalYMD,
} from '../lib/coach-calendar.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const routeSource = fs.readFileSync(path.resolve(here, '../app/(tabs)/coach-calendar.tsx'), 'utf8');

const monday = fromLocalYMD('2026-08-10');
assert.equal(toLocalYMD(monday), '2026-08-10');
assert.equal(toLocalYMD(startOfCalendarWeek(monday)), '2026-08-09');
assert.equal(toLocalYMD(addCalendarDays(monday, 7)), '2026-08-17');

const week = calendarRange('week', monday);
assert.equal(toLocalYMD(week.start), '2026-08-09');
assert.equal(toLocalYMD(week.end), '2026-08-16');
assert.equal(COACH_CALENDAR_WEEK_DAYS, 7);

const weekWindow = coachCalendarWeekWindow(monday);
assert.equal(COACH_CALENDAR_WEEK_WINDOW_WEEKS, 5);
assert.equal(toLocalYMD(weekWindow.start), '2026-07-26');
assert.equal(toLocalYMD(weekWindow.end), '2026-08-30');
assert.equal(Math.round((weekWindow.end.getTime() - weekWindow.start.getTime()) / 86_400_000), 35);
assert.deepEqual(coachCalendarRequestRange('week', monday), weekWindow);
assert.equal(coachCalendarWeekIndex(monday, weekWindow.start), 2);
assert.equal(coachCalendarWindowNeedsShift(monday, weekWindow.start), false);
assert.equal(coachCalendarWindowNeedsShift(fromLocalYMD('2026-08-03'), weekWindow.start), true);
assert.equal(coachCalendarWindowNeedsShift(fromLocalYMD('2026-08-17'), weekWindow.start), true);
assert.equal(coachCalendarWindowNeedsShift(fromLocalYMD('2026-07-27'), weekWindow.start), true);
assert.equal(coachCalendarWindowNeedsShift(fromLocalYMD('2026-08-24'), weekWindow.start), true);

const month = calendarRange('month', fromLocalYMD('2026-08-11'));
assert.equal(monthGridRows(Array.from({ length: 42 }, (_, index) => index)).length, 6);
assert.equal(Math.round((month.end.getTime() - month.start.getTime()) / 86_400_000), 42);

const springDst = addCalendarDays(fromLocalYMD('2026-03-08'), 1);
assert.equal(toLocalYMD(springDst), '2026-03-09');
const fallDst = addCalendarDays(fromLocalYMD('2026-11-01'), 1);
assert.equal(toLocalYMD(fallDst), '2026-11-02');

const assigned = { athlete_id: 7, date: '2026-08-11', status: 'assigned' };
assert.equal(isCalendarSessionMovable(assigned), true);
assert.equal(sameAthleteDateMove(assigned, '2026-08-12', 7), true);
assert.equal(sameAthleteDateMove(assigned, '2026-08-12', 8), false);
assert.equal(sameAthleteDateMove(assigned, '2026-08-11', 7), false);
assert.equal(isCalendarSessionMovable({ ...assigned, status: 'completed' }), false);
assert.equal(sameAthleteDateMove({ ...assigned, status: 'completed' }, '2026-08-12', 7), false);
assert.equal(isCalendarSessionMovable({ ...assigned, status: 'in_progress' }), true);

assert.equal(calendarSessionMatchesStatus({ status: 'draft' }, 'needs'), true);
assert.equal(calendarSessionMatchesStatus({ status: 'assigned', needs_session_review: true }, 'needs'), true);
assert.equal(calendarSessionMatchesStatus({ status: 'assigned' }, 'in_progress'), false);

const athletes = [{ id: 1, name: 'Amanda' }, { id: 2, name: 'Dominic' }];
assert.equal(selectedAthleteLabel(athletes, []), 'All Athletes');
assert.equal(selectedAthleteLabel(athletes, [1]), 'Amanda');
assert.equal(selectedAthleteLabel(athletes, [1, 2]), 'All Athletes');

assert.match(routeSource, /useState<CoachCalendarView>\('week'\)/);
assert.match(routeSource, /function WeekBoard/);
assert.match(routeSource, /React\.memo\(function WeekAthleteRow/);
assert.match(routeSource, /<FlatList/);
assert.match(routeSource, /coachCalendarRequestRange/);
assert.match(routeSource, /coachCalendarWindowNeedsShift/);
assert.match(routeSource, /preservedCenterDate/);
assert.match(routeSource, /onVisibleWeekSettled/);
assert.match(routeSource, /onMomentumScrollEnd/);
assert.match(routeSource, /SLTabRowControlShell/);
assert.match(routeSource, /SLTabRowControlItem/);
assert.match(routeSource, /useSafeAreaInsets/);
assert.match(routeSource, /insets\.bottom \+ SLSpacing\.xs \+ SL_TAB_ROW_CONTROL\.shellHeight \+ SLSpacing\.md/);
assert.doesNotMatch(routeSource, /style=\{styles\.fab\}/);
assert.match(routeSource, /\.slice\(0, 2\)/);
assert.doesNotMatch(routeSource, /customItems\.slice\(0, 1\)/);
assert.doesNotMatch(routeSource, /meets\.slice\(0, 1\)/);
assert.match(routeSource, /function MonthBoard/);
assert.match(routeSource, /function AgendaBoard/);
assert.match(routeSource, /function DayDetailModal/);
assert.match(routeSource, /activateAfterLongPress\(320\)/);
assert.match(routeSource, /sameAthleteDateMove\(session, date, session\.athlete_id\)/);
assert.match(routeSource, /dayCellDragValid/);
assert.match(routeSource, /AccessibilityInfo\.isReduceMotionEnabled/);
assert.match(routeSource, /\/coach\/mobile\/workouts\/\$\{session\.workout_id\}\/move/);
assert.match(routeSource, /\/coach\/mobile\/calendar\/items/);
assert.match(routeSource, /pathname: '\/workout\/session-workspace\/\[workoutId\]'/);
assert.match(routeSource, /scheduled_time/);
assert.match(routeSource, /orderedDayItems/);
assert.match(routeSource, /coach-calendar:athlete-filter:v1/);
assert.match(routeSource, /\(day\.sessions \|\| \[\]\)\.filter/);
assert.match(routeSource, /\(day\.meets \|\| \[\]\)\.filter/);
assert.match(routeSource, /\(day\.custom_items \|\| \[\]\)\.filter/);
for (const category of ['Reminder', 'Weigh-in', 'Travel', 'Team Check-in', 'Programming Day', 'Personal Note', 'Do Not Schedule']) {
  assert.ok(routeSource.includes(`'${category}'`), `Missing canonical calendar category: ${category}`);
}
assert.doesNotMatch(routeSource, /const ITEM_CATEGORIES = \[[^\]]*'Meet'/s);

console.log('Coach Calendar V2 helper and route regression checks passed.');
