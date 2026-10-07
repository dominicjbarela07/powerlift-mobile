import assert from 'node:assert/strict';
import { buildProgramTimelinePayload } from '../lib/program-timeline.ts';
import { trainingHubSessionStatusLabel } from '../lib/training-hub-session-labels.ts';
import { resolveTrainingHubSessionPreviewAction } from '../lib/training-hub-session-preview.ts';
import { resolveCalendarSessionStatus } from '../lib/calendar-session-status.ts';
import { sessionUnavailableExplanation } from '../lib/session-availability.ts';
import { sessionExecutionCapabilities } from '../lib/session-logger-lifecycle.ts';

function checkProjection(status, date) {
  const input = { id: 1815, status, raw_status: status, kind: 'missed', timeliness: 'missed', date, loggable: false };
  const payload = buildProgramTimelinePayload({
    training_hub: { today: '2026-10-06', active_program: { id: 29 }, current_block: { id: 168 } },
    blocks: [{ id: 168, training_program_id: 29, start_date: '2026-10-04', end_date: '2026-10-10' }],
    pending_map: { 168: [input] },
  });
  const mapped = payload.blocks[0].weeks[0];
  const session = mapped.days.flatMap(day => day.sessions)[0];
  const expected = status === 'cancelled' ? 'canceled' : status;
  assert.equal(session.lifecycle, expected, `${status} must not inherit a date-derived Missed/Today state`);
  assert.equal(mapped.missedCount, 0, 'unavailable Sessions never create missed attendance');
  assert.equal(mapped.lifecycle, expected, 'an unavailable-only Week never becomes missed or active');
  const label = expected[0].toUpperCase() + expected.slice(1);
  assert.equal(trainingHubSessionStatusLabel(input), label, 'Training and Program map must agree');
  assert.equal(resolveCalendarSessionStatus(status).label, label);
  assert.equal(resolveTrainingHubSessionPreviewAction({ status, fallbackStatus: 'missed' }).openable, false);
  assert.ok(sessionUnavailableExplanation({ status, loggable: false, canBegin: false }));
  assert.equal(sessionExecutionCapabilities({ status, canLog: true, previewRequested: false }).canBegin, false, 'a misleading permission must not start an unavailable Session');
  return session;
}
for (const status of ['draft', 'canceled', 'cancelled', 'archived']) {
  for (const date of ['2026-10-04', '2026-10-06', '2026-10-10']) checkProjection(status, date);
}
// Deliberately reproduce the old past-date conversion: the same assertion must
// reject the bad presentation rather than merely checking a source snippet.
assert.throws(() => assert.equal({ ...checkProjection('draft', '2026-10-04'), lifecycle: 'missed' }.lifecycle, 'draft'));
assert.equal(sessionUnavailableExplanation({ status: 'assigned', canBegin: true, loggable: true }), null);
assert.equal(sessionUnavailableExplanation({ status: 'assigned', loggable: false, blockReason: 'Wait for your coach.' }), 'Wait for your coach.');
console.log('Unavailable Session projections PASS: 12 lifecycle/date combinations; reproduced Draft→Missed rejected; execution remains blocked.');
