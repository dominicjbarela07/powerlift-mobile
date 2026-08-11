import assert from 'node:assert/strict';
import {
  createSessionTimeDraft,
  formatSessionTimeLabel,
  parseSessionLifecycleInstant,
  parseSessionTimeDraft,
  replaceSessionDatePart,
  replaceSessionTimePart,
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

console.log('[post-session-times] lifecycle UTC, picker round-trip, display, and validation passed');
