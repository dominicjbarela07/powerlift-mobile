import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CALENDAR_ALERT_OPTIONS,
  calendarAlertLabel,
  calendarEventDraftFrom,
  createSingleSubmitGate,
  eventMutationFromDraft,
} from '../lib/calendar-event-form.ts';

const componentSource = await readFile(
  new URL('../components/calendar/CalendarEventSheet.tsx', import.meta.url),
  'utf8',
);
const screenSource = await readFile(
  new URL('../app/(tabs)/athlete-calendar.tsx', import.meta.url),
  'utf8',
);

for (const removedText of ['Reminder', 'Travel Time', 'Invitees', 'Add attachment']) {
  assert.doesNotMatch(componentSource, new RegExp(removedText, 'i'), `${removedText} must not reappear`);
}
assert.doesNotMatch(componentSource, /label="Calendar"/, 'the canonical athlete Calendar has no selector row');
assert.doesNotMatch(componentSource, /styles\.segmented|segmentSelected/, 'the Event/Reminder segmented control is removed');
assert.match(componentSource, /Edit Event/);
assert.match(componentSource, /New Event/);
assert.match(componentSource, /placeholder="Notes"/);
assert.match(componentSource, /saveError/);
const dateRowSource = componentSource.slice(
  componentSource.indexOf('function DateRow'),
  componentSource.indexOf('function ChoiceRow'),
);
assert.doesNotMatch(dateRowSource, /<TextInput\b/, 'start and end values must not be editable text fields');
assert.match(dateRowSource, /<DateTimePicker[\s\S]*?mode="date"/, 'start and end dates use native date selectors');
assert.match(dateRowSource, /<DateTimePicker[\s\S]*?mode="time"/, 'timed events use native time selectors');
assert.match(
  dateRowSource,
  /Platform\.OS === 'ios'[\s\S]*?display="compact"[\s\S]*?Platform\.OS === 'android'[\s\S]*?androidPickerMode/,
  'iOS uses compact selectors while Android opens its system picker on demand',
);
assert.match(screenSource, /setEventMutationError/, 'live save failures remain in the open editor');
assert.doesNotMatch(screenSource, /Alert\.alert\('Event not saved'/, 'save failures are not dismissed into a transient alert');

const timedDraft = calendarEventDraftFrom(null, '2026-07-22', {
  title: '  Sports massage  ',
  location: ' Recovery Studio ',
  notes: ' Bring referral. ',
  repeatRule: 'weekly',
  alertOffsetMinutes: 15,
});
const timedResult = eventMutationFromDraft(timedDraft, 'America/Los_Angeles');
assert.ok('payload' in timedResult);
assert.deepEqual(Object.keys(timedResult.payload).sort(), [
  'alert_offset_minutes',
  'all_day',
  'ends_at',
  'location',
  'notes',
  'repeat_rule',
  'starts_at',
  'timezone',
  'title',
]);
assert.equal(timedResult.payload.title, 'Sports massage');
assert.equal(timedResult.payload.repeat_rule, 'weekly');
assert.equal(timedResult.payload.alert_offset_minutes, 15);

for (const option of CALENDAR_ALERT_OPTIONS) {
  const result = eventMutationFromDraft({ ...timedDraft, alertOffsetMinutes: option.value }, 'America/Los_Angeles');
  assert.ok('payload' in result);
  assert.equal(result.payload.alert_offset_minutes, option.value);
  assert.equal(calendarAlertLabel(option.value), option.label);
}

const restored = calendarEventDraftFrom({
  title: 'Physical therapy',
  startsAt: '2026-07-29T09:30:00-07:00',
  endsAt: '2026-07-29T10:30:00-07:00',
  allDay: false,
  repeatRule: 'monthly',
  alertOffsetMinutes: 30,
}, '2026-07-29');
assert.equal(restored.repeatRule, 'monthly');
assert.equal(restored.alertOffsetMinutes, 30);

const allDayDraft = calendarEventDraftFrom(null, '2026-07-22', {
  title: 'Travel day',
  allDay: true,
  startDate: '2026-07-22',
  endDate: '2026-07-23',
  startTime: '19:45',
  endTime: '19:46',
});
const allDayResult = eventMutationFromDraft(allDayDraft, 'America/Los_Angeles');
assert.ok('payload' in allDayResult);
assert.match(allDayResult.payload.starts_at, /^2026-07-22T00:00:00/);
assert.match(allDayResult.payload.ends_at, /^2026-07-24T00:00:00/);

const timedAgain = eventMutationFromDraft({ ...allDayDraft, allDay: false }, 'America/Los_Angeles');
assert.ok('payload' in timedAgain);
assert.match(timedAgain.payload.starts_at, /T19:45:00/);
assert.match(timedAgain.payload.ends_at, /T19:46:00/);

const emptyTitle = eventMutationFromDraft({ ...timedDraft, title: '   ' }, 'America/Los_Angeles');
assert.ok('errors' in emptyTitle);
assert.equal(emptyTitle.errors.title, 'Title is required.');

const invalidEnd = eventMutationFromDraft({
  ...timedDraft,
  startTime: '11:00',
  endTime: '10:00',
}, 'America/Los_Angeles');
assert.ok('errors' in invalidEnd);
assert.equal(invalidEnd.errors.ends_at, 'End must be after start.');

const gate = createSingleSubmitGate();
assert.equal(gate.tryLock(), true);
assert.equal(gate.tryLock(), false, 'a second save cannot submit while the first is active');
gate.release();
assert.equal(gate.tryLock(), true, 'a failed or completed save may be retried after release');

console.log('Calendar event modal contract tests passed.');
