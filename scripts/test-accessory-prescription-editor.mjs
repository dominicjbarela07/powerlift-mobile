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

assert.deepEqual(accessoryRepTargetFromText('10'), { mode: 'FIXED', fixed: '10' });
assert.deepEqual(accessoryRepTargetFromText('10-12'), { mode: 'RANGE', low: '10', high: '12' });
assert.deepEqual(accessoryRepTargetFromText('12–10'), { mode: 'RANGE', low: '10', high: '12' });
assert.deepEqual(accessoryRepTargetFromText('AMRAP'), { mode: 'AMRAP' });
assert.deepEqual(accessoryRepTargetFromText('amrap'), { mode: 'AMRAP' });
assert.equal(accessoryRepTargetText({ mode: 'FIXED', fixed: '10' }), '10');
assert.equal(accessoryRepTargetText({ mode: 'RANGE', low: '10', high: '12' }), '10-12');
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

assert.match(workspace, /label: 'Fixed'[\s\S]*label: 'Range'[\s\S]*label: 'AMRAP'[\s\S]*label="Rep Target"/, 'Rep Target offers exactly Fixed, Range, and AMRAP');
assert.match(workspace, /target\.mode === 'FIXED'[\s\S]*accessory-fixed-reps[\s\S]*target\.mode === 'RANGE'/, 'Fixed mode renders one Reps wheel');
assert.match(workspace, /target\.mode === 'RANGE'[\s\S]*accessoryRangeCell[\s\S]*Rep Range[\s\S]*grouped columns=\{\[[\s\S]*accessory-range-low[\s\S]*accessory-range-high[\s\S]*accessoryRangeSeparator/, 'Range mode renders one labeled cell containing grouped adjacent bounds');
assert.match(workspace, /accessoryRangeSetsCell[\s\S]*>Sets<\/Text>[\s\S]*density="compact" grouped columns=\{\[\{ \.\.\.setsColumn, label: '', accessibilityLabel: 'Sets' \}\]\}[\s\S]*accessoryRangeBoundsCell[\s\S]*>Rep Range<\/Text>[\s\S]*density="compact" grouped/, 'Sets and Rep Range use the identical grouped-cell wheel structure and label geometry');
assert.match(workspace, /<View pointerEvents="none" style=\{styles\.accessoryRangeSeparator\} \/>[\s\S]*accessoryRangeSeparator: \{[\s\S]*height: 2[\s\S]*backgroundColor: palette\.text/, 'Rep Range uses a vertically centered rule instead of a baseline-sensitive text glyph');
assert.match(workspace, /accessoryRangeControls: \{ flexDirection: 'row', alignItems: 'stretch'/, 'Sets and the Rep Range cell must share the exact same row height');
assert.match(workspace, /accessoryRangeCell: \{ minWidth: 0[\s\S]*accessoryRangeSetsCell: \{ flex: 1 \}[\s\S]*accessoryRangeBoundsCell: \{ flex: 2 \}/, 'the shared surface gives Sets one wheel-width and Rep Range exactly two equal wheel-widths');
assert.match(workspace, /target\.mode === 'FIXED'[\s\S]*target\.mode === 'RANGE'[\s\S]*columns=\{\[setsColumn, rirColumn\]\}/, 'AMRAP renders only Sets and RIR Target wheels');
assert.doesNotMatch(workspace, /Reps Lower|Reps Upper/, 'backend field names are never exposed');
assert.match(workspace, /accessibilityReflow \? \([\s\S]*accessory-fixed-reps[\s\S]*columns=\{\[rirColumn\]\}/, 'Fixed mode uses a 2+1 Dynamic Type reflow without shrinking the wheels');
assert.match(workspace, /accessoryRangeControlsReflow[\s\S]*accessoryRangeCellReflow/, 'Range controls preserve the single Rep Range cell during narrow-width/Dynamic Type reflow');
assert.match(workspace, /import \{ LoggerWheelPicker \} from '@\/components\/workout-logger\/logger-wheel-picker'/, 'the editor reuses the canonical Logger wheel');
assert.match(wheel, /accessibilityRole="adjustable"[\s\S]*Haptics\.selectionAsync/, 'canonical wheel accessibility and haptics remain active');
assert.doesNotMatch(workspace, /NumericStepper|Reps Lower|Reps Upper|Accessory.*(?:Percentage|RPE|CalculatedTargetPanel|ManualOverrideBlock)/, 'no rejected Accessory fields or steppers were added');
assert.match(workspace, /function collapsedLoadPresentation\([\s\S]*if \(kind === 'accessory'\) return null/, 'Accessories never render calculated or manual load suggestion badges');
assert.match(workspace, /function RecentHistorySection[\s\S]*movement_history\?\.recent_sessions/, 'Recent History remains data-backed and unchanged in purpose');
assert.match(workspace, /function CoachNotesSection/, 'Coach Notes remain directly in the inline workspace');
assert.match(workspace, /automaticallyAdjustKeyboardInsets[\s\S]*keyboardShouldPersistTaps="handled"/, 'the inline workspace remains keyboard safe');
assert.match(workspace, /if \(!success\) \{[\s\S]*return false[\s\S]*setPersistedSession/, 'only successful whole-Session saves clear dirty state');
assert.match(route, /Your Session edits are still available\./, 'failed saves preserve the local Accessory draft');

console.log('[accessory-prescription-editor] ok');
