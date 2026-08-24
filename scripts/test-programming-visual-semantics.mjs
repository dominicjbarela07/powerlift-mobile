import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveProgrammingProgramVisual,
  resolveProgrammingRegionArtwork,
} from '../lib/programming-visual-semantics.ts';

assert.equal(resolveProgrammingProgramVisual({ name: 'Bodybuilding Offseason' }), 'bodybuilding');
assert.equal(resolveProgrammingProgramVisual({ programType: 'hypertrophy' }), 'bodybuilding');
assert.equal(resolveProgrammingProgramVisual({ name: 'Powerlifting Strength Base' }), 'powerlifting');
assert.equal(resolveProgrammingProgramVisual({ name: 'Spring Meet Prep' }), 'meet');
assert.equal(resolveProgrammingProgramVisual({ name: 'Custom Training' }), 'general');
assert.equal(resolveProgrammingProgramVisual({ name: 'Strength', meetDate: '2026-11-01' }), 'meet', 'meet context must outrank generic strength language');
assert.deepEqual(resolveProgrammingRegionArtwork(['lats', 'upper_back', 'rear_delts'], 'session'), ['back_region']);
assert.deepEqual(resolveProgrammingRegionArtwork(['biceps', 'triceps'], 'session'), ['arms']);
assert.deepEqual(resolveProgrammingRegionArtwork(['quads', 'lats'], 'week'), ['quads', 'lats']);
assert.deepEqual(resolveProgrammingRegionArtwork(['quads', 'lats'], 'session'), ['quads', 'lats']);
assert.deepEqual(resolveProgrammingRegionArtwork(['unknown'], 'session'), []);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manager = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'app/(tabs)/workout/session-workspace/[workoutId].tsx'), 'utf8');
const editingWorkspace = fs.readFileSync(path.join(root, 'components/coach-mobile/SessionEditingWorkspace.tsx'), 'utf8');
const muscleMap = fs.readFileSync(path.join(root, 'components/anatomy/MuscleMap.tsx'), 'utf8');
const programmingRegionArt = fs.readFileSync(path.join(root, 'components/anatomy/ProgrammingMuscleRegionArt.tsx'), 'utf8');

assert.match(manager, /const PROGRAMMING_PROGRAM_ARTWORK = \{[\s\S]*bodybuilding:[\s\S]*powerlifting:[\s\S]*meet:[\s\S]*general:/);
assert.match(manager, /resizeMode="cover" source=\{programArtwork\}/, 'Program artwork must occupy the atmospheric image frame');
assert.doesNotMatch(manager, /programFocusArt/, 'Training Program must not use anatomy artwork');
assert.doesNotMatch(manager, /<ProgrammingMuscleRegionArt level="week"/, 'Week headers must remain anatomy-free');
assert.match(manager, /<ProgrammingMuscleRegionArt level="session" primary=\{focus\.primary\}/, 'Session artwork must use the existing region asset system');
assert.match(workspace, /<ProgrammingMuscleRegionArt level="session" primary=\{workspaceFocus\.primary\}/, 'Session Workspace must use the existing region asset system');
assert.match(workspace, /CanonicalMovementArtwork/, 'Movement selection must preserve canonical individual-movement artwork semantics');
assert.match(editingWorkspace, /CanonicalMovementArtwork/, 'Movement rows must preserve canonical individual-movement artwork semantics');
assert.match(programmingRegionArt, /<MuscleMap/);
assert.doesNotMatch(programmingRegionArt, /accessoryRegionalArtworkAsset|resizeMode="contain"/);
assert.match(muscleMap, /resolveAnatomyFraming/);
for (const asset of [
  'assets/images/gym_vibe.jpg',
  'assets/images/journey-gym-rack.png',
  'assets/images/ledger-index-v2/ledger-core-squat-rack-v1.png',
  'assets/images/ledger-index-v2/ledger-hero-plate-v1.png',
]) assert.ok(fs.existsSync(path.join(root, asset)), `missing program equipment asset: ${asset}`);
for (const asset of ['back-region.png', 'arms.png', 'quads.png', 'lats.png']) {
  assert.ok(fs.existsSync(path.join(root, 'assets/images/muscle-regions', asset)), `missing muscle-region asset: ${asset}`);
}

console.log('Programming visual semantics contracts passed.');
