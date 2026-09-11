import assert from 'node:assert/strict';
import { createLoggerJournal } from '../lib/session-logger-journal.ts';
const disk = new Map();
const store = { getItem: async key => disk.get(key) || null, setItem: async (key, value) => { disk.set(key, value); } };
const journal = createLoggerJournal(store, 'actor:7', 10);
await journal.ready;
const draft = { itemId: 30, identity: 'core:1', revision: 2, setIndex: 1, kind: 'core', weightKg: 100, reps: '3', effort: '8' };
await journal.saveDraft(draft);
await journal.focus('core:30');
assert.equal(await journal.attempt('top:30:1', 'payload1', () => 'stable-attempt'), 'stable-attempt');
const restarted = createLoggerJournal(store, 'actor:7', 10);
await restarted.ready;
assert.deepEqual(restarted.draft(30, 'core:1', 2, 1), draft);
assert.equal(await restarted.attempt('top:30:1', 'payload1', () => 'wrong-new-id'), 'stable-attempt', 'ambiguous retries retain their durable submission ID');
for (const [identity, revision, slot] of [['core:2', 2, 1], ['core:1', 3, 1], ['core:1', 2, 2]]) assert.equal(restarted.draft(30, identity, revision, slot), null);
for (const [owner, workout] of [['actor:8', 10], ['actor:7', 11]]) {
  const other = createLoggerJournal(store, owner, workout); await other.ready;
  assert.equal(other.draft(30, 'core:1', 2, 1), null, 'neither account nor Session may inherit another draft');
}
await restarted.accepted('top:30:1', 30);
const accepted = createLoggerJournal(store, 'actor:7', 10); await accepted.ready;
assert.equal(accepted.draft(30, 'core:1', 2, 1), null);
assert.deepEqual(accepted.snapshot().attempts, {});
const writes = [];
const delayed = createLoggerJournal({ ...store, setItem: async (_, value) => { await new Promise(resolve => setTimeout(resolve, 2)); writes.push(JSON.parse(value).focusedKey); } }, 'actor:9', 10);
await Promise.all([delayed.focus('core:1'), delayed.focus('core:2'), delayed.focus('acc:3')]);
assert.deepEqual(writes, ['core:1', 'core:2', 'acc:3'], 'asynchronous storage writes cannot roll back newer input');
console.log('Session logger journal: PASS (restart, ambiguous retry, subject, identity, revision, accepted clearing, write order)');

await assert.rejects(journal.saveDraft({ ...draft, weightKg: NaN }), /Invalid local/);
const key = 'strength-ledger:logger-journal:v1:actor:7:10';
const damaged = JSON.parse(disk.get(key)); damaged.drafts['30'] = { ...draft, setIndex: '1' }; damaged.attempts.bad = { id: 5, signature: 'x' };
disk.set(key, JSON.stringify(damaged));
const repaired = createLoggerJournal(store, 'actor:7', 10); await repaired.ready;
assert.equal(repaired.draft(30, 'core:1', 2, 1), null);
assert.equal(repaired.snapshot().attempts.bad, undefined);
