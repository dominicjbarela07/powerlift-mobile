#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveCanonicalMovementArtwork } from '../lib/canonical-movement-artwork.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const workspace = read('components', 'coach-mobile', 'SessionEditingWorkspace.tsx');
const assetResolver = read('lib', 'accessory-muscle-region-assets.ts');
const catalog = JSON.parse(read('assets', 'catalog', 'accessory-catalog-review.json')).movements;

const fixtures = [
  ['Flat Dumbbell Bench Press', 'chest'],
  ['Dumbbell Front Raise', 'front_delts'],
  ['Dumbbell Lateral Raise', 'side_delts'],
  ['Bent-Over Dumbbell Reverse Flye', 'rear_delts'],
  ['Wide-Grip Lat Pulldown', 'lats'],
  ['Bent-Over Barbell Row', 'upper_back'],
  ['Dumbbell Shrug', 'traps'],
  ['Bayesian Cable Curl', 'biceps'],
  ['Cable Triceps Pressdown', 'triceps'],
  ['Barbell Wrist Curl', 'forearms'],
  ['Leg Extension', 'quads'],
  ['Seated Leg Curl', 'hamstrings'],
  ['Barbell Hip Thrust', 'glutes'],
  ['Adductor Machine', 'adductors'],
  ['Standing Cable Hip Abduction', 'abductors'],
  ['Standing Calf Raise', 'calves'],
  ['Ab Wheel Rollout', 'abs'],
  ['Cable Wood Chop', 'obliques'],
  ['45-Degree Back Extension (Lower-Back Bias)', 'lower_back'],
  ['Dumbbell Serratus Punch', 'serratus'],
  ['Standing Cable Hip Flexion', 'hip_flexors'],
  ['Plate Neck Flexion', 'neck'],
];

for (const [canonicalName, expectedMuscle] of fixtures) {
  const movement = catalog.find((entry) => entry.canonical_name === canonicalName);
  assert.ok(movement, `Missing actual catalog fixture: ${canonicalName}`);
  assert.equal(movement.primary_muscle_group, expectedMuscle, `${canonicalName} catalog taxonomy changed`);
  assert.equal(
    resolveCanonicalMovementArtwork({
      kind: 'accessory',
      movement_definition_id: 1000 + fixtures.findIndex(([name]) => name === canonicalName),
      movement_identity: {
        id: 1000 + fixtures.findIndex(([name]) => name === canonicalName),
        primary_muscle_group: movement.primary_muscle_group,
      },
    }).regionKey,
    expectedMuscle,
    `${canonicalName} did not resolve through governed primary muscle`,
  );
  assert.match(assetResolver, new RegExp(`\\b${expectedMuscle}: \\{[^\\n]+require\\('([^']+)'\\)`), `${expectedMuscle} has no governed static artwork`);
}

assert.equal(
  resolveCanonicalMovementArtwork({
    kind: 'accessory',
    movement_identity: { id: 9001, primary_muscle_group: 'biceps' },
  }).regionKey,
  'biceps',
  'Canonical primary muscle must win over family and display-name inference.',
);
assert.equal(
  resolveCanonicalMovementArtwork({
    kind: 'custom',
    movement_identity: { id: 9002, primary_muscle_group: 'biceps' },
  }).regionKey,
  'biceps',
  'Custom movement artwork must use its saved primary muscle.',
);
assert.deepEqual(
  resolveCanonicalMovementArtwork({ kind: 'accessory' }),
  { kind: 'neutral', reason: 'missing_canonical_identity' },
  'Identity-free legacy prescriptions must fail closed to neutral artwork.',
);

assert.match(workspace, /<MovementArtwork item=\{item\} kind=\{kind\} size=\{72\}/, 'Collapsed rows must render through the shared artwork component.');
assert.match(workspace, /<MovementArtwork item=\{item\} kind=\{kind\} size=\{64\}/, 'Expanded rows must render through the shared artwork component.');
assert.match(workspace, /function MovementArtwork[\s\S]*<CanonicalMovementArtwork movement=\{movement\}/, 'Session Workspace must use the one governed individual-movement artwork resolver.');
assert.doesNotMatch(workspace, /<MuscleMap/, 'Individual Session Workspace movement cards must never render full-figure anatomy.');
assert.doesNotMatch(workspace, /ACCESSORY_CATEGORY_ARTWORK|accessory-wordmark-coin-seal|back-region/, 'Session rows must not use a generic accessory or broad regional asset.');

console.log(`[session-workspace-accessory-artwork] ok: ${fixtures.length} governed muscle fixtures + custom/neutral fail-closed behavior`);
