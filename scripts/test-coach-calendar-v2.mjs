import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addCalendarDays,
  calendarRange,
  coachCalendarDateAtPoint,
  calendarSessionMatchesStatus,
  coachCalendarRequestRange,
  fromLocalYMD,
  isCoachCalendarDropTargetValid,
  isCalendarSessionMovable,
  monthGridRows,
  sameAthleteDateMove,
  selectedAthleteLabel,
  startOfCalendarWeek,
  toLocalYMD,
  withCoachCalendarSessionDate,
} from '../lib/coach-calendar.ts';
import { resolveCompactDropdownLayout } from '../lib/compact-dropdown.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const routeSource = fs.readFileSync(path.resolve(here, '../app/(tabs)/coach-calendar.tsx'), 'utf8');
const dropdownSource = fs.readFileSync(path.resolve(here, '../components/ui/sl-compact-dropdown.tsx'), 'utf8');

const monday = fromLocalYMD('2026-08-10');
assert.equal(toLocalYMD(monday), '2026-08-10');
assert.equal(toLocalYMD(startOfCalendarWeek(monday)), '2026-08-09');
assert.equal(toLocalYMD(addCalendarDays(monday, 7)), '2026-08-17');

const month = calendarRange('month', fromLocalYMD('2026-08-11'));
assert.equal(monthGridRows(Array.from({ length: 42 }, (_, index) => index)).length, 6);
assert.equal(Math.round((month.end.getTime() - month.start.getTime()) / 86_400_000), 42);
assert.deepEqual(coachCalendarRequestRange('month', fromLocalYMD('2026-08-11')), month);
const agenda = calendarRange('agenda', fromLocalYMD('2026-08-19'));
assert.equal(toLocalYMD(agenda.start), '2026-08-19');
assert.equal(toLocalYMD(agenda.end), '2026-09-30');

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
assert.equal(isCoachCalendarDropTargetValid({ session: assigned, destinationDate: '2026-08-12', today: '2026-08-10', targetAthleteId: 7 }), true);
assert.equal(isCoachCalendarDropTargetValid({ session: assigned, destinationDate: '2026-08-09', today: '2026-08-10', targetAthleteId: 7 }), false);
assert.equal(isCoachCalendarDropTargetValid({ session: assigned, destinationDate: '2026-08-11', today: '2026-08-10', targetAthleteId: 7 }), false);
assert.equal(isCoachCalendarDropTargetValid({ session: assigned, destinationDate: '2026-08-12', today: '2026-08-10', targetAthleteId: 8 }), false);
assert.equal(isCoachCalendarDropTargetValid({ session: { ...assigned, status: 'completed' }, destinationDate: '2026-08-12', today: '2026-08-10', targetAthleteId: 7 }), false);
assert.equal(isCoachCalendarDropTargetValid({ session: { ...assigned, status: 'in_progress' }, destinationDate: '2026-08-12', today: '2026-08-10', targetAthleteId: 7 }), true);

const measuredMonthCells = new Map([
  ['2026-08-30', { x: 10, y: 100, width: 40, height: 48 }],
  ['2026-08-31', { x: 50, y: 100, width: 40, height: 48 }],
  ['2026-09-01', { x: 90, y: 100, width: 40, height: 48 }],
]);
assert.equal(coachCalendarDateAtPoint(109, 124, measuredMonthCells), '2026-09-01');
assert.equal(coachCalendarDateAtPoint(9, 124, measuredMonthCells), null);
assert.equal(coachCalendarDateAtPoint(131, 124, measuredMonthCells), null);

const sessionToMove = { ...assigned, workout_id: 7 };
const originalDays = [
  { date: '2026-08-11', counts: { assigned: 2, total: 2 }, sessions: [sessionToMove, { ...assigned, workout_id: 8 }] },
  { date: '2026-08-12', counts: { assigned: 0, total: 0 }, sessions: [] },
];
const optimisticDays = withCoachCalendarSessionDate(originalDays, sessionToMove, '2026-08-12');
assert.deepEqual(optimisticDays.map((day) => day.sessions.length), [1, 1]);
assert.equal(optimisticDays.flatMap((day) => day.sessions).filter((session) => session.workout_id === 7).length, 1);
assert.equal(optimisticDays[1].sessions[0].date, '2026-08-12');
const rolledBackDays = withCoachCalendarSessionDate(optimisticDays, sessionToMove, '2026-08-11');
assert.deepEqual(rolledBackDays.map((day) => day.sessions.length), [2, 0]);
assert.equal(rolledBackDays.flatMap((day) => day.sessions).filter((session) => session.workout_id === 7).length, 1);

assert.equal(calendarSessionMatchesStatus({ status: 'draft' }, 'needs'), true);
assert.equal(calendarSessionMatchesStatus({ status: 'assigned', needs_session_review: true }, 'needs'), true);
assert.equal(calendarSessionMatchesStatus({ status: 'assigned' }, 'in_progress'), false);

const athletes = [{ id: 1, name: 'Amanda' }, { id: 2, name: 'Dominic' }];
assert.equal(selectedAthleteLabel(athletes, []), 'All Athletes');
assert.equal(selectedAthleteLabel(athletes, [1]), 'Amanda');
assert.equal(selectedAthleteLabel(athletes, [1, 2]), 'All Athletes');

const belowLayout = resolveCompactDropdownLayout({
  anchor: { x: 12, y: 84, width: 132, height: 36 },
  estimatedHeight: 296,
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
  minWidth: 240,
  preferredMaxHeight: 304,
  viewportHeight: 852,
  viewportWidth: 393,
});
assert.equal(belowLayout.placement, 'below');
assert.equal(belowLayout.left, 12);
assert.equal(belowLayout.width, 240);
assert.ok(belowLayout.top > 120);

const aboveLayout = resolveCompactDropdownLayout({
  anchor: { x: 330, y: 760, width: 56, height: 36 },
  estimatedHeight: 296,
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
  minWidth: 196,
  preferredMaxHeight: 304,
  viewportHeight: 852,
  viewportWidth: 393,
});
assert.equal(aboveLayout.placement, 'above');
assert.ok(aboveLayout.left + aboveLayout.width <= 385, 'menu must remain inside the right viewport gutter');
assert.ok(aboveLayout.top >= 55, 'menu must remain below the safe-area ceiling');

assert.match(routeSource, /useState<CoachCalendarView>\('month'\)/);
assert.match(routeSource, /\(\['month', 'agenda'\] as CoachCalendarView\[\]\)/);
assert.doesNotMatch(routeSource, /\(\['week', 'month', 'agenda'\] as CoachCalendarView\[\]\)/);
assert.match(routeSource, /function WeekBoard/);
assert.doesNotMatch(routeSource, /function AthleteFilterRail/);
assert.doesNotMatch(routeSource, /athleteFilterRail|athleteRailChip/);
assert.doesNotMatch(routeSource, /Athletes × schedule/i);
assert.match(routeSource, /selectedAthleteLabel\(athletes, selectedAthleteIds\)/);
assert.match(routeSource, /testID="coach-calendar-athlete-selector"/);
assert.match(routeSource, /testID="coach-calendar-status-selector"/);
assert.match(routeSource, /menuTestID="coach-calendar-athlete-menu"/);
assert.match(routeSource, /menuTestID="coach-calendar-status-menu"/);
assert.match(routeSource, /onValueChange=\{\(value\) => setSelectedAthleteIds\(value === 'all' \? \[\] : \[Number\(value\)\]\)\}/);
assert.match(routeSource, /onValueChange=\{setStatusFilter\}/);
assert.match(routeSource, /statusFilter === 'all'[\s\S]*?'All Statuses'/);
assert.match(routeSource, /\.slice\(0, 1\)/, 'persisted athlete lens remains explicitly single-select');
assert.doesNotMatch(routeSource, /FilterModal|Calendar Filters|Search athletes|filterOpen|filterSearch/);
assert.match(routeSource, /testID=\{`coach-calendar-view-\$\{mode\}`\}/);
assert.match(routeSource, /style=\{styles\.compactHeader\}/);
assert.match(routeSource, /style=\{styles\.headerControlRow\}/);
assert.match(routeSource, /style=\{styles\.compactSegmentedControl\}/);
assert.doesNotMatch(routeSource, /styles\.modeRow|styles\.segmentedControl/);
assert.doesNotMatch(routeSource, /styles\.matrixHeader/);
assert.doesNotMatch(routeSource, /styles\.matrixRow/);
assert.match(routeSource, /coachCalendarRequestRange/);
assert.match(routeSource, /SLTabRowControlShell/);
assert.match(routeSource, /SLTabRowControlItem/);
assert.match(routeSource, /useSafeAreaInsets/);
assert.match(routeSource, /insets\.bottom \+ SLSpacing\.xs \+ SL_TAB_ROW_CONTROL\.shellHeight \+ SLSpacing\.md/);
assert.doesNotMatch(routeSource, /style=\{styles\.fab\}/);
assert.match(routeSource, /\.slice\(0, 2\)/);
assert.doesNotMatch(routeSource, /customItems\.slice\(0, 1\)/);
assert.doesNotMatch(routeSource, /meets\.slice\(0, 1\)/);
assert.match(routeSource, /function MonthBoard/);
assert.match(routeSource, /function MonthDraggableSessionRow/);
assert.match(routeSource, /function AgendaBoard/);
assert.match(routeSource, /function CalendarSessionCard/);
assert.match(routeSource, /function agendaGroups/);
assert.match(routeSource, /<ProgrammingMuscleRegionArt/);
assert.match(routeSource, /session\.muscle_focus\?\.primary/);
assert.match(routeSource, /movement_count/);
assert.match(routeSource, /set_count/);
assert.match(routeSource, /const \[selectedDate, setSelectedDate\]/);
assert.match(routeSource, /onSelectDate=\{setSelectedDate\}/);
assert.match(routeSource, /function DayDetailModal/);
assert.match(routeSource, /activateAfterLongPress\(320\)/);
assert.match(routeSource, /isCoachCalendarDropTargetValid/);
assert.match(routeSource, /measureInWindow/);
assert.match(routeSource, /monthDayDragInvalid/);
assert.match(routeSource, /monthDayDragValid/);
assert.match(routeSource, /monthDayDragTarget/);
assert.match(routeSource, /withCalendarSessionDate/);
assert.match(routeSource, /The Session remains on its original date/);
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

assert.match(dropdownSource, /measureInWindow/, 'shared dropdown must anchor to the visible trigger');
assert.match(dropdownSource, /resolveCompactDropdownLayout/, 'shared dropdown must apply safe-area collision positioning');
assert.match(dropdownSource, /testID \? `\$\{testID\}-backdrop`/, 'shared dropdown must expose outside-tap dismissal');
assert.match(dropdownSource, /accessibilityRole="menuitem"/, 'shared dropdown rows must be accessible menu items');
assert.match(dropdownSource, /accessibilityState=\{\{ selected \}\}/, 'shared dropdown must expose selected state');
assert.match(dropdownSource, /SLMotionPressable/, 'triggers and rows must use the tactile control primitive');
assert.match(dropdownSource, /numberOfLines=\{1\}/, 'long labels must truncate instead of wrapping the compact header');

console.log('Coach Calendar V2 helper and route regression checks passed.');
