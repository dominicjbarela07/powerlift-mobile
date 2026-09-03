import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSessionTimeDraft,
  formatSessionTimeLabel,
  parseSessionLifecycleInstant,
  parseSessionTimeDraft,
  replaceSessionDatePart,
  replaceSessionTimePart,
  resolveSessionCompletionTiming,
  sessionTimePartsToInstant,
} from '../lib/post-session-times.ts';

assert.equal(parseSessionLifecycleInstant('2026-08-10T15:01:00')?.toISOString(), '2026-08-10T15:01:00.000Z');
assert.equal(parseSessionLifecycleInstant('2026-08-10T08:01:00-07:00')?.toISOString(), '2026-08-10T15:01:00.000Z');

const draft = createSessionTimeDraft('2026-08-10T15:01:00', new Date('2026-08-10T16:13:00.000Z'));
const parsed = parseSessionTimeDraft(draft);
assert.equal(parsed.error, null);
assert.equal(parsed.value?.startedAt, '2026-08-10T15:01:00.000Z');
assert.equal(parsed.value?.endedAt, '2026-08-10T16:13:00.000Z');
assert.equal(parsed.value?.durationSeconds, 4320);

const completedDraft = createSessionTimeDraft('2026-08-10T15:01:00', new Date('2026-08-12T16:13:00.000Z'), 4320);
assert.equal(completedDraft.end.toISOString(), '2026-08-10T16:13:00.000Z');

// Missing/zero duration is not an authoritative end. Number(null) used to
// become zero and incorrectly rendered START === END.
const transitionNow = new Date('2026-08-10T16:13:00.000Z');
assert.equal(
  createSessionTimeDraft('2026-08-10T15:01:00', transitionNow, null).end.toISOString(),
  transitionNow.toISOString(),
);
assert.equal(
  createSessionTimeDraft('2026-08-10T15:01:00', transitionNow, 0).end.toISOString(),
  transitionNow.toISOString(),
);

assert.equal(formatSessionTimeLabel(draft.start, {
  sessionDate: '2026-08-10',
  timeZone: 'America/Los_Angeles',
  locale: 'en-US',
}), '8:01 AM');
assert.equal(formatSessionTimeLabel(new Date('2026-08-10T19:05:00.000Z'), {
  sessionDate: '2026-08-10',
  timeZone: 'America/Los_Angeles',
  locale: 'en-US',
}), '12:05 PM');
assert.match(formatSessionTimeLabel(new Date('2026-08-11T07:05:00.000Z'), {
  sessionDate: '2026-08-10',
  timeZone: 'America/Los_Angeles',
  locale: 'en-US',
}), /Aug 11.*12:05 AM/);

const nineThirteen = sessionTimePartsToInstant({ year: 2026, month: 8, day: 10, hour: 9, minute: 13 }, 'America/Los_Angeles');
assert.equal(nineThirteen?.toISOString(), '2026-08-10T16:13:00.000Z');
const nextDate = replaceSessionDatePart(nineThirteen, new Date('2026-08-12T19:00:00.000Z'), 'America/Los_Angeles');
assert.equal(nextDate?.toISOString(), '2026-08-12T16:13:00.000Z');
const newTime = replaceSessionTimePart(nextDate, new Date('2026-08-10T22:45:00.000Z'), 'America/Los_Angeles');
assert.equal(newTime?.toISOString(), '2026-08-12T22:45:00.000Z');

assert.match(parseSessionTimeDraft({
  start: new Date('2026-08-10T20:00:00.000Z'),
  end: new Date('2026-08-10T19:00:00.000Z'),
}).error || '', /after session start/);
assert.equal(parseSessionTimeDraft({
  start: new Date('2026-08-10T23:30:00.000Z'),
  end: new Date('2026-08-11T01:00:00.000Z'),
}).value?.durationSeconds, 5400);
assert.match(parseSessionTimeDraft({
  start: new Date('invalid'),
  end: new Date('2026-08-10T19:00:00.000Z'),
}).error || '', /valid start and end time/);
assert.match(parseSessionTimeDraft({
  start: new Date('2026-08-10T19:00:00.000Z'),
  end: new Date('2026-08-11T20:00:01.000Z'),
}).error || '', /cannot exceed 24 hours/);

const boundaryStart = new Date('2026-09-01T12:00:00.000Z');
for (const [seconds, expectedDuration, unavailable] of [
  [23 * 60 * 60 + 59 * 60, 23 * 60 * 60 + 59 * 60, false],
  [24 * 60 * 60, 24 * 60 * 60, false],
  [24 * 60 * 60 + 60, null, true],
  [36 * 60 * 60, null, true],
  [48 * 60 * 60, null, true],
]) {
  const decision = resolveSessionCompletionTiming({
    start: boundaryStart,
    end: new Date(boundaryStart.getTime() + seconds * 1000),
  });
  assert.equal(decision.error, null);
  assert.equal(decision.durationUnavailable, unavailable);
  assert.equal(decision.value?.durationSeconds ?? null, expectedDuration);
}
assert.match(resolveSessionCompletionTiming({
  start: boundaryStart,
  end: new Date(boundaryStart.getTime() + 25 * 60 * 60 * 1000),
}, { manuallyCorrected: true }).error || '', /cannot exceed 24 hours/);

const workoutSource = readFileSync(
  new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url),
  'utf8',
);
const trainingHubSource = readFileSync(new URL('../app/(tabs)/workout/index.tsx', import.meta.url), 'utf8');
const calendarSource = readFileSync(new URL('../components/calendar/AthleteCalendarExperience.tsx', import.meta.url), 'utf8');
assert.match(workoutSource, /postSessionTimePickerDraft/);
assert.match(workoutSource, /postSessionTimeRow/);
assert.match(workoutSource, /display="spinner"/);
assert.match(workoutSource, /postSessionTimePickerOverlay/);
assert.match(workoutSource, /style=\{StyleSheet\.absoluteFillObject\}/);
assert.doesNotMatch(
  workoutSource,
  /<Modal\s+[\s\S]*?visible=\{postSessionTimePicker != null\}/,
  'the iOS picker must render inside the reflection modal instead of attempting a second native modal presentation',
);
assert.match(workoutSource, /session_started_at: sessionTimes\.startedAt/);
assert.match(workoutSource, /session_ended_at: sessionTimes\.endedAt/);
assert.match(workoutSource, /session_duration_unavailable: true/);
assert.match(workoutSource, /reasonCode: 'performed_duration_unavailable'/);
assert.equal((workoutSource.match(/resolveSessionCompletionTiming\(/g) || []).length, 2,
  'Skip Reflection and full reflection must share the extended-Session decision');
assert.match(trainingHubSource, /sessionState === 'complete'[\s\S]*Duration not recorded/,
  'completed Training Hub rows must distinguish unknown performed duration from estimates');
assert.match(trainingHubSource, /label="Duration"[\s\S]*'Not recorded'/,
  'completed Training Hub evidence must not render unknown duration as a dash');
assert.match(calendarSource, /label="DURATION"[\s\S]*'Not recorded'/,
  'completed athlete calendar evidence must render unknown duration explicitly');
assert.match(workoutSource, /const completed = await completeWorkout/);
assert.match(workoutSource, /if \(completed\) \{[\s\S]*?setPostSessionVisible\(false\)/);

console.log('[post-session-times] lifecycle defaults, picker workflow, persistence payload, display, and validation passed');
