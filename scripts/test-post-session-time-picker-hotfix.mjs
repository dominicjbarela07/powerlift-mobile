import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSessionTimeDraft,
  formatSessionTimeLabel,
  parseSessionLifecycleInstant,
  parseSessionTimeDraft,
  replaceSessionTimePart,
  resolveSessionCompletionTiming,
} from '../lib/post-session-times.ts';

assert.equal(parseSessionLifecycleInstant('2026-08-20T15:00:00')?.toISOString(), '2026-08-20T15:00:00.000Z');
assert.equal(parseSessionLifecycleInstant('2026-08-20T08:00:00-07:00')?.toISOString(), '2026-08-20T15:00:00.000Z');

const draft = createSessionTimeDraft('2026-08-20T15:00:00', new Date('2026-08-20T16:30:00.000Z'));
assert.equal(
  createSessionTimeDraft('2026-08-20T15:00:00', new Date('2026-08-21T16:30:00.000Z'), 5400).end.toISOString(),
  '2026-08-20T16:30:00.000Z',
);
assert.equal(formatSessionTimeLabel(draft.start, {
  sessionDate: '2026-08-20',
  timeZone: 'America/Los_Angeles',
  locale: 'en-US',
}), '8:00 AM');

const correctedEnd = replaceSessionTimePart(
  draft.end,
  new Date('2026-08-20T17:45:00.000Z'),
  'America/Los_Angeles',
);
assert.equal(correctedEnd?.toISOString(), '2026-08-20T17:45:00.000Z');
const parsed = parseSessionTimeDraft({ start: draft.start, end: correctedEnd });
assert.equal(parsed.error, null);
assert.equal(parsed.value?.durationSeconds, 9900);
assert.match(parseSessionTimeDraft({ start: correctedEnd, end: draft.start }).error || '', /after session start/);

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

const source = readFileSync(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url), 'utf8');
assert.match(source, /onPress=\{\(\) => openPostSessionTimePicker\(target\)\}/);
assert.match(source, /value=\{postSessionTimePickerDraft \|\| new Date\(\)\}/);
assert.match(source, /mode="time"/);
assert.match(source, /postSessionTimePickerOverlay/);
assert.doesNotMatch(
  source,
  /<Modal\s+[\s\S]*?visible=\{postSessionTimePicker != null\}/,
  'time picker must not attempt a second iOS modal presentation',
);
assert.match(source, /session_started_at: sessionTimes\.startedAt/);
assert.match(source, /session_ended_at: sessionTimes\.endedAt/);
assert.match(source, /session_duration_unavailable: true/);
assert.match(source, /reasonCode: 'performed_duration_unavailable'/);
assert.equal((source.match(/resolveSessionCompletionTiming\(/g) || []).length, 2,
  'Skip Reflection and full reflection must share the extended-Session decision');
assert.match(source, /Duration not recorded/);
assert.match(source, /setPostSessionForm\(nextForm\)/);
assert.match(source, /onPress=\{closePostSessionTimePicker\}[\s\S]*?>Cancel</);

console.log('[post-session-time-picker-hotfix] presentation, cancel/confirm state, timezone, payload, and duration passed');
