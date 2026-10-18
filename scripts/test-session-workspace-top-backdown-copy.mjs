import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { model, plain } from './helpers/session-authoring-model.mjs';

const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/session-programmed-set-count.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: module.exports, module });
const count = draft => draft.coreOrder.reduce((n, id) => n + module.exports.programmedSetCountForDraft(draft.movements[id], 'core'), 0);
const hydrate = coreItems => model.createSessionWorkspaceDraft({ title: 'Copied Session', notes: '', storageUnit: 'kg', coreItems, accessoryItems: [] });
const top = { id: 10, lift: 'SQ', variant: 'TOP', movement: 'Competition Squat', core_movement: { id: 101 }, sets: 1, reps: 1, rpe_target: 8 };
const back = { id: 11, lift: 'SQ', variant: 'BK', movement: top.movement, parent_item_id: 10, sets: 3, reps: 5, rpe_target: 7, coach_prescribed_low_kg: 100, coach_prescribed_high_kg: 110 };
const straight = { ...back, id: 12, variant: 'STRAIGHT', parent_item_id: null };
const copied = hydrate([top, back]);
assert.deepEqual(plain(copied.coreOrder), [10], 'a copied Top + linked Backdowns is one module, never an extra Straight module');
assert.equal(count(copied), 4, '1×1 + 3×5 contains four programmed sets, not seven');
assert.equal(copied.movements[10].backdownSets, '3');
assert.equal(copied.movements[10].backdownReps, '5');
assert.equal(copied.movements[10].backdownTargetLowLb, '100');
assert.ok(copied.items[11], 'linked child identity remains in the draft');
assert.equal(model.sessionWorkspaceDraftIsDirty(copied, hydrate([top, back])), false);
let plan = plain(model.buildSessionWorkspaceSavePlan(copied, copied, 'kg'));
assert.deepEqual(plan.movementCreates, []);
assert.deepEqual(plan.movementUpdates, []);
assert.deepEqual(plan.deletedMovementIds, [], 'nesting is never a data deletion');
const edited = model.cloneSessionWorkspaceDraft(copied);
edited.movements[10].backdownReps = '6';
plan = plain(model.buildSessionWorkspaceSavePlan(edited, copied, 'kg'));
assert.equal(plan.movementUpdates.length, 1);
assert.equal(plan.movementUpdates[0].item.id, 10);
assert.equal(plan.movementUpdates[0].patch.backdown_reps, '6');
assert.deepEqual(plan.movementCreates, []);
assert.deepEqual(plan.deletedMovementIds, []);
assert.equal(count(hydrate([top, { ...back, reps: 6 }])), 4, 'save/reload preserves one pair');

const separate = hydrate([top, back, straight]);
assert.deepEqual(plain(separate.coreOrder), [10, 12], 'legitimate independent Straight work of the same lift stays visible');
assert.equal(count(separate), 7);
const reversed = hydrate([back, straight, top]);
assert.deepEqual(plain(reversed.coreOrder), [12, 10], 'parent links, not adjacency or array order, own grouping');
assert.deepEqual(plain(hydrate([{ ...top, id: 20 }, { ...back, id: 21, parent_item_id: 20 }, top, back]).coreOrder), [20, 10]);
assert.deepEqual(plain(hydrate([back]).coreOrder), [11], 'an orphan is not silently hidden');
assert.deepEqual(plain(hydrate([top, { ...back, variant: 'STRAIGHT' }]).coreOrder), [10], 'an explicitly linked historical Straight backdown is still owned by its Top');
assert.deepEqual(plain(hydrate([top, back, { ...back, id: 13 }]).coreOrder), [10, 13], 'additional programmed children are not silently discarded');

const oldJournal = { ...copied, coreOrder: [10, 11] };
assert.deepEqual(plain(model.cloneSessionWorkspaceDraft(oldJournal).coreOrder), [10], 'recovering an older local journal cannot reintroduce the duplicate');
assert.deepEqual(plain(model.reconcileSessionWorkspaceDraft(oldJournal, copied, copied).draft.coreOrder), [10]);
const removed = model.removeSessionDraftMovement(separate, 10);
plan = plain(model.buildSessionWorkspaceSavePlan(removed, separate, 'kg'));
assert.deepEqual(plan.deletedMovementIds, [10], 'server-owned child deletion is triggered by its parent only');
assert.ok(!removed.items[11]);
assert.deepEqual(plain(removed.coreOrder), [12]);
console.log('PASS: Top/Backdown copy hydration, exact set totals, edit/save/reload, independent Straight blocks, multiple pairs, order, journal recovery and parent removal');
