import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, imports) {
  const exports = {};
  let source = fs.readFileSync(file, 'utf8');
  if (file === 'lib/videoUploadQueue.ts' && process.env.VIDEO_ENGINE_TEST_MUTATION === 'remove-queue-serialization') {
    assert.ok(source.includes('mutationTail.then(async () => {'), 'explicit queue guard target exists');
    source = source.replace('mutationTail.then(async () => {', 'Promise.resolve().then(async () => {');
  }
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; },
    Date, Math, Map, Set, Promise, console, setInterval: () => 0, clearInterval() {}, clearTimeout() {},
    setTimeout: (fn, ms) => { if ([350, 700, 1050].includes(ms)) queueMicrotask(fn); return 0; },
  }, { filename: file });
  return exports;
}
const size = 256 * 1024, partSize = size / 2;
const video = { id: 8, set_log_id: 77, upload_status: 'uploaded' };
const fixtureJob = { id: 'intent-one', ownerUserId: '1', status: 'pending', setLogId: 77,
  localFileUri: 'file:/queue/video-upload-queue/original.mp4', filename: 'clip.mp4', mimeType: 'video/mp4',
  fileSizeBytes: size, retryCount: 0, createdAt: '2026-10-22', updatedAt: '2026-10-22' };
function fixture({ initial = [fixtureJob], api, transfer, actorOverride, rawOverride } = {}) {
  let jobs = structuredClone(initial), owner = '1', raw = rawOverride;
  const calls = [], uploads = [], deleted = [], writes = [], actorListeners = [];
  const actor = actorOverride || { currentExecutionActor: () => owner, executionActorOwns: id => id === owner,
    subscribeExecutionActor: fn => { actorListeners.push(fn); } };
  const storage = { getItem: async () => raw === undefined ? JSON.stringify(jobs) : raw,
    setItem: async (_key, value) => { writes.push(value); jobs = JSON.parse(value); } };
  const filesystem = { documentDirectory: 'file:/queue/', EncodingType: { Base64: 'base64' },
    FileSystemUploadType: { BINARY_CONTENT: 0 }, FileSystemSessionType: { BACKGROUND: 0 },
    getInfoAsync: async () => ({ exists: true, size }), copyAsync: async () => {},
    readAsStringAsync: async () => 'AAAA', writeAsStringAsync: async () => {},
    deleteAsync: async uri => { deleted.push(uri); },
    createUploadTask: (url, file, options, progress) => ({
      uploadAsync: async () => { const call = { url, file, options }; uploads.push(call); progress({ totalBytesSent: partSize });
        return transfer ? transfer(call) : { status: 200 }; },
      cancelAsync: async () => {},
    }) };
  const confirmed = load('lib/set-video-upload-status.ts', {});
  const queue = load('lib/videoUploadQueue.ts', {
    '@/lib/execution-actor': actor, '@react-native-async-storage/async-storage': { default: storage },
    'expo-file-system/legacy': filesystem,
    'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) } },
    '@/lib/api': { API_BASE: 'http://local.test', fetchJson: async (path, opts) => { calls.push({ path, opts }); return api(path, opts); } },
    '@/lib/updateSafety': { setUpdateBlocker() {} }, '@/lib/set-video-upload-status': confirmed,
  });
  return { queue, jobs: () => jobs, calls, uploads, deleted, writes,
    switchActor: id => { owner = id; actorListeners.forEach(fn => fn()); } };
}
const grant = path => ({ ok: true, status: 200, json: { ok: true, url: 'https://r2.test/' + path.split('/').at(-1), headers: {} } });
const ready = parts => ({ ok: true, status: 200, json: { ok: true, upload: { id: 'u1', status: 'uploading',
  part_size: partSize, total_parts: 2, completed_parts: parts.map(index => ({ index, size: partSize })) } } });
async function settle(fn) { for (let i = 0; i < 200 && !fn(); i++) await new Promise(setImmediate); assert.ok(fn(), 'asynchronous queue settled'); }

let reads = 0;
const racing = fixture({ initial: [], actorOverride: { currentExecutionActor: () => ++reads <= 2 ? '1' : null,
  executionActorOwns: () => true, subscribeExecutionActor() {} } });
await Promise.all([77,78].map(setLogId => racing.queue.enqueueVideoUpload({ localFileUri: 'file:/selected', filename: 'clip.mp4', mimeType: 'video/mp4', setLogId })));
assert.equal(racing.jobs().length, 2, 'concurrent queue mutations cannot lose either intent');

let attempt = 0;
const resumable = fixture({ api: async path => {
  if (path.endsWith('/uploads')) return ready(++attempt === 1 ? [] : [0]);
  if (/\/parts\/\d+$/.test(path)) return grant(path);
  if (path.endsWith('/complete')) return { ok: true, status: 202, json: { ok: true, upload: { status: 'processing' } } };
  return { ok: true, status: 200, json: { ok: true, upload: { status: 'completed', video } } };
}, transfer: call => ({ status: attempt === 1 && call.url.endsWith('/1') ? 503 : 200 }) });
await resumable.queue.processVideoUploadQueue();
assert.equal(resumable.jobs()[0].status, 'failed_retryable');
assert.ok(!resumable.deleted.includes(fixtureJob.localFileUri));
await resumable.queue.retryVideoUploadJob('intent-one');
await settle(() => resumable.jobs()[0].phase === 'processing');
assert.equal(resumable.uploads.filter(call => call.url.endsWith('/0')).length, 1, 'acknowledged bytes must not retransmit');
assert.ok(resumable.uploads.every(call => call.options.uploadType === 0 && call.options.sessionType === 0));
await resumable.queue.retryVideoUploadJob('intent-one');
await settle(() => resumable.jobs()[0].status === 'uploaded');
assert.equal(resumable.jobs()[0].serverAttachmentId, 8);
assert.ok(resumable.deleted.includes(fixtureJob.localFileUri), 'source retained until exact attachment receipt');
assert.ok(resumable.calls.every(call => !String(call.opts.body).includes('data_base64')), 'binary video transport has no network base64 body');

let cloudAttempts = 0;
const expiredGrant = fixture({ api: async path => {
  if (path.endsWith('/uploads')) return ready([]);
  if (/\/parts\/\d+$/.test(path)) return grant(path);
  if (path.endsWith('/complete')) return { ok: true, status: 200, json: { ok: true, video } };
  throw Error('unexpected request');
}, transfer: () => ({ status: ++cloudAttempts === 1 ? 403 : 200 }) });
await expiredGrant.queue.processVideoUploadQueue();
assert.equal(expiredGrant.jobs()[0].status, 'failed_retryable', 'expired cloud capability must obtain a fresh authorized grant');
await expiredGrant.queue.retryVideoUploadJob('intent-one');
await settle(() => expiredGrant.jobs()[0].status === 'uploaded');
assert.equal(expiredGrant.calls.filter(call => call.path.endsWith('/parts/0')).length, 2);
const revokedApi = fixture({ api: async () => ({ ok: false, status: 403, json: { error: 'Access revoked' } }) });
await revokedApi.queue.processVideoUploadQueue();
assert.equal(revokedApi.jobs()[0].status, 'failed_permanent', 'actor API revocation must never become a cloud-expiry retry');

let releaseComplete, reachedComplete;
const completeReached = new Promise(resolve => { reachedComplete = resolve; });
const cancelled = fixture({ api: async path => {
  if (path.endsWith('/uploads')) return ready([0,1]);
  if (path.endsWith('/complete')) { reachedComplete(); return new Promise(resolve => { releaseComplete = resolve; }); }
  if (path.endsWith('/cancel')) return { ok: true, json: { ok: true, upload: { status: 'cancelled' } } };
  throw Error('unexpected request');
} });
const pending = cancelled.queue.processVideoUploadQueue();
await completeReached;
await cancelled.queue.cancelVideoUploadJob('intent-one');
releaseComplete({ ok: true, status: 202, json: { ok: true, upload: { status: 'processing' } } });
await pending;
assert.equal(cancelled.jobs()[0].status, 'cancelled', 'late progress cannot resurrect acknowledged cancellation');

const lateCancel = fixture({ initial: [{ ...fixtureJob, uploadSessionId: 'u1', phase: 'processing', status: 'failed_retryable' }],
  api: async () => ({ ok: true, json: { ok: true, upload: { status: 'completed', video } } }) });
await lateCancel.queue.cancelVideoUploadJob('intent-one');
assert.equal(lateCancel.jobs()[0].status, 'uploaded', 'completed server receipt wins a late cancellation truthfully');

const corrupt = fixture({ rawOverride: '{broken' });
await assert.rejects(corrupt.queue.getVideoUploadJobs());
assert.equal(corrupt.writes.length, 0, 'unreadable queue cannot be silently overwritten as empty');

const switched = fixture({ api: async path => {
  if (path.endsWith('/uploads')) return ready([]);
  if (/\/parts\/\d+$/.test(path)) return grant(path);
  throw Error('old owner must not finalize');
}, transfer: () => { switched.switchActor('2'); return { status: 200 }; } });
await switched.queue.processVideoUploadQueue();
assert.ok(!switched.calls.some(call => call.path.endsWith('/complete')));
assert.ok(!switched.deleted.includes(fixtureJob.localFileUri));
assert.equal((await switched.queue.getVideoUploadJobs()).length, 0, 'account switch hides the old queue');
console.log('PASS: transactional persistence, actual negotiated binary/background options, acknowledged resume, durable processing/receipt, cancel/complete race, corruption preservation and account isolation.');
