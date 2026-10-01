import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHotSwapSubmissionGate, executeActiveSessionHotSwap, HotSwapError } from '../lib/active-session-hot-swap.ts';

const X = 177;
const Y = 165;
const Z = 181;
const prescription = { sets: 3, repsText: '10-12', rir: 2 };
const makeServer = ({ initial = X, lostResponse = false, networkDown = false } = {}) => {
  let current = initial;
  let writes = 0;
  const calls = [];
  const item = () => ({ id: 7, movement_definition_id: current, performed_sets: 3,
    performed_reps_text: '10-12', performed_rir_target: 2, set_logs: [] });
  const request = async (path, options) => {
    calls.push({ path, ...options });
    if (options.method === 'GET') return { ok: true, status: 200, json: {
      ok: true, workout: { id: 4, accessory_groups: [{ items: [item()] }] },
    } };
    if (networkDown) throw new Error('offline');
    if (options.body.expected_movement_definition_id !== current) return {
      ok: false, status: 409, json: { ok: false, code: 'stale_movement_identity' },
    };
    writes += 1;
    current = options.body.movement_definition_id;
    if (lostResponse) throw new Error('lost after commit');
    return { ok: true, status: 200, json: { ok: true, item: item() } };
  };
  return { request, calls, get current() { return current; }, get writes() { return writes; } };
};
const args = request => ({ sessionId: 4, itemId: 7, openedMovementId: X, replacementId: Y,
  replacementName: 'Bent Over Barbell Row', prescription, request });

const normal = makeServer();
const saved = await executeActiveSessionHotSwap(args(normal.request));
assert.equal(normal.writes, 1);
assert.equal(normal.current, Y);
assert.equal(saved.item.movement_definition_id, Y);
assert.equal(saved.session.workout.accessory_groups[0].items[0].movement_definition_id, X);
assert.equal(normal.calls[1].body.expected_movement_definition_id, X);
assert.equal(normal.calls[1].body.movement_definition_id, Y);
const reloaded = await normal.request('/workouts/mobile/4?history=summary', { method: 'GET' });
assert.equal(reloaded.json.workout.accessory_groups[0].items[0].movement_definition_id, Y);

const doubleTap = makeServer();
const gate = createHotSwapSubmissionGate();
const confirm = async () => {
  if (!gate.begin()) return null;
  try { return await executeActiveSessionHotSwap(args(doubleTap.request)); }
  finally { gate.end(); }
};
const [firstTap, secondTap] = await Promise.all([confirm(), confirm()]);
assert.equal(firstTap.item.movement_definition_id, Y);
assert.equal(secondTap, null);
assert.equal(doubleTap.writes, 1);

const already = makeServer({ initial: Y });
assert.equal((await executeActiveSessionHotSwap(args(already.request))).alreadyApplied, true);
assert.equal(already.writes, 0);

const sameMovement = makeServer({ initial: X });
assert.equal((await executeActiveSessionHotSwap({ ...args(sameMovement.request), replacementId: X,
  replacementName: 'Seated Cable Row' })).alreadyApplied, true);
assert.equal(sameMovement.writes, 0);
assert.equal(sameMovement.current, X);

const independent = makeServer({ initial: Z });
await assert.rejects(executeActiveSessionHotSwap(args(independent.request)), error =>
  error instanceof HotSwapError && error.code === 'independent_change');
assert.equal(independent.writes, 0);

// A same-client accepted write whose response was lost is recovered from the
// authoritative reload. Retrying does not create a second mutation.
const lost = makeServer({ lostResponse: true });
assert.equal((await executeActiveSessionHotSwap(args(lost.request))).alreadyApplied, true);
assert.equal(lost.writes, 1);
assert.equal(lost.current, Y);

const offline = makeServer({ networkDown: true });
await assert.rejects(executeActiveSessionHotSwap(args(offline.request)), error =>
  error instanceof HotSwapError && error.code === 'network_retry');
assert.equal(offline.current, X);
assert.equal(offline.writes, 0);
offline.request = makeServer().request;
assert.equal((await executeActiveSessionHotSwap(args(offline.request))).item.movement_definition_id, Y);

const logger = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');
const sheet = fs.readFileSync('components/workout-logger/substitution-confirmation-sheet.tsx', 'utf8');
assert.match(logger, /if \(!workoutId \|\| !swapAccItem \|\| hotSwapGateRef\.current\.isWorking\(\)\) return/);
assert.match(logger, /hotSwapGateRef\.current\.begin\(\)[\s\S]*executeActiveSessionHotSwap/);
assert.match(logger, /dataRef\.current = projectSavedItem\(authoritativeSession\)[\s\S]*setData\(dataRef\.current\)/);
assert.match(logger, /workoutRequestManagerRef\.current\.cancel\(\)/);
assert.match(logger, /<SubstitutionConfirmationSheet[\s\S]*error=\{swapError\}/);
assert.match(sheet, /accessibilityRole="alert"/);
assert.match(sheet, /disabled=\{saving\} onPress=\{onConfirm\}/);
console.log('PASS active Session Hot Swap: canonical preflight, X→Y, reload, no-op, independent conflict, lost response, retry, visible error, and duplicate-submit guard');
