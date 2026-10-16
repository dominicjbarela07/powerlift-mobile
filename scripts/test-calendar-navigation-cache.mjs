import assert from 'node:assert/strict';
import { createCalendarRangeRequestManager } from '../lib/calendar-range-pagination.ts';

let now = 0, calls = 0;
const range = { start: '2026-10-01', end: '2026-12-01' };
const manager = createCalendarRangeRequestManager(async () => ({ revision: ++calls }),
  { cacheScope: 'account:1|athlete:2|individual', maxAgeMs: 10_000, now: () => now });
assert.equal((await manager.request(range)).source, 'network');
assert.equal((await manager.request(range)).source, 'cache');
assert.equal(calls, 1);
now = 10_000;
assert.equal(manager.hasCached(range), false);
assert.equal((await manager.request(range)).source, 'network', 'expired ranges query fresh');
assert.equal(calls, 2);
await manager.request(range, { force: true }); assert.equal(calls, 3);
manager.clear(); await manager.request(range); assert.equal(calls, 4, 'mutation invalidation queries fresh');
const other = createCalendarRangeRequestManager(async () => ({ revision: ++calls }),
  { cacheScope: 'account:9|athlete:10|athlete', maxAgeMs: 10_000, now: () => now });
await other.request(range); assert.equal(calls, 5, 'another subject cannot reuse cached evidence');
let resolve, fetches = 0;
const pending = createCalendarRangeRequestManager(async () => { fetches++; return new Promise(r => { resolve = r; }); }, { maxAgeMs: 10_000 });
const first = pending.request(range), duplicate = pending.request(range);
assert.equal(fetches, 1, 'rapid duplicate reads share an in-flight request');
pending.cancelAll(); pending.clear(); resolve({ obsolete: true }); await first; await duplicate;
assert.equal(pending.hasCached(range), false, 'an invalidated older response cannot repopulate the cache');
let failures = 0;
const denied = createCalendarRangeRequestManager(async () => { failures++; throw new Error('Forbidden'); }, { maxAgeMs: 10_000 });
await assert.rejects(denied.request(range)); await assert.rejects(denied.request(range));
assert.equal(failures, 2, 'denied/failed reads are never cached');
console.log('PASS: Calendar opt-in freshness, explicit refresh, mutation clearing, subject isolation, in-flight deduplication and rejected obsolete/denied reads.');
