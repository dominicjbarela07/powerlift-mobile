#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { accessoryMuscleRegion } from '../lib/accessory-muscle-group.ts';

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
    accessoryMuscleRegion({
      movement: movement.canonical_name,
      movement_identity: {
        family: 'intentionally_misleading_legacy_family',
        primary_muscle_group: movement.primary_muscle_group,
      },
    }).key,
    expectedMuscle,
    `${canonicalName} did not resolve through governed primary muscle`,
  );
  assert.match(assetResolver, new RegExp(`\\b${expectedMuscle}: \\{[^\\n]+require\\('([^']+)'\\)`), `${expectedMuscle} has no governed static artwork`);
}

assert.equal(
  accessoryMuscleRegion({ movement: 'Misleading Lat Pulldown Name', movement_identity: { primary_muscle_group: 'biceps', family: 'vertical_pull' } }).key,
  'biceps',
  'Canonical primary muscle must win over family and display-name inference.',
);
assert.equal(
  accessoryMuscleRegion({ movement: 'Single-Arm Cable Face-Away Curl', movement_identity: { primary_muscle_group: 'biceps' } }).key,
  'biceps',
  'Custom movement artwork must use its saved primary muscle.',
);
assert.equal(accessoryMuscleRegion({ movement: 'Dumbbell Lateral Raise' }).key, 'side_delts', 'Legacy prescriptions must use deterministic compatibility rules.');
assert.equal(accessoryMuscleRegion({ movement: 'Unresolved Custom Movement' }).key, 'full_body', 'Unknown legacy movements must fail safely to full-body artwork.');

assert.match(workspace, /<MovementArtwork item=\{item\} kind=\{kind\} size=\{72\}/, 'Collapsed rows must render through the shared artwork component.');
assert.match(workspace, /<MovementArtwork item=\{item\} kind=\{kind\} size=\{64\}/, 'Expanded rows must render through the shared artwork component.');
assert.match(workspace, /const muscle = accessoryMuscleRegion\(item\);[\s\S]*const artwork = accessoryMuscleRegionAsset\(muscle\.key\);/, 'Session Workspace must delegate to the governed resolver and asset registry.');
assert.match(workspace, /if \(kind === 'accessory'\)[\s\S]*const identity = resolveLoggerLiftIdentity\(item\);/, 'Core and variant artwork must remain on canonical Logger identity after the accessory branch.');
assert.doesNotMatch(workspace, /ACCESSORY_CATEGORY_ARTWORK|accessory-wordmark-coin-seal|back-region/, 'Session rows must not use a generic accessory or broad regional asset.');

console.log(`[session-workspace-accessory-artwork] ok: ${fixtures.length} governed muscle fixtures + custom/legacy/unknown fallbacks`);
