import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { ApiRequestError, isApiRequestError } from '../lib/api-request-policy.ts';
import { applyConfirmedSetEdit, recoverSetEdit } from '../lib/set-edit-recovery.ts';

const flag = process.argv.indexOf('--source');
const source = fs.readFileSync(flag < 0 ? 'app/(tabs)/workout/[workoutId].tsx' : process.argv[flag + 1], 'utf8');
function handlerCode(text) {
  const ast = ts.createSourceFile('logger.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'saveEditedSet') declaration = `const ${node.getText(ast)};`;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(declaration);
  return ts.transpileModule(declaration + '\n({saveEditedSet});', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const network = () => new ApiRequestError({ kind: 'network', method: 'POST', path: '/edit_set', importance: 'critical-mutation', requestId: 'qa-edit', elapsedMs: 10, message: 'Dropped connection' });
function harness(text = source) {
  const state = { posts: [], reads: [], writes: 0, errors: [], events: [], notices: [], submitting: false, visible: true, refreshes: [] };
  let row = { id: 93, set_index: 2, actual_weight_kg: 20, actual_reps: 10, actual_rir: 0, actual_rpe: null, source_revision: 1, performed_movement_definition_id: 7 };
  const refresh = deferred();
  const ctx = {
    workoutId: '8', API_BASE: 'https://qa.invalid', unit: 'kg', KG_PER_LB: .45359237,
    isIdealWorkoutDetailPreview: false,
    editSetCtx: { itemId: 12, setLogId: 93, setIndex: 2, mode: 'rir', evidenceRevision: 4 },
    editSetForm: { weight: '25', reps: '10', rir: '0', rpe: '' },
    data: { workout: { id: 8, core_items: [], accessory_groups: [{ items: [{ id: 12, variant: 'ACC', evidence_revision: 4, set_logs: [{ ...row }] }] }] } },
    executionScope: 'actor:1:session:8', executionScopeRef: { current: 'actor:1:session:8' },
    screenMountedRef: { current: true }, editSetInFlightRef: { current: false },
    setEditSetSubmitting: v => { state.submitting = v; }, setSavingItemId() {},
    setError: v => { if (v) state.errors.push(v); else state.errors.length = 0; }, setEditSetVisible: v => { state.visible = v; },
    setEditSetCtx: v => { ctx.editSetCtx = v; }, setData: fn => { ctx.data = fn(ctx.data); },
    feedbackDispatch: e => state.events.push(e), feedbackAnalytics() {},
    invalidateRecognitionForSet: async () => {}, invalidateRecognitionEvents: async () => {},
    rememberScroll() {}, showSetMutationNotice: v => state.notices.push(v),
    fetchWorkout: async opts => { state.refreshes.push(opts); await refresh.promise; return true; },
    applyConfirmedSetEdit, recoverSetEdit: args => recoverSetEdit({ ...args, wait: async () => {} }),
    isApiRequestError,
    roundToNearestGymIncrementLb: n => Math.round(n / 2.5) * 2.5,
    fetchJson: async (url, options) => {
      if (options.method === 'GET') {
        state.reads.push({ url, options });
        if (state.readFailure) throw network();
        const current = { id: 12, evidence_revision: state.revision ?? 4, set_logs: [{ ...row }] };
        return { ok: true, status: 200, json: { ok: true, workout: { id: 8, core_items: [], accessory_groups: [{ items: [current] }] } } };
      }
      state.posts.push(options.body);
      if (state.pending) return state.pending.promise;
      if (state.denied) return { ok: false, status: state.denied, json: { ok: false, error: 'Edit rejected' } };
      if (state.failAfterFirst && state.posts.length > 1) throw network();
      if (state.drop === 'before' && state.posts.length === 1) throw network();
      const changed = ['actual_weight_kg', 'actual_reps', 'actual_rpe', 'actual_rir'].some(key => row[key] !== options.body[key]);
      if (changed) { row = { ...row, ...options.body, source_revision: 2 }; state.revision = 5; state.writes += 1; }
      if (state.drop === 'after' && state.posts.length === 1) throw network();
      return { ok: true, status: 200, json: { ok: true, changed, item_evidence_revision: 5,
        set: { ...row, id: state.wrongSet ? 94 : row.id }, invalidated_recognition_event_ids: [41] } };
    }, console: { log() {} },
  };
  return { state, ctx, refresh, save: vm.runInNewContext(handlerCode(text), ctx).saveEditedSet };
}
async function promptlySaved(h) {
  let timeout;
  try {
    await Promise.race([h.save(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('confirmed edit remained blocked on Session reload')), 100); })]);
  } finally { clearTimeout(timeout); }
  assert.equal(h.state.submitting, false); assert.equal(h.state.visible, false);
  assert.equal(h.state.notices.length, 1); assert.deepEqual(h.state.errors, []);
  assert.equal(h.ctx.data.workout.accessory_groups[0].items[0].set_logs[0].actual_weight_kg, 25);
  assert.equal(h.ctx.data.workout.accessory_groups[0].items[0].set_logs[0].performed_movement_definition_id, 7);
  assert.equal(h.ctx.data.workout.accessory_groups[0].items[0].evidence_revision, 5);
  assert.equal(h.state.refreshes[0].silent, true); assert.equal(h.state.refreshes[0].reason, 'post_set');
}

let h = harness(); await promptlySaved(h);
assert.equal(h.state.posts[0].set_log_id, 93); assert.equal(h.state.posts[0].expected_evidence_revision, 4);
assert.ok(h.state.events.some(e => e.type === 'SET_EDITED' && e.sourceSetLogId === 93));
assert.ok(h.state.events.some(e => e.type === 'INVALIDATE_EVENTS' && e.eventIds.includes(41)));

for (const drop of ['before', 'after']) {
  h = harness(); h.state.drop = drop; await promptlySaved(h);
  assert.equal(h.state.posts.length, 2); assert.equal(h.state.writes, 1, 'lost acknowledgements never duplicate an edit');
  assert.deepEqual(h.state.posts[0], h.state.posts[1], 'safe replay keeps the original payload and CAS revision');
  assert.ok(h.state.events.some(e => e.type === 'INVALIDATE_EVENTS' && e.eventIds.includes(41)), 'replayed acknowledgement must still retire dependent recognition');
}

for (const status of [401, 403, 409, 500]) {
  h = harness(); h.state.denied = status; await h.save();
  assert.equal(h.state.visible, true); assert.equal(h.state.submitting, false);
  assert.equal(h.state.notices.length, 0); assert.equal(h.state.posts.length, 1);
  assert.equal(h.state.reads.length, 0, 'permission/conflict/server rejection is never replayed');
}
h = harness(); h.state.wrongSet = true; await h.save();
assert.equal(h.state.visible, true); assert.equal(h.state.notices.length, 0, 'a mismatched acknowledgement is not success');

h = harness(); h.ctx.editSetCtx.evidenceRevision = null; h.state.drop = 'before'; await h.save();
assert.equal(h.state.posts.length, 1, 'without a known CAS revision a failed request cannot be blindly resent');
assert.equal(h.state.visible, true); assert.equal(h.state.submitting, false);

h = harness(); h.state.drop = 'after'; h.state.failAfterFirst = true; await h.save();
assert.equal(h.state.visible, true); assert.equal(h.state.submitting, false); assert.ok(h.ctx.editSetCtx);
h.state.failAfterFirst = false; await promptlySaved(h);
assert.equal(h.state.posts.length, 4); assert.equal(h.state.writes, 1, 'manual retry acknowledges the already-saved edit without duplicating it');

h = harness(); h.state.pending = deferred();
const pending = h.save(); await h.save(); assert.equal(h.state.posts.length, 1, 'same-frame double tap must remain one mutation');
h.ctx.executionScopeRef.current = 'actor:2:session:9'; h.state.pending.resolve({ ok: true, json: { ok: true, set: { id: 93 } } }); await pending;
assert.equal(h.state.notices.length, 0); assert.equal(h.state.events.length, 0, 'a departed Session cannot publish edit feedback');

const broken = source.replace("void fetchWorkout({ silent: true, reason: 'post_set' });", "await fetchWorkout({ silent: true, reason: 'post_set' });");
assert.notEqual(broken, source, 'failure control must restore the real blocking reload');
await assert.rejects(() => promptlySaved(harness(broken)), /blocked on Session reload/);
console.log('PASS actual Set edit: immediate confirmed completion, fresh revision/identity, background reload, before/after-write drops, safe CAS replay with dependent recognition invalidation, bounded outage/manual retry, retained draft, permission/conflict/malformed rejection, ownership and double taps; blocking-reload failure rejected.');
