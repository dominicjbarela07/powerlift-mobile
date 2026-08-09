import assert from 'node:assert/strict';
import {
  createSessionTimeDraft,
  parseSessionTimeDraft,
} from '../lib/post-session-times.ts';

const draft = createSessionTimeDraft(
  '2026-08-09T18:00:00.000Z',
  new Date('2026-08-09T19:30:00.000Z'),
);
const parsed = parseSessionTimeDraft(draft);
assert.equal(parsed.error, null);
assert.equal(parsed.value?.durationSeconds, 5400);

assert.match(
  parseSessionTimeDraft({ start: '2026-08-09 20:00', end: '2026-08-09 19:00' }).error || '',
  /after session start/,
);
assert.match(
  parseSessionTimeDraft({ start: 'bad', end: '2026-08-09 19:00' }).error || '',
  /YYYY-MM-DD HH:MM/,
);

console.log('[post-session-times] defaults, parsing, and validation passed');
