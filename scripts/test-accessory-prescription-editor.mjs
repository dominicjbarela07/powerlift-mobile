#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { movementDraftFromItem, movementDraftIsDirty, movementProgrammingPatch } from '../lib/coach-session-editor.ts';
import {
  accessoryRepDisplayText,
  accessoryRepRangeAfterLowerChange,
  accessoryRepRangeAfterUpperChange,
  accessoryRepTargetFromText,
  accessoryRepTargetMemoryFromTarget,
  accessoryRepTargetText,
  transitionAccessoryRepTarget,
} from '../lib/prescription-wheel-options.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = fs.readFileSync(path.join(root, 'components', 'coach-mobile', 'SessionEditingWorkspace.tsx'), 'utf8');
const wheel = fs.readFileSync(path.join(root, 'components', 'workout-logger', 'logger-wheel-picker.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'lib', 'coach-session-editor.ts'), 'utf8');

assert.deepEqual(accessoryRepTargetFromText('10'), { mode: 'FIXED', fixed: '10' });
assert.deepEqual(accessoryRepTargetFromText('10-12'), { mode: 'RANGE', low: '10', high: '12' });
assert.deepEqual(accessoryRepTargetFromText('12–10'), { mode: 'RANGE', low: '10', high: '12' });
assert.deepEqual(accessoryRepTargetFromText('AMRAP'), { mode: 'AMRAP' });
assert.deepEqual(accessoryRepTargetFromText('amrap'), { mode: 'AMRAP' });
assert.equal(accessoryRepTargetText({ mode: 'FIXED', fixed: '10' }), '10');
assert.equal(accessoryRepTargetText({ mode: 'RANGE', low: '10', high: '12' }), '10-12');
const governedSubstitutionDraft = movementDraftFromItem({
  variant: 'ACC',
  approved_subs: ['Cable Row'],
  approved_sub_identities: [{ movement: 'Cable Row', movement_identity: { id: 42, display_name: 'Cable Row' } }],
});
assert.deepEqual(governedSubstitutionDraft.approvedSubstitutions, [{ movement: 'Cable Row', movementDefinitionId: 42 }]);
assert.equal(movementProgrammingPatch(governedSubstitutionDraft, 'accessory').approved_subs, undefined, 'unchanged substitutions are not rewritten by generic prescription edits');
assert.equal(accessoryRepTargetText({ mode: 'RANGE', low: '10', high: '10' }), '10-10');
assert.equal(accessoryRepTargetText({ mode: 'AMRAP' }), 'AMRAP');
assert.equal(accessoryRepDisplayText('10'), '10');
assert.equal(accessoryRepDisplayText('10-12'), '10–12');
assert.equal(accessoryRepDisplayText('10-10'), '10');
assert.equal(accessoryRepDisplayText('AMRAP'), 'AMRAP');

const fixed = accessoryRepTargetFromText('10');
let memory = accessoryRepTargetMemoryFromTarget(fixed);
let transition = transitionAccessoryRepTarget(fixed, 'RANGE', memory);
assert.deepEqual(transition.target, { mode: 'RANGE', low: '10', high: '10' }, 'Fixed → Range starts with equal bounds');
memory = transition.memory;

const widened = accessoryRepRangeAfterUpperChange('10', '12');
transition = transitionAccessoryRepTarget(widened, 'FIXED', memory);
assert.deepEqual(transition.target, { mode: 'FIXED', fixed: '10' }, 'Range → Fixed uses the lower bound');

memory = accessoryRepTargetMemoryFromTarget({ mode: 'FIXED', fixed: '8' });
transition = transitionAccessoryRepTarget({ mode: 'FIXED', fixed: '8' }, 'AMRAP', memory);
assert.deepEqual(transition.target, { mode: 'AMRAP' });
transition = transitionAccessoryRepTarget(transition.target, 'FIXED', transition.memory);
assert.deepEqual(transition.target, { mode: 'FIXED', fixed: '8' }, 'AMRAP → Fixed restores the prior fixed value');

memory = accessoryRepTargetMemoryFromTarget({ mode: 'RANGE', low: '8', high: '12' });
transition = transitionAccessoryRepTarget({ mode: 'RANGE', low: '8', high: '12' }, 'AMRAP', memory);
transition = transitionAccessoryRepTarget(transition.target, 'RANGE', transition.memory);
assert.deepEqual(transition.target, { mode: 'RANGE', low: '8', high: '12' }, 'AMRAP → Range restores the prior range');

memory = { fixed: null, range: null };
transition = transitionAccessoryRepTarget({ mode: 'AMRAP' }, 'FIXED', memory);
assert.deepEqual(transition.target, { mode: 'FIXED', fixed: '10' }, 'AMRAP without numeric memory uses the nonzero canonical default');
transition = transitionAccessoryRepTarget({ mode: 'AMRAP' }, 'RANGE', memory);
assert.deepEqual(transition.target, { mode: 'RANGE', low: '10', high: '10' }, 'AMRAP without range memory uses the fixed default for both bounds');

assert.deepEqual(accessoryRepRangeAfterLowerChange('13', '12'), { mode: 'RANGE', low: '13', high: '13' }, 'moving the lower bound above upper moves upper to match');
assert.deepEqual(accessoryRepRangeAfterUpperChange('10', '8'), { mode: 'RANGE', low: '8', high: '8' }, 'moving the upper bound below lower moves lower to match');

const persisted = movementDraftFromItem({ lift: 'AX', variant: 'ACC', movement: 'Barbell Row', sets: 3, reps_text: '10', rir_target: 2 });
assert.equal(movementDraftIsDirty(persisted, persisted), false);
for (const changed of [
  { ...persisted, sets: '4' },
  { ...persisted, repsText: '12' },
  { ...persisted, repsText: '10-12' },
  { ...persisted, repsText: 'AMRAP' },
  { ...persisted, rir: '1' },
]) assert.equal(movementDraftIsDirty(changed, persisted), true, 'every Accessory prescription concept participates in dirty state');
assert.equal(movementDraftIsDirty({ ...persisted }, persisted), false, 'discarding back to the persisted draft returns clean');
assert.equal(movementProgrammingPatch({ ...persisted, repsText: 'AMRAP' }, 'accessory').reps_text, 'AMRAP', 'AMRAP round trips through the canonical reps_text contract');

assert.match(workspace, /PrescriptionValueControl accent="sets"[\s\S]*accent="reps"[\s\S]*accent="rir"/, 'the inline editor exposes compact Sets, Reps, and RIR controls instead of permanent wheels');
assert.match(workspace, /type AccessoryPrescriptionPicker = 'sets' \| 'reps' \| 'rir' \| null/, 'one contextual picker state owns the prescription input machinery');
assert.match(workspace, /<StrengthLedgerBottomSheet[\s\S]*heightFraction=[\s\S]*visible=\{picker != null\}/, 'all prescription inputs reuse the shared Strength Ledger bottom sheet');
assert.match(workspace, /const \[setsDraft[\s\S]*const \[rirDraft[\s\S]*const \[repDraft[\s\S]*const apply = \(\) => \{[\s\S]*onChange\(\{ sets: setsDraft \}\)[\s\S]*onChange\(\{ repsText: accessoryRepTargetText\(repDraft\) \}\)[\s\S]*onChange\(\{ rir: rirDraft \}\)/, 'picker state remains local until Apply commits the selected field');
assert.match(workspace, /onDismiss=\{\(\) => setPicker\(null\)\}/, 'dismissal cancels a picker without mutating the Session draft');
assert.match(workspace, /\[\['FIXED', 'Single'\], \['RANGE', 'Range'\], \['AMRAP', 'AMRAP'\]\]/, 'Rep Target exposes canonical Single, Range, and AMRAP modes');
assert.match(workspace, /repDraft\.mode === 'FIXED'[\s\S]*sheet-single-reps[\s\S]*repDraft\.mode === 'RANGE'[\s\S]*sheet-min-reps[\s\S]*sheet-max-reps/, 'Single and Range modes render the correct wheel architecture');
assert.match(workspace, /accessoryRepRangeAfterLowerChange\(low, repDraft\.high\)[\s\S]*accessoryRepRangeAfterUpperChange\(repDraft\.low, high\)/, 'Range draft changes preserve valid minimum and maximum ordering');
assert.match(workspace, /styles\.amrapState[\s\S]*>AMRAP<[\s\S]*RIR remains an independent target/, 'AMRAP uses purpose-specific content rather than a meaningless rep wheel');
assert.match(workspace, /decimalWheelOptions\(0, 10, 0\.5, rirDraft\)/, 'RIR preserves the canonical fractional range');
assert.doesNotMatch(workspace, /Reps Lower|Reps Upper/, 'backend field names are never exposed');
assert.match(workspace, /import \{ LoggerWheelPicker \} from '@\/components\/workout-logger\/logger-wheel-picker'/, 'the editor reuses the canonical Logger wheel');
assert.match(wheel, /accessibilityRole="adjustable"[\s\S]*Haptics\.selectionAsync/, 'canonical wheel accessibility and haptics remain active');
assert.doesNotMatch(workspace, /NumericStepper|Reps Lower|Reps Upper|Accessory.*(?:Percentage|RPE|CalculatedTargetPanel|ManualOverrideBlock)/, 'no rejected Accessory fields or steppers were added');
assert.match(workspace, /function collapsedLoadPresentation\([\s\S]*if \(kind === 'accessory'\) return null/, 'Accessories never render calculated or manual load suggestion badges');
assert.match(workspace, /function movementMeta[\s\S]*primary_muscle_group[\s\S]*secondary_muscle_groups[\s\S]*accessoryMuscleRegion\(item\)\.label/, 'collapsed and expanded movement identity uses governed muscle context');
assert.match(workspace, /function RecentHistorySection[\s\S]*exactAccessoryHistoryRows\(item\.movement_history\)[\s\S]*LAST EXPOSURE[\s\S]*History/, 'Last Exposure remains exact-identity-backed with intentional history access');
assert.match(workspace, /function CoachNotesSection/, 'Coach Notes remain directly in the inline workspace');
assert.doesNotMatch(workspace, /legacyBadge|item\.legacy\?\.indicator/, 'legacy migration provenance is absent from normal movement cards');
assert.match(workspace, /const groups = \['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'\][\s\S]*Grouped with:/, 'inline grouping preserves A–G assignment and truthful group context');
assert.doesNotMatch(workspace, /accessibilityLabel="Approved Substitutions"[\s\S]*multiline/, 'approved substitutions are not anonymous free text');
assert.match(workspace, /chooseApprovedSubstitution[\s\S]*props\.onChangeAccessory[\s\S]*movementDefinitionId[\s\S]*approvedSubstitutions/, 'approved substitutions retain governed movement IDs from the picker');
assert.match(workspace, /patch\.approved_subs = movement\.approvedSubstitutions\.map[\s\S]*movement_definition_id: row\.movementDefinitionId/, 'approved substitutions serialize stable governed identities');
assert.match(editor, /approved_sub_identities[\s\S]*movement_identity[\s\S]*movementDefinitionId/, 'persisted approved substitutions rehydrate from canonical identity payloads');
assert.match(workspace, /automaticallyAdjustKeyboardInsets[\s\S]*keyboardShouldPersistTaps="handled"/, 'the inline workspace remains keyboard safe');
assert.match(workspace, /if \(!success\) \{[\s\S]*return false[\s\S]*setPersistedSession/, 'only successful whole-Session saves clear dirty state');
assert.match(route, /Your Session edits are still available\./, 'failed saves preserve the local Accessory draft');

console.log('[accessory-prescription-editor] ok');
