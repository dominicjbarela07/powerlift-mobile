import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ATHLETE_CALENDAR_DAYS_PER_WEEK,
  ATHLETE_CALENDAR_WEEKDAYS,
  athleteCalendarBlockTransitionsForMonth,
  athleteCalendarWeekStartYmd,
  athleteCalendarWeeksForMonth,
  formatAthleteCalendarBlockStartDate,
} from '../lib/athlete-calendar-grid.ts';

const [storyboard, route, model] = await Promise.all([
  readFile(new URL('../components/calendar/AthleteCalendarStoryboardV2.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/(tabs)/athlete-calendar.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/calendar/AthleteCalendarExperience.tsx', import.meta.url), 'utf8'),
]);

assert.match(storyboard, /<FlatList[\s\S]*?maintainVisibleContentPosition/, 'Calendar virtualizes a stable month timeline');
assert.match(storyboard, /createCalendarBoundaryGuard/, 'Calendar pagination is gated by deliberate scroll gestures');
assert.doesNotMatch(storyboard, /onStartReached=|onEndReached=/, 'Calendar never auto-paginates merely because an edge mounted');
assert.match(storyboard, /initialNumToRender=\{CALENDAR_INITIAL_MONTHS\}/, 'Calendar limits the initial native mount transaction');
assert.match(storyboard, /maxToRenderPerBatch=\{CALENDAR_RENDER_BATCH\}/, 'Calendar mounts one month batch at a time');
assert.match(storyboard, /windowSize=\{CALENDAR_WINDOW_SIZE\}/, 'Calendar keeps a bounded native render window');
assert.match(storyboard, /getItemLayout=/, 'Calendar has deterministic month geometry for Fabric scrolling');
assert.doesNotMatch(storyboard, /onScrollToIndexFailed/, 'Calendar has no unbounded scroll-to-index retry loop');
assert.match(storyboard, /athleteCalendarWeeksForMonth\(month\)/, 'Every month uses the canonical week matrix');
assert.match(storyboard, /weeks\.map\(\(week\)/, 'Calendar renders explicit week rows');
assert.match(storyboard, /transitionsByWeek\.get\(weekStartDate\)/, 'Block transitions resolve against the exact containing week');
assert.match(storyboard, /key=\{transition\.key\}/, 'Block transitions use canonical Block/start-date identity');
assert.match(storyboard, /STARTS \{formatAthleteCalendarBlockStartDate\(transition\.startDate\)\}/, 'Block transition UI displays the canonical start date');
assert.doesNotMatch(storyboard, /monthTransitionLabel/, 'month-bound Block transition heuristic is absent');
assert.match(storyboard, /calendarColumn:\s*\{\s*flex: 1,\s*minWidth: 0\s*\}/, 'header and body share one equal-width column primitive');
assert.doesNotMatch(storyboard, /width:\s*`\$\{100 \/ 7\}%`/, 'Calendar does not depend on fractional percentage widths');
assert.doesNotMatch(storyboard, /monthGrid:\s*\{[^}]*flexWrap:\s*'wrap'/, 'Calendar never wraps a flattened month grid');
assert.match(storyboard, /lensVisible \? \([\s\S]*?<DayLens/, 'Day Lens content mounts only when requested');
assert.match(storyboard, /onOpenSummary=\{\(\) => setSummaryMonth\(item\)\}/, 'month headers open summaries on demand');
assert.match(storyboard, /<MonthSummarySheet/, 'month summary is a dedicated contextual surface');
assert.match(storyboard, /setLensVisible\(true\)[\s\S]*?lensVisible \? \(/, 'tap-to-open day lens is the primary detail interaction');
assert.doesNotMatch(storyboard, /PULL UP FOR DAY DETAIL|TRAINING JOURNEY|AUGUST SUMMARY/, 'rejected month-page architecture is absent');
assert.match(storyboard, /detail\.isToday[\s\S]*?type: 'daily-readiness'/, 'today recovery state exposes the optional canonical readiness action');
assert.doesNotMatch(storyboard, /RecoveryLens[\s\S]*?Begin Session/, 'recovery lens never exposes Begin Session');
assert.match(storyboard, /View Session Recap[\s\S]*?type: 'session'/, 'completed state routes to the canonical Session surface');
assert.match(storyboard, /Open Session[\s\S]*?type: 'session'/, 'assigned state routes to the canonical Session surface');
assert.match(storyboard, /Resume Session/, 'in-progress state retains Resume language');
assert.match(storyboard, /data\.monthSummaries/, 'month insights consume backend-projected canonical evidence');
assert.match(storyboard, /reportedBodyweight[\s\S]*?startKg[\s\S]*?latestKg/, 'reported bodyweight uses stored month observations without interpolation');
assert.match(storyboard, /TRAINING_ART[\s\S]*?gym_vibe\.jpg/, 'training day uses approved non-human Strength Ledger artwork');
assert.match(storyboard, /RECOVERY_ART[\s\S]*?gym_vibe\.jpg/, 'recovery day uses an existing non-human environment asset');
assert.match(storyboard, /root:\s*\{\s*flex: 1,\s*width: '100%'/, 'Calendar remains edge-to-edge without page-level horizontal padding');
assert.match(storyboard, /<FilterSheet/, 'filters live in a secondary dedicated surface');
assert.match(storyboard, /<JumpSheet/, 'compact date jump coexists with continuous scrolling');
assert.match(storyboard, /searchResults/, 'compact search locates real Calendar evidence');

assert.match(route, /previousCalendarRange/, 'route incrementally loads historical pages');
assert.match(route, /nextCalendarRange/, 'route incrementally loads future pages');
assert.match(route, /method: 'POST'[\s\S]*?athletes\/mobile\/readiness\/daily|athletes\/mobile\/readiness\/daily[\s\S]*?method: 'POST'/, 'recovery check-in persists through the canonical daily endpoint');
assert.match(route, /<ReadinessModal[\s\S]*?context="daily"/, 'Calendar reuses the canonical readiness survey');
assert.match(route, /month_summaries/, 'route maps backend month summaries');
assert.match(route, /\{visiblePayload \? <AthleteCalendarStoryboardV2/, 'the full Calendar tree does not mount before its canonical payload');
assert.match(model, /workoutId\?: number \| null/, 'readiness continues to model nullable Session association');
assert.match(model, /type: 'daily-readiness'/, 'Calendar action contract models recovery readiness explicitly');

assert.equal(ATHLETE_CALENDAR_WEEKDAYS.length, 7, 'weekday header has seven columns');
assert.equal(ATHLETE_CALENDAR_DAYS_PER_WEEK, 7, 'canonical week size is seven');

const monthFixtures = [
  ['August 2026', new Date(2026, 7, 1)],
  ['February 2026', new Date(2026, 1, 1)],
  ['February 2028', new Date(2028, 1, 1)],
  ['January 2027', new Date(2027, 0, 1)],
  ['December 2026', new Date(2026, 11, 1)],
  ['April 2026', new Date(2026, 3, 1)],
  ['July 2026', new Date(2026, 6, 1)],
];

for (const [label, month] of monthFixtures) {
  const weeks = athleteCalendarWeeksForMonth(month);
  assert.equal(weeks.length, 6, `${label} has six complete rows`);
  for (const week of weeks) {
    assert.equal(week.length, 7, `${label} week has seven cells`);
    week.forEach((date, weekdayIndex) => {
      assert.equal(date.getDay(), weekdayIndex, `${label} body aligns with header index ${weekdayIndex}`);
    });
  }
  const flatDates = weeks.flat();
  assert.equal(flatDates.length, 42, `${label} has 42 cells`);
  flatDates.slice(1).forEach((date, index) => {
    const previous = flatDates[index];
    assert.equal(
      Math.round((date.getTime() - previous.getTime()) / 86_400_000),
      1,
      `${label} has no omitted or duplicated dates`,
    );
  });
}

for (let year = 1900; year <= 2100; year += 1) {
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const weeks = athleteCalendarWeeksForMonth(new Date(year, monthIndex, 1));
    assert.equal(weeks.length, 6, `${year}-${monthIndex + 1} has six complete rows`);
    weeks.forEach((week) => {
      assert.equal(week.length, 7, `${year}-${monthIndex + 1} week has seven cells`);
      week.forEach((date, weekdayIndex) => {
        assert.equal(date.getDay(), weekdayIndex, `${year}-${monthIndex + 1} aligns weekday ${weekdayIndex}`);
      });
    });
  }
}

const chronologyRanges = [
  { id: 10, label: 'Week Start', start: '2026-07-05', end: '2026-07-11' },
  { id: 11, label: 'Midweek', start: '2026-07-15', end: '2026-07-24' },
  { id: 12, label: 'Saturday', start: '2026-07-25', end: '2026-07-25' },
  { id: 13, label: 'Offseason', start: '2026-07-27', end: '2026-09-20' },
  // Simulates the same long Block arriving in overlapping paginated payloads.
  { id: 13, label: 'Offseason', start: '2026-07-27', end: '2026-09-20' },
];
const julyTransitions = athleteCalendarBlockTransitionsForMonth(chronologyRanges, new Date(2026, 6, 1));
assert.deepEqual(julyTransitions.get('2026-07-05')?.map((item) => item.key), ['block:10:2026-07-05']);
assert.deepEqual(julyTransitions.get('2026-07-12')?.map((item) => item.key), ['block:11:2026-07-15']);
assert.deepEqual(julyTransitions.get('2026-07-19')?.map((item) => item.key), ['block:12:2026-07-25']);
assert.deepEqual(julyTransitions.get('2026-07-26')?.map((item) => item.key), ['block:13:2026-07-27']);
assert.equal([...julyTransitions.values()].flat().length, 4, 'multiple same-month Blocks render once at their actual weeks');

const augustTransitions = athleteCalendarBlockTransitionsForMonth(chronologyRanges, new Date(2026, 7, 1));
assert.equal(augustTransitions.size, 0, 'long Block and cross-month week do not repeat at the August boundary');
assert.equal(athleteCalendarWeekStartYmd('2026-07-27'), '2026-07-26', 'Monday start resolves to Sunday containing week');
assert.equal(athleteCalendarWeekStartYmd('2026-07-15'), '2026-07-12', 'Wednesday start resolves to containing week');
assert.equal(athleteCalendarWeekStartYmd('2026-07-25'), '2026-07-19', 'Saturday start resolves to containing week');
assert.equal(formatAthleteCalendarBlockStartDate('2026-07-27'), 'JUL 27', 'date label stays date-only without UTC shifting');

console.log('Athlete Calendar storyboard V2 architecture and recovery/session-state contracts passed.');
