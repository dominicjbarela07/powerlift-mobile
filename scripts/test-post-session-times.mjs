import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSessionTimeDraft,
  formatSessionTimeLabel,
  parseSessionLifecycleInstant,
  parseSessionTimeDraft,
  replaceSessionDatePart,
  replaceSessionTimePart,
  sessionTimePartsToInstant,
} from '../lib/post-session-times.ts';

// Legacy backend lifecycle datetimes are naive UTC. Explicit offsets must not
// be converted a second time.
assert.equal(
  parseSessionLifecycleInstant('2026-08-10T15:01:00')?.toISOString(),
  '2026-08-10T15:01:00.000Z',
);
assert.equal(
  parseSessionLifecycleInstant('2026-08-10T08:01:00-07:00')?.toISOString(),
  '2026-08-10T15:01:00.000Z',
);

// The lifecycle start is authoritative; opening the POST transition captures
// its end exactly once from `now`.
const draft = createSessionTimeDraft(
  '2026-08-10T15:01:00',
  new Date('2026-08-10T16:13:00.000Z'),
);
const parsed = parseSessionTimeDraft(draft);
assert.equal(parsed.error, null);
assert.equal(parsed.value?.startedAt, '2026-08-10T15:01:00.000Z');
assert.equal(parsed.value?.endedAt, '2026-08-10T16:13:00.000Z');
assert.equal(parsed.value?.durationSeconds, 4320);

// Persisted duration reconstructs the historical end rather than using now.
const completedDraft = createSessionTimeDraft(
  '2026-08-10T15:01:00',
  new Date('2026-08-12T16:13:00.000Z'),
  4320,
);
assert.equal(completedDraft.end.toISOString(), '2026-08-10T16:13:00.000Z');

// A missing or zero completed duration is not an authoritative end time.
// Number(null) used to become zero and incorrectly rendered START === END.
const transitionNow = new Date('2026-08-10T16:13:00.000Z');
assert.equal(
  createSessionTimeDraft('2026-08-10T15:01:00', transitionNow, null).end.toISOString(),
  transitionNow.toISOString(),
);
assert.equal(
  createSessionTimeDraft('2026-08-10T15:01:00', transitionNow, 0).end.toISOString(),
  transitionNow.toISOString(),
);

// Display uses canonical training timezone and localized 12-hour output.
assert.equal(
  formatSessionTimeLabel(draft.start, {
    sessionDate: '2026-08-10',
    timeZone: 'America/Los_Angeles',
    locale: 'en-US',
  }),
  '8:01 AM',
);
assert.equal(
  formatSessionTimeLabel(new Date('2026-08-10T19:05:00.000Z'), {
    sessionDate: '2026-08-10',
    timeZone: 'America/Los_Angeles',
    locale: 'en-US',
  }),
  '12:05 PM',
);
assert.match(
  formatSessionTimeLabel(new Date('2026-08-11T07:05:00.000Z'), {
    sessionDate: '2026-08-10',
    timeZone: 'America/Los_Angeles',
    locale: 'en-US',
  }),
  /Aug 11.*12:05 AM/,
);

// Native date/time picker wall-clock values round-trip in the training zone.
const nineThirteen = sessionTimePartsToInstant({
  year: 2026,
  month: 8,
  day: 10,
  hour: 9,
  minute: 13,
}, 'America/Los_Angeles');
assert.equal(nineThirteen?.toISOString(), '2026-08-10T16:13:00.000Z');

const nextDate = replaceSessionDatePart(
  nineThirteen,
  new Date('2026-08-12T19:00:00.000Z'),
  'America/Los_Angeles',
);
assert.equal(nextDate?.toISOString(), '2026-08-12T16:13:00.000Z');
const newTime = replaceSessionTimePart(
  nextDate,
  new Date('2026-08-10T22:45:00.000Z'),
  'America/Los_Angeles',
);
assert.equal(newTime?.toISOString(), '2026-08-12T22:45:00.000Z');

assert.match(
  parseSessionTimeDraft({
    start: new Date('2026-08-10T20:00:00.000Z'),
    end: new Date('2026-08-10T19:00:00.000Z'),
  }).error || '',
  /after session start/,
);
assert.equal(
  parseSessionTimeDraft({
    start: new Date('2026-08-10T23:30:00.000Z'),
    end: new Date('2026-08-11T01:00:00.000Z'),
  }).value?.durationSeconds,
  5400,
);
assert.match(
  parseSessionTimeDraft({
    start: new Date('invalid'),
    end: new Date('2026-08-10T19:00:00.000Z'),
  }).error || '',
  /valid start and end time/,
);
assert.match(
  parseSessionTimeDraft({
    start: new Date('2026-08-10T19:00:00.000Z'),
    end: new Date('2026-08-11T20:00:01.000Z'),
  }).error || '',
  /cannot exceed 24 hours/,
);

const workoutSource = readFileSync(
  new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url),
  'utf8',
);
assert.match(workoutSource, /postSessionTimePickerDraft/);
assert.match(workoutSource, /postSessionTimeRow/);
assert.match(workoutSource, /display="spinner"/);
assert.match(workoutSource, /session_started_at: sessionTimes\.startedAt/);
assert.match(workoutSource, /session_ended_at: sessionTimes\.endedAt/);
assert.match(workoutSource, /const completed = await completeWorkout/);
assert.match(workoutSource, /if \(completed\) \{[\s\S]*?setPostSessionVisible\(false\)/);

console.log('[post-session-times] lifecycle defaults, picker workflow, persistence payload, display, and validation passed');
