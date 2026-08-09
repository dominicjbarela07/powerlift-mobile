import assert from 'node:assert/strict';

import {
  rangeContainsDate,
  resolveCalendarToday,
} from '../lib/calendar-today.ts';
import { createLatestRequestManager } from '../lib/latest-request.ts';
import { classifyTodayResponse } from '../lib/today-response.ts';

const la = 'America/Los_Angeles';
const tokyo = 'Asia/Tokyo';

assert.equal(
  resolveCalendarToday(new Date('2026-07-23T07:30:00Z'), la, 'UTC').date,
  '2026-07-23',
  'midnight boundary uses the athlete timezone',
);
assert.equal(
  resolveCalendarToday(new Date('2026-07-23T06:30:00Z'), la, 'UTC').date,
  '2026-07-22',
  'the prior local day is not calculated in UTC',
);
assert.equal(
  resolveCalendarToday(new Date('2026-07-23T16:30:00Z'), tokyo, la).date,
  '2026-07-24',
  'athlete timezone wins when the device timezone differs',
);
assert.equal(
  resolveCalendarToday(new Date('2026-07-23T16:30:00Z'), null, la).date,
  '2026-07-23',
  'device timezone is the fallback only when training timezone is absent',
);
assert.equal(
  resolveCalendarToday(new Date('2026-03-08T09:59:00Z'), la, 'UTC').date,
  '2026-03-08',
  'spring DST boundary keeps the local calendar date',
);
assert.equal(
  resolveCalendarToday(new Date('2026-11-01T09:30:00Z'), la, 'UTC').date,
  '2026-11-01',
  'fall DST boundary keeps the local calendar date',
);
assert.deepEqual(
  resolveCalendarToday(new Date('2027-01-01T07:30:00Z'), la, 'UTC'),
  {
    date: '2026-12-31',
    timezone: la,
    monthStart: '2026-12-01',
    weekStart: '2026-12-27',
  },
  'December-to-January is resolved in local time',
);

assert.equal(rangeContainsDate('2026-07-01', '2026-08-01', '2026-07-23'), true);
assert.equal(rangeContainsDate('2025-01-01', '2025-03-01', '2026-07-23'), false);
assert.equal(rangeContainsDate('2026-07-01', '2026-08-01', '2026-08-01'), false, 'range end is exclusive');

const manager = createLatestRequestManager();
assert.deepEqual(await manager.run(async () => ({ ok: true })), {
  kind: 'success',
  value: { ok: true },
});

const offline = await manager.run(async () => {
  throw new TypeError('Network request failed');
});
assert.equal(offline.kind, 'error', 'actual offline failure remains an error');

let releaseFirst;
const first = manager.run((signal) => new Promise((resolve, reject) => {
  releaseFirst = resolve;
  signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })));
}));
const second = manager.run(async () => 'newest');
assert.equal((await first).kind, 'cancelled', 'superseded request is ignored');
assert.deepEqual(await second, { kind: 'success', value: 'newest' });
releaseFirst?.('obsolete');

const navigationRequest = manager.run((signal) => new Promise((_resolve, reject) => {
  signal.addEventListener('abort', () => reject(Object.assign(new Error('navigation'), { name: 'AbortError' })));
}));
manager.cancel();
assert.equal((await navigationRequest).kind, 'cancelled', 'navigation away cancels without an error');

const blockPredicate = (payload) => payload?.account_state === 'ACTIVATION_REQUIRED';
assert.equal(classifyTodayResponse({ ok: true, status: 200, json: { ok: true, today: { date: '2026-07-23' } } }, blockPredicate).kind, 'success');
assert.equal(classifyTodayResponse({ ok: false, status: 503, json: { ok: false, error: 'Service unavailable' } }, blockPredicate).kind, 'api-error');
assert.equal(classifyTodayResponse({ ok: false, status: 401, json: { ok: false } }, blockPredicate).kind, 'unauthorized');
assert.equal(classifyTodayResponse({ ok: false, status: 403, json: { account_state: 'ACTIVATION_REQUIRED' } }, blockPredicate).kind, 'account-state-block');
assert.equal(classifyTodayResponse({ ok: true, status: 200, json: { ok: true } }, blockPredicate).kind, 'invalid');

console.log('Calendar Today and Today request lifecycle tests passed.');
