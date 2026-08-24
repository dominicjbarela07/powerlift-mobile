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
  assert.match(webProgrammingManager, /stableIdentity \? accessoryMuscleArtworkUrl\(definition\.primary_muscle_group\) : ''/);
  assert.doesNotMatch(webProgrammingManager, /image\.src = accessoryMuscleArtworkUrl\('full_body'\)/, 'web fallback must be neutral, never full-figure anatomy');
  assert.match(webProgrammingManager, /twb-neutral-movement-artwork/);
}

console.log(`[canonical-movement-artwork] ${fixtures.length} screenshot fixtures + fail-closed and consumer enforcement passed`);
