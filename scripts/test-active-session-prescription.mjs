import assert from 'node:assert/strict';
import fs from 'node:fs';
import { movementDraftFromItem } from '../lib/coach-session-editor.ts';
import { activePrescriptionPatch, canEditActivePrescription } from '../lib/active-session-prescription.ts';

const original = { id: 21, movement_definition_id: 89, movement: 'Cable Row', lift: 'AX', variant: 'ACC',
  sets: 4, reps_text: '10-12', rir_target: 2, coach_prescribed_low_kg: 20, coach_prescribed_high_kg: 25,
  performed_movement_definition_id: 910, superset_group: 'A', approved_subs: ['Other'],
  set_logs: [{ id: 44, set_index: 1, actual_weight_kg: 20, actual_reps: 10 }], movement_history: { exact: true } };
const snapshot = structuredClone(original);
const draft = movementDraftFromItem(original, 'kg');
draft.sets = '2'; draft.repsText = '8-10'; draft.rir = '1';
const patch = activePrescriptionPatch(draft, 'accessory', 'kg');
assert.equal(patch.sets, '2'); assert.equal(patch.reps_text, '8-10'); assert.equal(patch.rir_target, '1');
assert.ok(Math.abs(Number(patch.target_low_lb) * .45359237 - 20) < .003);
const changedOnly = activePrescriptionPatch(draft, 'accessory', 'kg', movementDraftFromItem(original, 'kg'));
assert.deepEqual(changedOnly, { sets: '2', reps_text: '8-10', rir_target: '1' }, 'unchanged loads retain their exact persisted value');
for (const key of ['movement', 'movement_definition_id', 'performed_movement_definition_id', 'superset_group', 'approved_subs', 'scheme', 'designation', 'set_logs', 'movement_history']) assert.equal(patch[key], undefined, key);
assert.deepEqual(original, snapshot, 'editing a draft preserves current identity, equipment, history and logged evidence');
for (const variant of ['STRAIGHT', 'TOP', 'BK', 'FULL_CUSTOM', 'VR']) {
  const item = { ...original, lift: variant === 'VR' ? 'VR' : 'SQ', variant, reps: 5, mode: 'RPE', rpe_target: 7,
    planned_sets: [{ set_index: 1, reps: 5, rpe_target: 7, manual_target_kg: 50 }] };
  const body = activePrescriptionPatch(movementDraftFromItem(item, 'lb'), 'core', 'lb');
  assert.equal(body.movement, undefined); assert.equal(body.scheme, undefined); assert.equal(body.designation, undefined);
  assert.ok(Object.keys(body).every(key => !key.startsWith('backdown_')), 'TOP and BK are saved as their existing Session items');
  if (variant === 'FULL_CUSTOM') { assert.equal(body.sets, undefined); assert.equal(body.planned_sets[0].reps, '5'); }
  if (variant === 'VR') assert.equal(body.mode, undefined);
}
assert.equal(canEditActivePrescription(true, true, 'in_progress', false), true);
for (const args of [[undefined, true, 'in_progress', false], [true, false, 'in_progress', false], [true, true, 'completed', false], [true, true, 'in_progress', true]]) assert.equal(canEditActivePrescription(...args), false);
const logger = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');
const editor = fs.readFileSync('components/workout-logger/active-prescription-editor.tsx', 'utf8');
assert.match(logger, /canEditActivePrescription\(data.permissions\?\.can_edit_prescription/);
assert.match(logger, /auxAction=\{prescriptionAction\(movementPresentation.loggerFocus\?\.itemId \|\| core.id\)\}/);
assert.match(logger, /prescriptionAction\(it.id\)/);
assert.match(logger, /onEditPrescription=\{canEditPrescription \? openPrescription/);
assert.match(editor, /MovementQuickPrescriptionEditor prescriptionOnly/);
assert.match(editor, /method: 'PATCH'/); assert.doesNotMatch(editor, /swap|substitute|movement_definition_id/);
console.log('PASS: active prescription semantics, units, identity exclusion, permission, all Logger entry points');
