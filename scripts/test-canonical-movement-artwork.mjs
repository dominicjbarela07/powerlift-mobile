#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveCanonicalMovementArtwork } from '../lib/canonical-movement-artwork.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const readRepo = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
const catalog = JSON.parse(read('assets', 'catalog', 'accessory-catalog-review.json')).movements;

const fixtures = [
  ['Barbell Row', 'Bent-Over Barbell Row', 'upper_back', ['lats', 'rear_delts', 'biceps'], 'upper-back.png'],
  ['Neutral-Grip Lat Pulldown', 'Neutral-Grip Lat Pulldown', 'lats', ['biceps', 'upper_back'], 'lats.png'],
  ['Chest-Supported Dumbbell Row', 'Chest-Supported Dumbbell Row', 'upper_back', ['lats', 'rear_delts', 'biceps'], 'upper-back.png'],
  ['Cable Pullover', 'Cable Pullover', 'lats', ['biceps', 'upper_back'], 'lats.png'],
  ['Machine Reverse Fly', ['Machine Reverse Fly', 'Machine Reverse Flye'], 'rear_delts', ['upper_back'], 'rear-delts.png'],
  ['Incline Dumbbell Curl', 'Incline Dumbbell Curl', 'biceps', ['forearms'], 'biceps.png'],
];

fixtures.forEach(([requestedLabel, canonicalNames, primary, secondary], index) => {
  const candidates = Array.isArray(canonicalNames) ? canonicalNames : [canonicalNames];
  const movement = catalog.find((entry) => candidates.includes(entry.canonical_name));
  assert.ok(movement, `${requestedLabel} must resolve to an audited governed catalog entry`);
  assert.equal(movement.primary_muscle_group, primary);
  assert.deepEqual(movement.secondary_muscle_groups, secondary);
  assert.deepEqual(
    resolveCanonicalMovementArtwork({
      kind: 'accessory',
      movement_definition_id: index + 1,
      movement_identity: {
        id: index + 1,
        primary_muscle_group: movement.primary_muscle_group,
        secondary_muscle_groups: movement.secondary_muscle_groups,
      },
    }),
    {
      kind: 'accessory',
      canonicalIdentityId: index + 1,
      regionKey: primary,
      primaryMuscleGroup: primary,
      secondaryMuscleGroups: secondary,
    },
    `${requestedLabel} must derive artwork from governed taxonomy only`,
  );
});

assert.deepEqual(
  resolveCanonicalMovementArtwork({
    kind: 'accessory',
    movement_definition_id: 10,
    movement_identity: { id: 10, primary_muscle_group: 'chest' },
    legacy: {
      state: 'legacy_resolved',
      effective_movement_definition_id: 11,
      effective_movement_identity: { id: 11, primary_muscle_group: 'upper_back' },
    },
  }),
  {
    kind: 'accessory',
    canonicalIdentityId: 11,
    regionKey: 'upper_back',
    primaryMuscleGroup: 'upper_back',
    secondaryMuscleGroups: [],
  },
  'active explicit legacy resolution must outrank misleading source identity',
);

assert.deepEqual(
  resolveCanonicalMovementArtwork({
    kind: 'accessory',
    movement_definition_id: 222,
    movement_identity: {
      id: 222,
      family: 'accessory_upper_back',
      primary_muscle_group: 'upper_back',
      secondary_muscle_groups: ['lats', 'rear_delts', 'biceps'],
    },
    performed_movement_identity: { id: 24, family: 'custom' },
    legacy: {
      state: 'canonical',
      effective_movement_definition_id: 222,
      effective_movement_identity: {
        id: 222,
        family: 'accessory_upper_back',
        primary_muscle_group: 'upper_back',
        secondary_muscle_groups: ['lats', 'rear_delts', 'biceps'],
      },
    },
  }),
  {
    kind: 'accessory',
    canonicalIdentityId: 222,
    regionKey: 'upper_back',
    primaryMuscleGroup: 'upper_back',
    secondaryMuscleGroups: ['lats', 'rear_delts', 'biceps'],
  },
  'Machine Seated Row must ignore its taxonomy-less performed equipment identity',
);

for (const [label, id, primary, secondary] of [
  ['Single-Arm Lat Pulldown', 167, 'lats', ['biceps', 'upper_back']],
  ['Single-Arm Cable Pullover', 173, 'lats', ['biceps', 'upper_back']],
  ['Machine Reverse Fly', 135, 'rear_delts', ['upper_back']],
]) {
  const resolved = resolveCanonicalMovementArtwork({
    kind: 'accessory',
    movement_identity: {
      id,
      primary_muscle_group: primary,
      secondary_muscle_groups: secondary,
    },
  });
  assert.equal(resolved.kind, 'accessory', `${label} must resolve as canonical Accessory artwork`);
  assert.equal(resolved.canonicalIdentityId, id);
  assert.equal(resolved.regionKey, primary);
}

assert.deepEqual(
  resolveCanonicalMovementArtwork({
    kind: 'accessory',
    movement_identity: { id: 4, family: 'horizontal_pull' },
  }),
  {
    kind: 'accessory',
    canonicalIdentityId: 4,
    regionKey: 'upper_back',
    primaryMuscleGroup: 'upper_back',
    secondaryMuscleGroups: [],
  },
  'a governed movement family is the catalog-level artwork fallback when material taxonomy is absent',
);

assert.deepEqual(
  resolveCanonicalMovementArtwork({
    kind: 'accessory',
    movement_identity: {
      id: 500,
      material_parameters: {
        accessory_taxonomy: {
          primary_muscle_group: 'rear_delts',
          secondary_muscle_groups: ['upper_back'],
        },
      },
    },
  }),
  {
    kind: 'accessory',
    canonicalIdentityId: 500,
    regionKey: 'rear_delts',
    primaryMuscleGroup: 'rear_delts',
    secondaryMuscleGroups: ['upper_back'],
  },
  'nested governed material taxonomy must be sufficient for canonical artwork',
);

assert.deepEqual(
  resolveCanonicalMovementArtwork({ kind: 'accessory', movement_definition_id: 12, primary_muscle_group: 'full_body' }),
  { kind: 'neutral', reason: 'missing_governed_taxonomy' },
  'full-body may never be an individual Accessory result',
);
assert.deepEqual(
  resolveCanonicalMovementArtwork({ kind: 'accessory' }),
  { kind: 'neutral', reason: 'missing_canonical_identity' },
  'missing identity must fail closed',
);
assert.deepEqual(
  resolveCanonicalMovementArtwork({ kind: 'accessory', movement_definition_id: 13, primary_muscle_group: 'not_governed' }),
  { kind: 'neutral', reason: 'missing_governed_taxonomy' },
  'unknown taxonomy must fail closed',
);

for (const [family, kind] of [
  ['squat', 'core'],
  ['bench', 'core'],
  ['deadlift', 'core'],
  ['press', 'variant'],
]) {
  assert.equal(
    resolveCanonicalMovementArtwork({ core_movement_id: 100, kind, core_family: family }).kind,
    kind === 'variant' ? 'core_variant' : 'core',
    `${family} must retain governed Core artwork semantics`,
  );
}

const renderer = read('components', 'movement', 'CanonicalMovementArtwork.tsx');
const resolver = read('lib', 'canonical-movement-artwork.ts');
assert.doesNotMatch(renderer, /MuscleMap|full-body|full_body/, 'the individual renderer must structurally exclude full-figure anatomy');
assert.doesNotMatch(resolver, /movement_name|movementName|display_name|displayName|equipment_definition|manufacturer/, 'the resolver may not consume display names or equipment identity');
assert.doesNotMatch(resolver, /normalizedToken\(movement\.(?:name|movement|label)\)/, 'the resolver may not normalize display text to infer artwork');
assert.match(renderer, /Ionicons name="help-outline"/, 'unresolved identities require a neutral placeholder');
assert.match(renderer, /console\.warn\('\[movement-artwork\] neutral fail-closed result'/, 'DEV diagnostics must expose missing governed mappings');

const individualConsumers = [
  ['components/coach-mobile/SessionEditingWorkspace.tsx', /CanonicalMovementArtwork/],
  ['components/coach-mobile/CompletedSessionRecap.tsx', /CanonicalMovementArtwork/],
  ['components/movement-history/CanonicalMovementHistoryScreen.tsx', /CanonicalMovementArtwork/],
  ['components/ledger/exploration-experiences.tsx', /CanonicalMovementArtwork/],
  ['components/ledger/index-experience.tsx', /CanonicalMovementArtwork/],
  ['components/movement/GovernedAccessoryPickerModal.tsx', /CanonicalMovementArtwork/],
  ['app/(tabs)/workout/session-workspace/[workoutId].tsx', /CanonicalMovementArtwork/],
  ['components/workout-logger/core-loggers.tsx', /CanonicalMovementArtwork/],
];
for (const [file, marker] of individualConsumers) {
  const source = read(...file.split('/'));
  assert.match(source, marker, `${file} must use the canonical individual-movement renderer`);
}

assert.doesNotMatch(read('components', 'coach-mobile', 'SessionEditingWorkspace.tsx'), /<MuscleMap/);
assert.doesNotMatch(read('components', 'coach-mobile', 'CompletedSessionRecap.tsx'), /<MuscleMap/);
assert.doesNotMatch(read('components', 'movement-history', 'CanonicalMovementHistoryScreen.tsx'), /<MuscleMap/);
assert.doesNotMatch(read('app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx'), /<MuscleMap/);

const webProgrammingManagerPath = path.join(repoRoot, 'app', 'templates', 'programming_manager_dev.html');
if (fs.existsSync(webProgrammingManagerPath)) {
  const webProgrammingManager = readRepo('app', 'templates', 'programming_manager_dev.html');
  assert.match(webProgrammingManager, /const stableIdentity = definition\.id \|\| definition\.movement_definition_id/);
  assert.match(webProgrammingManager, /const governedRegion = definition\.primary_muscle_group \|\| familyRegion/);
  assert.match(webProgrammingManager, /stableIdentity \? accessoryMuscleArtworkUrl\(governedRegion\) : ''/);
  assert.match(webProgrammingManager, /horizontal_pull: 'upper_back'/);
  assert.doesNotMatch(webProgrammingManager, /image\.src = accessoryMuscleArtworkUrl\('full_body'\)/, 'web fallback must be neutral, never full-figure anatomy');
  assert.match(webProgrammingManager, /twb-neutral-movement-artwork/);
}

console.log(`[canonical-movement-artwork] ${fixtures.length} screenshot fixtures + fail-closed and consumer enforcement passed`);
