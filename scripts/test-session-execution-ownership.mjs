import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function moduleFrom(path, imports) {
  const exports = {};
  const javascript = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(javascript, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unstubbed dependency ${name}`);
    return imports[name];
  }, console, setTimeout, clearTimeout, setInterval, clearInterval, performance, Date, Map, Set, Uint8Array, crypto: globalThis.crypto }, { filename: path });
  return exports;
}
const actor = moduleFrom('lib/execution-actor.ts', {});
const memory = new Map();
let delayRead = null, delayWrite = null;
const storage = { getItem: async key => delayRead ? delayRead(key) : memory.get(key) || null,
  setItem: async (key, value) => { if (delayWrite) await delayWrite(key); memory.set(key,value); } };
const appState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
const calls = [];
const api = { API_BASE: '/api', fetchJson: async (path, options) => { calls.push({ path, options, owner: actor.currentExecutionActor() }); return { ok: true, json: { ok: true } }; } };
const core = moduleFrom('lib/session-timing-telemetry-core.ts', {});
const telemetry = moduleFrom('lib/session-timing-telemetry.ts', { '@/lib/execution-actor': actor, '@react-native-async-storage/async-storage': { default: storage }, 'react-native': { AppState: appState }, '@/lib/api': api, '@/lib/session-timing-telemetry-core': core });
actor.setExecutionActor(1);
const first = await telemetry.prepareSessionStartTiming(10);
assert.ok(first.client_event_id);
assert.equal((await telemetry.prepareSessionStartTiming(10)).client_event_id, first.client_event_id);
actor.setExecutionActor(2);
await telemetry.initializeSessionTimingTelemetry();
assert.equal(telemetry.createLifecycleTimingEvent(10, 'session_completed'), null, 'actor B cannot finish actor A telemetry');
await telemetry.prepareSessionStartTiming(20);
actor.setExecutionActor(1);
await telemetry.initializeSessionTimingTelemetry();
assert.equal((await telemetry.prepareSessionStartTiming(10)).client_event_id, first.client_event_id, 'returning actor restores its own receipt');
assert.ok(memory.has('strength-ledger:session-timing:v3:1'));
assert.ok(memory.has('strength-ledger:session-timing:v3:2'));

let release;
delayWrite = key => key.endsWith(':1') ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
const interrupted = telemetry.prepareSessionStartTiming(30);
while (!release) await new Promise(resolve => setTimeout(resolve, 0));
actor.setExecutionActor(2);
await telemetry.initializeSessionTimingTelemetry();
release(); delayWrite = null;
await assert.rejects(interrupted, /ownership changed/);
assert.equal(telemetry.createLifecycleTimingEvent(30, 'session_completed'), null);
assert.ok(telemetry.createLifecycleTimingEvent(20, 'session_completed'));

const queueKey = 'strength-ledger.video-upload-queue.v1';
memory.set(queueKey, JSON.stringify([
  { id: 'a', ownerUserId: '1', status: 'pending', localFileUri: 'file:a' },
  { id: 'b', ownerUserId: '2', status: 'uploaded', localFileUri: 'file:b' },
  { id: 'legacy', status: 'pending', localFileUri: 'file:legacy' },
]));
const deleted = [];
const queue = moduleFrom('lib/videoUploadQueue.ts', { '@/lib/execution-actor': actor, '@react-native-async-storage/async-storage': { default: storage }, 'expo-file-system/legacy': { deleteAsync: async uri => deleted.push(uri) }, 'react-native': { AppState: appState, Platform: { OS: 'ios' } }, '@/lib/api': api, '@/lib/updateSafety': { setUpdateBlocker() {} } });
assert.equal((await queue.getVideoUploadJobs()).map(job => job.id).join(','), 'b');
await queue.cancelVideoUploadJob('a');
await queue.retryVideoUploadJob('a');
assert.equal(JSON.parse(memory.get(queueKey)).find(job => job.id === 'a').status, 'pending');
assert.deepEqual(deleted, []);
assert.equal(calls.length, 0, 'another owner and legacy unowned jobs never dispatch');
actor.setExecutionActor(null);
assert.equal((await queue.getVideoUploadJobs()).length, 0);
console.log('Session execution ownership: timer restart, stable receipt, interrupted owner handoff, queue visibility/retry/cancel PASS');
