import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { formatPerformedLoad } from '../lib/performed-load-semantics.ts';

// Execute the shipping editor's handlers, not a second implementation of validation.
const sourceArgument = process.argv.indexOf('--source');
const source = fs.readFileSync(sourceArgument >= 0 ? process.argv[sourceArgument + 1] : 'app/(tabs)/workout/[workoutId].tsx', 'utf8');
const ast = ts.createSourceFile('route.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(['openEditSet', 'saveEditedSet']);
const declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node) && names.has(node.name.getText(ast))) declarations.push(`const ${node.getText(ast)};`);
  if (ts.isFunctionDeclaration(node) && ['buildCoreWeightOptions', 'buildAccessoryWeightOptions', 'buildEditWeightOptions', 'nearestWheelValue', 'formatWheelNumber', 'snapCoreWheelWeight'].includes(node.name?.text)) declarations.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(declarations.length, 8);
const code = ts.transpileModule(declarations.join('\n') + '\n({openEditSet,saveEditedSet,buildEditWeightOptions});', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const KG_PER_LB = 0.45359237;
for (const unit of ['lb', 'kg']) {
  const requests = [], events = [], errors = [];
  let persisted = { id: 93, set_index: 2, actual_weight_kg: 20, actual_reps: 10, actual_rir: 0 };
  let refreshed = null;
  const ctx = {
    workoutId: '8', API_BASE: 'https://qa.invalid', unit, KG_PER_LB,
    MAX_ACCESSORY_LOAD_KG: 350, MAX_ACCESSORY_LOAD_LB: 800,
    isIdealWorkoutDetailPreview: false,
    formatWeight: (kg, toUnit) => String(toUnit === 'kg' ? kg : kg / KG_PER_LB),
    roundToNearestGymIncrementLb: value => Math.round(value / 2.5) * 2.5,
    roundLoggerDisplayWeight: (value, toUnit) => Math.round(value / (toUnit === 'kg' ? 1.25 : 2.5)) * (toUnit === 'kg' ? 1.25 : 2.5),
    setEditSetCtx(value) { ctx.editSetCtx = value; },
    setEditSetForm(value) { ctx.editSetForm = value; },
    setEditSetVisible(value) { ctx.editSetVisible = value; },
    setEditSetSubmitting() {}, setSavingItemId() {},
    setError(value) { if (value) errors.push(value); },
    fetchJson: async (url, options) => {
      requests.push({ url, options });
      persisted = { ...persisted, ...options.body };
      return { ok: true, status: 200, json: { ok: true, invalidated_recognition_event_ids: [41], set: persisted } };
    },
    feedbackDispatch: event => events.push(event), feedbackAnalytics() {},
    invalidateRecognitionForSet: async () => {}, invalidateRecognitionEvents: async () => {},
    rememberScroll() {}, fetchWorkout: async () => { refreshed = { ...persisted }; },
    showSetMutationNotice() {}, console,
  };
  const handlers = vm.runInNewContext(code, ctx);
  // Existing added load -> bodyweight, RIR zero preserved, actual edit HTTP branch used.
  handlers.openEditSet(12, persisted, { mode: 'rir', movementName: 'Push-Up' });
  assert.ok(handlers.buildEditWeightOptions('rir', unit, ctx.editSetForm.weight).includes('0'));
  ctx.editSetForm.weight = '0';
  await handlers.saveEditedSet();
  assert.equal(errors.length, 0);
  assert.equal(requests.length, 1, 'zero must reach the actual canonical edit endpoint');
  assert.match(requests[0].url, /items\/12\/edit_set$/);
  assert.equal(requests[0].options.body.actual_weight_kg, 0);
  assert.equal(requests[0].options.body.actual_rir, 0);
  assert.equal(requests[0].options.body.set_index, 2);
  assert.equal(refreshed.actual_weight_kg, 0);
  assert.equal(refreshed.id, 93, 'edit preserves the same performed set');
  assert.ok(events.some(event => event.type === 'SET_EDITED' && event.sourceSetLogId === 93));
  assert.ok(events.some(event => event.type === 'INVALIDATE_EVENTS' && event.eventIds.includes(41)));
  assert.equal(formatPerformedLoad(0, unit, { loadConvention: 'added_bodyweight', measurementType: 'bodyweight_reps' }), 'BW');
  // Reopening and resaving a zero set cannot silently choose a positive default.
  handlers.openEditSet(12, refreshed, { mode: 'rir', movementName: 'Push-Up' });
  assert.equal(ctx.editSetForm.weight, '0');
  await handlers.saveEditedSet();
  assert.equal(requests.at(-1).options.body.actual_weight_kg, 0);
  for (const invalid of ['', '-1', 'NaN', 'Infinity']) {
    handlers.openEditSet(12, persisted, { mode: 'rir', movementName: 'Push-Up' });
    ctx.editSetForm.weight = invalid;
    const before = requests.length;
    await handlers.saveEditedSet();
    assert.equal(requests.length, before, `invalid load ${invalid} must not be written`);
    assert.equal(errors.at(-1), 'Weight required');
  }
  handlers.openEditSet(12, persisted, { mode: 'rir', movementName: 'Push-Up' });
  ctx.editSetForm.weight = '25';
  await handlers.saveEditedSet();
  assert.equal(requests.at(-1).options.body.actual_weight_kg, unit === 'kg' ? 25 : 25 * KG_PER_LB);
}
console.log('Canonical zero-load editor: real open/save handlers, lb/kg, positive -> zero, reload/reopen, same set, RIR zero, recognition invalidation and invalid-load rejection PASS');
