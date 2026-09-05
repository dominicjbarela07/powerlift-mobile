import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  equipmentSelectionStatusLabels,
  equipmentTypeSelectionStatusLabels,
  equipmentTypeWasPreviouslyUsed,
  equipmentWasPreviouslyUsed,
  orderEquipmentChoices,
} from '../lib/equipment-selection.ts';
import { MANUFACTURER_REGISTRY } from '../lib/manufacturer-registry.ts';
import {
  createWorkoutDetailFixture,
  workoutDetailMachineIdentityChoices,
} from './fixtures/workout-detail.ts';

const routeSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);

const option = (id, key, displayName, context = {}) => ({
  id,
  key,
  display_name: `Alias that must not sort ${id}`,
  identity_specificity: 'exact',
  manufacturer: { id: id + 1000, key, display_name: displayName },
  equipment_context: { option_kind: 'catalog', ...context },
});

const mixedCase = [
  option(4, 'beta', 'beta'),
  option(3, 'alpha-z', 'Alpha'),
  option(2, 'alpha-a', 'alpha'),
  option(1, 'aardvark', 'Aardvark'),
  {
    ...option(5, 'other', 'Other'),
    manufacturer: null,
    equipment_context: { option_kind: 'other' },
  },
];
const firstPass = orderEquipmentChoices(mixedCase, 4);
const secondPass = orderEquipmentChoices([...mixedCase].reverse(), 1);
assert.deepEqual(
  firstPass.map((row) => row.manufacturer?.display_name || 'Other'),
  ['Aardvark', 'alpha', 'Alpha', 'beta', 'Other'],
  'Canonical display names must sort case-insensitively with deterministic tie-breaking and Other last.',
);
assert.deepEqual(
  secondPass.map((row) => row.key),
  firstPass.map((row) => row.key),
  'Input, database, current-selection, and insertion order must not affect picker order.',
);

const registryRows = orderEquipmentChoices(MANUFACTURER_REGISTRY.map((brand, index) => (
  option(index + 100, brand.key, brand.displayName)
)));
const registryNames = registryRows.map((row) => row.manufacturer.display_name);
for (const [earlier, later] of [
  ['Cybex', 'Eagle Fitness Systems'],
  ['Eagle Fitness Systems', 'Flex Fitness Systems'],
  ['Flex Fitness Systems', 'Gymleco'],
  ['Gymleco', 'Maxpump Fit'],
  ['Rogers Athletic', 'Watson'],
]) {
  assert.ok(
    registryNames.indexOf(earlier) < registryNames.indexOf(later),
    `${earlier} must sort before ${later}.`,
  );
}

const fixture = createWorkoutDetailFixture();
const movements = fixture.workout.accessory_groups.flatMap((group) => group.items);
const inclinePress = movements.find((item) => item.movement === 'Incline Chest Press');
const highRow = movements.find(
  (item) => item.movement === 'Iso-Lateral High Row with Independent Converging Arms',
);
assert.ok(inclinePress && highRow);

const choicesFor = (item, movementDefinitionId = item.movement_identity.id) => (
  workoutDetailMachineIdentityChoices(
    '',
    item.movement_identity.family_id,
    item.movement_identity.family_display_name || item.movement,
    movementDefinitionId,
  )
);
const inclineChoices = choicesFor(inclinePress);
const highRowChoices = choicesFor(highRow);
const inclineHammer = inclineChoices.find((row) => row.manufacturer?.display_name === 'Hammer Strength');
const highRowHammer = highRowChoices.find((row) => row.manufacturer?.display_name === 'Hammer Strength');
assert.equal(equipmentWasPreviouslyUsed(inclineHammer), true);
assert.equal(equipmentWasPreviouslyUsed(highRowHammer), false);
assert.deepEqual(
  equipmentSelectionStatusLabels(inclineHammer, false),
  ['USED'],
  'Performed history for the exact canonical movement must drive manufacturer Used.',
);
assert.deepEqual(
  equipmentSelectionStatusLabels(highRowHammer, false),
  ['NOT USED'],
  'The same manufacturer on a different movement must not leak Used state.',
);

const sameDisplayDifferentIdentity = choicesFor(
  inclinePress,
  inclinePress.movement_identity.id + 999,
).find((row) => row.manufacturer?.display_name === 'Hammer Strength');
assert.equal(
  equipmentWasPreviouslyUsed(sameDisplayDifferentIdentity),
  false,
  'The same displayed movement text with a different canonical ID must fail closed.',
);
const familyOnly = workoutDetailMachineIdentityChoices(
  '',
  inclinePress.movement_identity.family_id,
  inclinePress.movement,
).find((row) => row.manufacturer?.display_name === 'Hammer Strength');
assert.equal(
  equipmentWasPreviouslyUsed(familyOnly),
  false,
  'A broad family without an authoritative movement subject must not fabricate history.',
);

const currentButUnperformed = option(900, 'unperformed', 'Unperformed', {
  usage_status: 'not_used',
  is_current: true,
  used_equipment_type_keys: [],
});
assert.deepEqual(
  equipmentSelectionStatusLabels(currentButUnperformed, true),
  ['CURRENT', 'NOT USED'],
  'Current configuration must remain distinct from persisted historical use.',
);
assert.equal(equipmentTypeWasPreviouslyUsed(inclineHammer, 'plate_loaded'), true);
assert.equal(equipmentTypeWasPreviouslyUsed(inclineHammer, 'selectorized'), false);
assert.deepEqual(
  equipmentTypeSelectionStatusLabels(inclineHammer, 'plate_loaded', true),
  ['CURRENT', 'USED'],
);
assert.deepEqual(
  equipmentTypeSelectionStatusLabels(inclineHammer, 'selectorized', false),
  ['NOT USED'],
  'Equipment-type status must be exact even when its manufacturer was used.',
);
assert.deepEqual(
  ['lb', 'kg'].map(() => equipmentSelectionStatusLabels(inclineHammer, false)),
  [['USED'], ['USED']],
  'Display units must not participate in equipment usage identity.',
);

assert.match(
  routeSource,
  /performed_canonical_movement_identity[\s\S]*effective_movement_identity[\s\S]*movement_identity/,
  'The client preview must resolve the governed canonical/effective movement identity chain.',
);
assert.doesNotMatch(
  routeSource.match(/function canonicalMovementIdentityId[\s\S]*?\n}/)?.[0] || '',
  /performed_movement_identity/,
  'The movement history subject must never be replaced by the performed equipment identity.',
);
assert.match(
  routeSource,
  /setIdentityPickerRows\(orderEquipmentChoices\([\s\S]*response\.json\.items/,
  'The live server collection must pass through the canonical alphabetical ordering.',
);
assert.equal(
  (routeSource.match(/equipment-manufacturers/g) || []).length,
  1,
  'The picker must use one batched movement-scoped endpoint, not one request per manufacturer.',
);
assert.match(
  routeSource,
  /equipmentTypeSelectionStatusLabels\([\s\S]*variant\.key[\s\S]*\.join\(' · '\)/,
  'The type drilldown must present exact Used/Not Used state.',
);
assert.match(
  routeSource,
  /keyboardDismissMode=\{Platform\.OS === 'ios' \? 'interactive' : 'on-drag'\}/,
  'The established swipe/drag dismissal behavior must remain intact.',
);

console.log('Canonical equipment picker ordering and movement-scoped usage checks passed.');
