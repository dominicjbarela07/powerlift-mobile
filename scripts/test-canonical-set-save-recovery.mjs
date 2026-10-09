import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { ApiRequestError } from '../lib/api-request-policy.ts';
import { recoverCanonicalSetSave } from '../lib/canonical-set-save-recovery.ts';
import { createCanonicalSetSubmissionController, createCanonicalSetResultGate } from '../lib/logger-feedback.ts';

const sourceFlag = process.argv.indexOf('--source');
const logger = fs.readFileSync(sourceFlag < 0 ? 'app/(tabs)/workout/[workoutId].tsx' : process.argv[sourceFlag + 1], 'utf8');
function extract(source, names) {
  const ast = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) found.push(`const ${node.getText(ast)};`);
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.push(node.getText(ast).replace(/^export /, ''));
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.equal(found.length, names.length);
  return ts.transpileModule(found.join('\n') + '\n({' + names.join(',') + '});', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
}
const shippingHandler = extract(logger, ['submitCanonicalSet']);
const shippingTransport = extract(fs.readFileSync('lib/api.ts', 'utf8'), ['fetchJson', 'createRequestId', 'diagnosticPath', 'mobileAppVersionHeaders']);
const failure = kind => new ApiRequestError({ kind, method: 'POST', path: '/workouts/mobile/8/items/12/log_acc',
  message: kind === 'network' ? 'The request could not reach Strength Ledger.' : kind,
  importance: 'critical-mutation', requestId: 'controlled-failure', elapsedMs: 10 });

// Execute the shipping fetchJson AND the shipping Session submit handler. Only
// native fetch and storage boundaries are substituted to inject a dropped link.
for (const endpoint of ['log_acc', 'log_straight', 'log_top', 'log_bk', 'log_fc']) {
  for (const drop of ['before-write', 'after-write']) {
    const rows = new Map(), calls = [], banners = [], waits = [], feedback = [];
    let started = 0, accepted = 0, failed = 0, recovery = 0;
    const payload = Object.freeze({ actual_weight_kg: 77.1107029, actual_reps: 10, actual_rir: 0,
      intended_set_index: 3, client_submission_id: `durable-${endpoint}-${drop}`, timing: { client_event_id: 'original-timing' } });
    const apiCtx = { __DEV__: false, API_BASE: 'https://qa.invalid', FETCH_TIMEOUT_MS: 15000, requestSequence: 0,
      SecureStore: { getItemAsync: async key => key === 'auth_token' ? 'isolated-test-token' : null },
      AsyncStorage: { getItem: async () => 'athlete' }, Constants: { expoConfig: { version: '2.1.0' } }, Platform: { OS: 'ios' },
      ApiRequestError, FormData, Blob, ArrayBuffer, AbortController, URL, Date, setTimeout, clearTimeout,
      getResolvedTimezone: async () => 'UTC', normalizeSessionMovementResponse: value => value,
      filterRetiredMovementLibraryResponse: (_path, value) => value, isAccountStateBlockedPayload: () => false,
      evidenceReadCache: { invalidate() {} }, invalidateEvidenceReads() {}, console: { warn() {}, log() {} },
      fetch: async (_url, init) => {
        const body = JSON.parse(init.body); calls.push({ body, headers: init.headers });
        if (calls.length === 1 && drop === 'before-write') throw new TypeError('Network request failed');
        const replayed = rows.has(body.client_submission_id);
        if (!replayed) rows.set(body.client_submission_id, { id: 21, item_id: 12, ...body });
        if (calls.length === 1 && drop === 'after-write') throw new TypeError('Network request failed');
        return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, created: !replayed, replayed,
          set: rows.get(body.client_submission_id), client_submission_id: body.client_submission_id, recognition_events: [] }) };
      },
    };
    const api = vm.runInNewContext(shippingTransport, apiCtx);
    const resultGate = createCanonicalSetResultGate();
    const ctx = { useCallback: callback => callback, executionScope: 'actor:1:session:8',
      screenMountedRef: { current: true },
      executionScopeRef: { current: 'actor:1:session:8' }, canonicalSetSubmissionControllerRef: { current: createCanonicalSetSubmissionController() },
      beginFeedbackSubmission() { started += 1; }, setSavingItemId() {}, setError(message) { if (message) banners.push(message); },
      consumeSetResultOnce: (_key, id, json) => resultGate.consume(8, id, json),
      handleCanonicalSetFeedback(json) { accepted += 1; feedback.push(json); },
      handleCanonicalSetFailure() { failed += 1; }, criticalMutationFailureMessage: error => error.message,
      feedbackAnalytics(name) { if (name === 'set_save_transport_recovery') recovery += 1; },
      recoverCanonicalSetSave: args => recoverCanonicalSetSave({ ...args, wait: async ms => { waits.push(ms); } }), console: { log() {} },
    };
    const { submitCanonicalSet } = vm.runInNewContext(shippingHandler, ctx);
    const response = await submitCanonicalSet({ itemId: 12, attemptKey: 'acc:12:3', clientSubmissionId: payload.client_submission_id,
      fallbackError: 'Set save failed', request: async () => {
        const result = await api.fetchJson(`/workouts/mobile/8/items/12/${endpoint}`, { method: 'POST', body: payload, auth: true });
        if (!result.ok || !result.json?.ok) throw new Error('Rejected save');
        return result.json;
      } });
    assert.ok(response?.ok, `${endpoint}/${drop}: one tap must reach accepted Set truth`);
    assert.equal(calls.length, 2); assert.equal(rows.size, 1, 'ambiguous recovery must not create another Set');
    assert.deepEqual(calls[0].body, calls[1].body, 'same submission, weight, reps, RIR, index and timing');
    assert.equal(calls[0].headers.Authorization, calls[1].headers.Authorization);
    assert.equal(started, 1); assert.equal(accepted, 1); assert.equal(failed, 0); assert.equal(recovery, 1);
    assert.deepEqual(banners, []); assert.deepEqual(waits, [300]);
    assert.equal(response.replayed, drop === 'after-write');
    assert.equal(feedback.filter(row => row.created).length, drop === 'after-write' ? 0 : 1, 'a replay cannot create duplicate recognition');
  }
}

for (const kind of ['cancelled', 'http', 'malformed-response']) {
  let calls = 0;
  await assert.rejects(recoverCanonicalSetSave({ clientSubmissionId: 'durable', assertOwner() {},
    wait: async () => assert.fail('not recoverable'), request: async () => { calls += 1; throw failure(kind); } }));
  assert.equal(calls, 1, 'permissions, conflicts, malformed data and cancellations are never retried');
}
for (const kind of ['network', 'timeout']) {
  let calls = 0; const waits = [];
  await assert.rejects(recoverCanonicalSetSave({ clientSubmissionId: 'durable', assertOwner() {},
    wait: async ms => waits.push(ms), request: async () => { calls += 1; throw failure(kind); } }));
  assert.equal(calls, 3); assert.deepEqual(waits, [300, 900], 'recovery is bounded; real failure remains visible');
}
let owner = 'original', calls = 0;
await assert.rejects(recoverCanonicalSetSave({ clientSubmissionId: 'durable',
  assertOwner() { if (owner !== 'original') throw new Error('Session ownership changed.'); },
  wait: async () => { owner = 'different'; }, request: async () => { calls += 1; throw failure('network'); } }), /ownership changed/);
assert.equal(calls, 1, 'ownership change must prevent a second write');
await assert.rejects(recoverCanonicalSetSave({ clientSubmissionId: '', assertOwner() {}, request: async () => assert.fail('unsafe write') }), /durable/);

// During automatic recovery the original controller lock still prevents a
// second tap and releases precisely once, even after two dropped connections.
const controller = createCanonicalSetSubmissionController();
let release; const pause = new Promise(resolve => { release = resolve; }); let attempts = 0, accepted = 0;
const save = controller.run({ onStarted() {}, onFailure: assert.fail, onAccepted: result => { accepted += 1; return result; },
  request: () => recoverCanonicalSetSave({ clientSubmissionId: 'locked-durable', assertOwner() {}, wait: async () => pause,
    request: async () => { attempts += 1; if (attempts < 3) throw failure('network'); return { ok: true }; } }) });
const duplicate = await controller.run({ onStarted: assert.fail, onFailure: assert.fail, request: async () => assert.fail('double tap') });
assert.equal(duplicate.status, 'ignored_in_flight'); release();
assert.equal((await save).status, 'accepted'); assert.equal(accepted, 1); assert.equal(attempts, 3); assert.equal(controller.isInFlight(), false);

assert.equal((logger.match(/await submitCanonicalSet\(/g) || []).length, 6, 'Core, accessory and sequential group writes use the same recovery boundary');
console.log('Canonical Set save recovery: PASS — actual shipping handler/transport, all Set types, dropped request/acknowledgement, one write/acceptance, stable payload, bounded outage, cancellation, ownership and double-tap safety');
