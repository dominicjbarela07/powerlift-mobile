import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { resolveAthleteCalendarMonthIndicator } from '../lib/athlete-calendar-month-summary.ts';

const [storyboard, legacyExperience, route] = await Promise.all([
  readFile(new URL('../components/calendar/AthleteCalendarStoryboardV2.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/calendar/AthleteCalendarExperience.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/(tabs)/athlete-calendar.tsx', import.meta.url), 'utf8'),
]);

assert.deepEqual(
  resolveAthleteCalendarMonthIndicator({
    metricKind: 'session_completion_to_date',
    plannedCount: 11,
    dueCount: 10,
    dueCompletedCount: 10,
    completionPercent: 100,
  }),
  {
    primary: '10/10',
    label: 'SESSIONS',
    percent: '100%',
    accessibilityLabel: '10 of 10 Sessions due through today completed, 100 percent',
    authoritative: true,
  },
  'tomorrow\'s Session does not depress completion through today',
);

assert.deepEqual(
  resolveAthleteCalendarMonthIndicator({
    metricKind: 'session_completion_to_date',
    plannedCount: 12,
    dueCount: 0,
    dueCompletedCount: 0,
    completionPercent: null,
  }),
  {
    primary: '12',
    label: 'PLANNED',
    percent: null,
    accessibilityLabel: '12 future Sessions planned; no Session opportunities due yet',
    authoritative: true,
  },
  'future programming is represented as planned, never zero-percent performance',
);

assert.deepEqual(
  resolveAthleteCalendarMonthIndicator({
    metricKind: 'session_completion_to_date',
    plannedCount: 0,
    dueCount: 0,
    dueCompletedCount: 0,
    completionPercent: null,
  }),
  {
    primary: '—',
    label: 'NO SESSIONS',
    percent: null,
    accessibilityLabel: 'No qualifying Sessions scheduled',
    authoritative: true,
  },
  'empty months never render 0/0 or 0 percent',
);

const legacy = resolveAthleteCalendarMonthIndicator({ plannedCount: 11, completionPercent: 91 });
assert.equal(legacy.primary, '11');
assert.equal(legacy.label, 'PLANNED');
assert.equal(legacy.percent, null, 'older ambiguous backend projections fail neutral');

assert.match(storyboard, /summaryLabel[\s\S]*indicator\.label[\s\S]*indicator\.percent/, 'ratio meaning is visibly labeled');
assert.match(storyboard, /SESSION COMPLETION THROUGH TODAY/, 'expanded summary states the metric semantics');
assert.doesNotMatch(storyboard, /completionFromDays|countCompleted\(days|countPlanned\(days/, 'mobile does not maintain a competing completion formula');
assert.doesNotMatch(legacyExperience, /completed\s*\/\s*planned|completed\s*\/\s*sessionCount/, 'legacy Calendar presentation also consumes the canonical month contract');
assert.match(route, /metric_kind[\s\S]*due_count[\s\S]*due_completed_count[\s\S]*missed_count/, 'route maps the canonical backend contract');
console.log('Athlete Calendar month-summary correctness contracts passed.');
