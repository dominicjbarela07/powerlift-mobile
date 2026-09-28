#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { movementDraftFromItem, movementDraftIsDirty, movementProgrammingPatch } from '../lib/coach-session-editor.ts';

const source = fs.readFileSync(new URL('../components/coach-mobile/SessionEditingWorkspace.tsx', import.meta.url), 'utf8');
assert.match(source, /workspaceFocused\s*\/?>|workspaceFocused\s*\n/, 'the canonical Workspace selects the focused Core editor');
assert.match(source, /StrengthLedgerBottomSheetScrollView/, 'focused sheet body owns scrolling');
assert.match(source, /const closeFocus = \(\) => \{[\s\S]*setConfirmDiscard\(true\)/, 'dismissal guards unapplied edits');
assert.match(source, /onRequestClose=\{closeFocus\}/, 'sheet chrome and backdrop use the same discard guard');
assert.match(source, /onChange\(\{ plannedSets: s\.plannedSets \}\)/, 'Full Custom applies the entire ordered Set stack');

const identity = { id: 718, display_name: 'Competition Squat' };
const base = { id: 31, lift: 'SQ', variant: 'STRAIGHT', movement: 'Competition Squat', movement_definition_id: identity.id,
  movement_identity: identity, designation: 'PRIMARY', sets: 3, reps: 5, mode: 'RPE', rpe_target: 7,
  notes: 'Controlled descent', superset_group: 'A', superset_pos: 1 };
const straight = movementDraftFromItem(base);
const straightEdited = { ...straight, reps: '6', rpe: '7.5' };
assert.equal(movementDraftIsDirty(straightEdited, straight), true);
const straightSaved = movementProgrammingPatch(straightEdited, 'core');
assert.equal(straightSaved.reps, '6');
assert.equal(straightSaved.rpe_target, '7.5');
assert.equal(straightSaved.designation, 'PRIMARY');

const top = movementDraftFromItem({ ...base, variant: 'TOP', sets: 1, reps: 3, rpe_target: 8 }, 'lb',
  { id: 32, lift: 'SQ', variant: 'BK', sets: 3, reps: 5, rpe_target: 7 });
assert.equal(top.scheme, 'TOP_BACKDOWN');
const topEdited = { ...top, reps: '2', backdownReps: '6', backdownRpe: '6.5' };
const topSaved = movementProgrammingPatch(topEdited, 'core');
assert.equal(topSaved.reps, '2');
assert.equal(topSaved.backdown_reps, '6');
assert.equal(topSaved.backdown_rpe_target, '6.5');
assert.equal(topSaved.rpe_target, '8', 'Top and Backdown intensity remain independent');

const custom = movementDraftFromItem({ ...base, variant: 'FULL_CUSTOM', planned_sets: [
  { set_index: 1, reps: 5, rpe_target: 7, manual_target_kg: 100, manual_pm_kg: 2.5 },
  { set_index: 2, reps: 3, rpe_target: 8 },
  { set_index: 3, reps: 5, rpe_target: 6.5 },
] });
assert.equal(custom.plannedSets.length, 3);
const moved = [custom.plannedSets[2], custom.plannedSets[0], custom.plannedSets[1]];
const edited = moved.map((row, index) => index === 1 ? { ...row, reps: '4' } : row);
const added = [...edited, { ...edited[2], targetLb: '', rangeLb: '' }];
const removed = added.filter((_, index) => index !== 2);
const customSaved = movementProgrammingPatch({ ...custom, plannedSets: removed }, 'core');
assert.deepEqual(customSaved.planned_sets.map((row) => row.set_index), [1, 2, 3]);
assert.deepEqual(customSaved.planned_sets.map((row) => row.reps), ['5', '4', '3']);
assert.ok(customSaved.planned_sets[1].manual_target_kg > 99, 'manual evidence follows its Set during reorder');
assert.equal(customSaved.planned_sets[0].manual_target_kg, null, 'calculated Set does not gain a manual target');
assert.equal(customSaved.planned_sets[2].manual_target_kg, null, 'added Set starts without an inherited manual target');

const accessory = movementDraftFromItem({ id: 45, lift: 'ACC', variant: 'ACC', movement: 'Cable Row',
  movement_definition_id: 910, movement_identity: { id: 910, display_name: 'Cable Row' }, sets: 3, reps_text: '10-12', rir_target: 2,
  superset_group: 'A', notes: 'Pause at the chest' });
const accessorySaved = movementProgrammingPatch({ ...accessory, sets: '4', repsText: '8-10', rir: '1.5' }, 'accessory');
assert.equal(accessorySaved.reps_text, '8-10');
assert.equal(accessorySaved.sets, '4');
assert.equal(accessorySaved.rir_target, '1.5');
assert.equal(accessorySaved.target_low_lb, '', 'Accessory editor cannot acquire a manual target');
assert.equal(accessorySaved.target_high_lb, '');
assert.equal(base.movement_definition_id, identity.id, 'canonical movement identity is untouched');
assert.equal(custom.notes, base.notes, 'Coach Notes survive deserialization');
assert.equal(accessory.supersetGroup, 'A', 'grouped Set relation survives deserialization');

console.log('[session-workspace-focused-prescriptions] straight, linked blocks, custom Set order, accessory, identity, notes, and staged-sheet guards ok');
