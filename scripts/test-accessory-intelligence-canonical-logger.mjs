import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  applyWorkoutDetailMachineIdentity,
  CANONICAL_LOGGER_VISUAL_COVERAGE,
  createWorkoutDetailFixture,
  workoutDetailMachineIdentityChoices,
} from '../dev-mocks/fixtures/workout-detail.ts';

const fixture = createWorkoutDetailFixture();
const workout = fixture.workout;
const accessories = workout.accessory_groups.flatMap((group) => group.items);
const coreLoggerSource = fs.readFileSync(
  path.join(process.cwd(), 'components/workout-logger/core-loggers.tsx'),
  'utf8',
);
const coreVariantBadgeSource = fs.readFileSync(
  path.join(process.cwd(), 'components/workout-logger/core-variant-badge.tsx'),
  'utf8',
);
const workoutRouteSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const rejectedArtworkPaths = [
  'assets/images/movement-category-artwork-v1/accessory-category.png',
  'assets/images/movement-category-artwork-v1/core-variant-category.png',
  'assets/images/movement-category-artwork-v2/accessory-category-badge.png',
  'assets/images/movement-category-artwork-v2/core-variant-marker.png',
  'assets/images/movement-category-artwork-v3/accessory-crest.png',
  'assets/images/movement-category-artwork-v3/accessory-dumbbell.png',
  'assets/images/movement-category-artwork-v3/accessory-mechanical.png',
  'assets/images/movement-category-artwork-v3/accessory-plate.png',
];

assert.equal(
  workout.core_items.length,
  11,
  'Canonical logger fixture must retain every planned core item, including all Top/Backdown children.',
);
assert.equal(workout.core_items[0].movement, 'Competition Squat');
assert.equal(workout.core_items[0].designation, 'Primary');
assert.equal(workout.core_items[0].variant, 'TOP');
assert.equal(workout.core_items[1].variant, 'BK');
assert.equal(workout.core_items[1].parent_item_id, workout.core_items[0].id);
assert.equal(workout.core_items.filter((item) => item.variant === 'VR').length, 3);
assert.deepEqual(
  workout.core_items
    .filter((item) => item.variant === 'VR')
    .map((item) => [item.lift, item.dev_core_family]),
  [
    ['SQ', 'squat'],
    ['BN', 'bench'],
    ['DL', 'deadlift'],
  ],
  'Every canonical core variant must carry an explicit parent-family identity.',
);
assert.equal(workout.core_items.some((item) => item.variant === 'FULL_CUSTOM'), true);
assert.deepEqual(
  new Set(workout.core_items.map((item) => item.lift)),
  new Set(['SQ', 'BN', 'DL']),
  'Primary SBD identities and their core variants must all be visible.',
);
assert.ok(
  accessories.length >= 16,
  'Canonical logger fixture must remain a dense ecosystem rather than a narrow happy path.',
);
assert.deepEqual(
  workout.dev_visual_coverage,
  CANONICAL_LOGGER_VISUAL_COVERAGE,
  'The canonical fixture must publish its complete visual coverage contract.',
);

const fixtureCoverageTags = new Set(
  [...workout.core_items, ...accessories].flatMap((item) => item.dev_visual_coverage || []),
);
for (const [coverageGroup, expectedTags] of Object.entries(CANONICAL_LOGGER_VISUAL_COVERAGE)) {
  if (coverageGroup === 'coreIdentities' || coverageGroup === 'edgeCases') continue;
  for (const expectedTag of expectedTags) {
    assert.equal(
      fixtureCoverageTags.has(expectedTag),
      true,
      `Canonical logger fixture is missing visible coverage for ${coverageGroup}: ${expectedTag}.`,
    );
  }
}
for (const expectedTag of ['long-name', 'long-equipment-name', 'long-note']) {
  assert.equal(fixtureCoverageTags.has(expectedTag), true, `Missing edge-case fixture tag: ${expectedTag}.`);
}
assert.ok(
  new Set([...workout.core_items, ...accessories].map((item) => Number(item.sets || 0))).size >= 5,
  'The canonical fixture must pressure-test different set counts.',
);
assert.ok(
  workout.core_items.some((item) => item.mode === 'PCT' && item.pct != null),
  'Percentage-based core work must remain visible.',
);
assert.ok(
  workout.core_items.some((item) => item.variant === 'FULL_CUSTOM' && item.planned_sets.length >= 4),
  'Full Custom must remain visible with heterogeneous planned rows.',
);
assert.ok(
  workout.accessory_groups.some((group) => group.group === 'A' && group.items.length === 2),
  'The canonical fixture must retain a grouped accessory layout.',
);

const freeWeight = accessories.find((item) => item.movement === 'Dumbbell Incline Bench');
assert.equal(freeWeight.original_movement, 'Incline DB');
assert.equal(freeWeight.movement_identity.identity_specificity, 'exact');
assert.equal(freeWeight.performed_movement_identity, null);
assert.equal(freeWeight.target_low_kg, null, 'Accessory recommendations must not populate prescribed load fields.');
assert.equal(freeWeight.target_high_kg, null, 'Accessory recommendations must not populate prescribed load fields.');
for (const rejectedPath of rejectedArtworkPaths) {
  assert.equal(
    fs.existsSync(path.join(process.cwd(), rejectedPath)),
    false,
    `Rejected movement artwork must remain deleted: ${rejectedPath}`,
  );
}
assert.equal(
  accessories.some((item) => 'dev_accessory_badge_concept' in item),
  false,
  'Accessory cards must not retain concept-specific badge routing.',
);
const accessoryEquipmentClasses = new Set(
  accessories.map((item) => item.movement_identity?.equipment_type).filter(Boolean),
);
for (const expectedClass of [
  'Dumbbell',
  'Barbell',
  'Machine',
  'Plate loaded machine',
  'Selectorized machine',
  'Common cable',
  'Bodyweight',
  'Weighted bodyweight',
  'Assisted bodyweight',
  'Custom equipment implementation not yet identified',
]) {
  assert.equal(
    accessoryEquipmentClasses.has(expectedClass),
    true,
    `The canonical fixture must cover the ${expectedClass} Accessory medal path.`,
  );
}
assert.equal(
  accessories.every((item) => Boolean(item.dev_accessory_intelligence)),
  true,
  'Every canonical accessory class must retain its structured movement intelligence.',
);
assert.match(
  workoutRouteSource,
  /import \{ accessoryMuscleRegion \} from '@\/lib\/accessory-muscle-group'/,
  'The shared logger must resolve the canonical muscle region for Accessory cards.',
);
assert.match(
  workoutRouteSource,
  /accessoryMuscleRegion: isAccessory[\s\S]*?accessoryMuscleRegion\(item\)\.key/,
  'Every accessory card must receive a canonical muscle-region asset key.',
);
assert.match(
  workoutRouteSource,
  /const isCoreVariant =[\s\S]*?resolvedIdentity\.key in CORE_FAMILY_LIFT_CODE/,
  'Core variants must resolve their parent artwork from structured lift identity.',
);
assert.match(
  coreLoggerSource,
  /visualContext\?\.accessoryMuscleRegion \? \([\s\S]*?<AccessoryMuscleRegionMedallion[\s\S]*?regionKey=\{visualContext\.accessoryMuscleRegion\}[\s\S]*?: visualContext\?\.coreVariantFamily && visualContext\.liftIconSource \? \([\s\S]*?<CoreVariantBadge/,
  'Accessories must render the canonical muscle-region medallion while variants use the integrated parent-family badge.',
);
assert.match(
  coreVariantBadgeSource,
  /export type CoreVariantFamily = 'squat' \| 'bench' \| 'deadlift'/,
  'The integrated badge must explicitly support all three canonical parent families.',
);
assert.doesNotMatch(
  workoutRouteSource,
  /movement-category-artwork-v[123]\/|DEV_CORE_VARIANT_MARKER|variantMarkerSource/,
  'The canonical logger must not reference rejected category assets or the detached Core Variant marker.',
);
assert.match(
  coreLoggerSource,
  /const visibleProgressContext = isPreSessionCard[\s\S]*?: coreLoggerVisibleExpandedContent\(expanded, visualContext\?\.progress\)/,
  'Collapsed cards and Pre Session must remove performance context from layout flow.',
);
assert.doesNotMatch(
  coreLoggerSource,
  /!expanded && completedRows|reviewLoggedSetsButton/,
  'Collapsed cards must not retain timeline/history affordances or their reserved spacing.',
);

const machine = accessories.find((item) => item.movement === 'Incline Chest Press');
assert.equal(machine.performed_movement_identity.manufacturer.display_name, 'Hammer Strength');
assert.equal(machine.dev_accessory_intelligence.previous_label, 'Last on this machine');
assert.ok(
  machine.movement_history.related_reference_history.some((row) => row.manufacturer === 'Prime'),
  'Prime history must remain available as related reference evidence.',
);
assert.ok(
  machine.movement_history.related_reference_history.every(
    (row) => row.reference_only === true && row.loads_comparable === false,
  ),
  'Related machine evidence must remain reference-only and non-comparable.',
);

const cable = accessories.find((item) => item.movement === 'Cable Row');
assert.equal(cable.movement_identity.equipment_type, 'Common cable');
assert.equal(cable.performed_movement_identity, null);

assert.equal(accessories.find((item) => item.movement === 'Pull-Up').reps_text, 'AMRAP');
assert.equal(
  accessories.find((item) => item.movement === 'Pull-Up').dev_accessory_intelligence.history_empty_label,
  'First time movement',
);
assert.equal(
  accessories.find((item) => item.movement === 'RKC Plank').dev_accessory_intelligence.history_empty_label,
  'No previous performance',
);
assert.equal(accessories.find((item) => item.movement === 'RKC Plank').reps_text, '45 sec');
assert.equal(accessories.find((item) => item.movement === 'Farmer Carry').reps_text, '30 m');
assert.equal(
  accessories.find((item) => item.movement === 'Single-Arm Dumbbell Row').reps_text,
  '10–12 / side',
);
assert.match(
  workoutRouteSource,
  /const emptyLabel = String\(devContext\?\.history_empty_label \|\| ''\)\.trim\(\);[\s\S]*?return line \|\| emptyLabel \|\| null;/,
  'First-time and no-history fixture states must be visibly distinguishable in the canonical logger.',
);

const primaryActionIndex = coreLoggerSource.indexOf('<View style={styles.accessoryPrimaryAction}>');
const timelineIndex = coreLoggerSource.indexOf('<SetTimeline', primaryActionIndex);
assert.ok(
  primaryActionIndex >= 0 && primaryActionIndex < timelineIndex,
  'Accessory execution must present Log Set before the set timeline.',
);
assert.doesNotMatch(
  coreLoggerSource,
  /TODAY&apos;S WORK|accessoryScheme/,
  'Individual accessory cards must not repeat the prescription in a Today\'s Work section.',
);
assert.match(
  workoutRouteSource,
  /target: log \? null : accessoryPerSetPrescription\(item\)[\s\S]*?prescription: null/,
  'Each upcoming accessory timeline row must show a per-set prescription without the aggregate set multiplier.',
);
assert.match(
  workoutRouteSource,
  /currentSetRepsLabel: accessoryPerSetRepsLabel\(item\)/,
  'Accessory ranges must prefer reps_text instead of a zero-valued scalar reps field.',
);
assert.doesNotMatch(
  coreLoggerSource,
  /accessoryRecommendation|accessoryConceptBadge|Suggested increase|Suggested starting point|coaching intelligence/i,
  'Concept-only recommendation content must remain absent from the expanded movement card.',
);
assert.doesNotMatch(
  workoutRouteSource,
  /recommendationLabel|recommendationValue|recommendationSupporting|Suggested increase|Suggested starting point|coaching intelligence/i,
  'The canonical route must not construct recommendation presentation content.',
);
assert.match(
  coreLoggerSource,
  /loggerFocus\?\.canLog && loggerFocus\.onLogSet && !loggerFocus\.accessoryPresentation/,
  'The shared footer must not duplicate the accessory Log Set action.',
);
assert.match(
  coreLoggerSource,
  /const canonicalMovementCard = sessionIndex != null/,
  'The canonical movement shell must be shared by live and Ideal lifecycle routes.',
);
assert.match(
  coreLoggerSource,
  /activeMovementCardCanonical:\s*\{[\s\S]*?marginBottom: 14[\s\S]*?borderWidth: 1[\s\S]*?backgroundColor: SLMovementCardMaterial\.base/,
  'Every canonical movement must retain a bordered near-black shell and OLED gutter.',
);
assert.match(
  coreLoggerSource,
  /activeMovementCardCanonical:\s*\{[\s\S]*?overflow: 'hidden'/,
  'Every canonical movement must clip ambient lighting to its rounded card bounds.',
);
assert.match(
  coreLoggerSource,
  /const cardMaterialState = state === 'logged'/,
  'Canonical movement material must follow the shared movement-state system.',
);
const movementCardMaterial = fs.readFileSync(
  path.join(process.cwd(), 'components/workout-logger/movement-card-material.tsx'),
  'utf8',
);
assert.match(
  coreLoggerSource,
  /<MovementCardMaterial[\s\S]*?state=\{cardMaterialState\}/,
  'The canonical card must resolve its edge through the shared state material.',
);
assert.doesNotMatch(
  movementCardMaterial,
  /shadowColor|shadowOpacity|shadowRadius|shadowOffset|elevation/,
  'Canonical card identity lighting must not project into the OLED page gutter.',
);
assert.match(
  movementCardMaterial,
  /colors=\{\[tintStrong, tintQuiet, 'rgba\(0,0,0,0\)'\]\}/,
  'Canonical movement cards must retain their restrained clipped accent gradient.',
);
for (const styleName of [
  'movementProgressContextExpanded',
  'setTimelineOpenSurface',
]) {
  assert.match(
    coreLoggerSource,
    new RegExp(`${styleName}: \\{[\\s\\S]*?backgroundColor: 'transparent'`),
    `${styleName} must use the divider-led open-surface treatment.`,
  );
}
assert.equal(
  workoutRouteSource.match(/isIdealWorkoutDetailPreview && styles\.canonicalMovementListDev/g)?.length,
  2,
  'Core and accessory wrappers must expose the global OLED background throughout the lifecycle.',
);
assert.match(
  workoutRouteSource,
  /canonicalMovementListDev:\s*\{[\s\S]*?marginTop: 0[\s\S]*?marginBottom: 0[\s\S]*?backgroundColor: SLColors\.background/,
  'Core and accessory wrappers must not add section spacing on top of the shared card gutter.',
);
for (const accent of ['accentMagenta', 'accentOrange', 'info']) {
  assert.match(
    workoutRouteSource,
    new RegExp(`return SLColors\\.${accent}`),
    `Accessory identity palette must include ${accent}.`,
  );
}

const choices = workoutDetailMachineIdentityChoices('', machine.movement_identity.family_id);
const choiceManufacturers = choices
  .map((choice) => choice.manufacturer?.display_name)
  .filter(Boolean);
assert.equal(choiceManufacturers[0], 'Hammer Strength');
assert.ok(choiceManufacturers.includes('Prime Fitness'));
assert.ok(choiceManufacturers.includes('Arsenal Strength'));
assert.ok(choiceManufacturers.includes('Technogym'));
assert.equal(
  choices.at(-1)?.equipment_context?.option_kind,
  'other',
  'The complete manufacturer catalog must end with the one-tap Other fallback.',
);

const prime = choices.find((choice) => choice.manufacturer?.display_name === 'Prime Fitness');
const changed = applyWorkoutDetailMachineIdentity(machine, prime.id);
assert.equal(changed.performed_movement_identity.manufacturer.display_name, 'Prime Fitness');
assert.equal(Math.round(changed.lookback_best.actual_weight_kg / 0.45359237), 180);
assert.equal(changed.target_low_kg, null);
assert.equal(changed.target_high_kg, null);
assert.ok(
  changed.movement_history.related_reference_history.some((row) => row.manufacturer === 'Hammer Strength'),
  'Changing equipment must immediately move the former exact implementation into related reference history.',
);

console.log('Canonical logger accessory intelligence fixture passed.');
