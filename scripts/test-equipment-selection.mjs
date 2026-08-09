import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  activeEquipmentIdentity,
  equipmentSnapshotForSet,
  isMachineAccessoryItem,
  needsEquipmentSelection,
  orderEquipmentChoices,
} from '../lib/equipment-selection.ts';
import {
  WORKOUT_DETAIL_EQUIPMENT_VARIANTS,
  WORKOUT_DETAIL_MACHINE_IDENTITIES,
  applyWorkoutDetailMachineIdentity,
  createWorkoutDetailFixture,
  hydrateWorkoutDetailEquipmentSelections,
  rememberWorkoutDetailEquipmentSelection,
  resetRememberedWorkoutDetailEquipmentSelections,
  workoutDetailEquipmentIdentityKey,
  workoutDetailMachineIdentityChoices,
  workoutDetailMachineVariantIdentity,
} from '../dev-mocks/fixtures/workout-detail.ts';
import {
  MANUFACTURER_REGISTRY,
} from '../lib/manufacturer-registry.ts';

const routeSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const loggerSource = fs.readFileSync(
  path.join(process.cwd(), 'components/workout-logger/core-loggers.tsx'),
  'utf8',
);
const manufacturerSource = fs.readFileSync(
  path.join(process.cwd(), 'components/workout-logger/manufacturer-brand-mark.tsx'),
  'utf8',
);

function accessoryItems(payload) {
  return payload.workout.accessory_groups.flatMap((group) => group.items);
}

resetRememberedWorkoutDetailEquipmentSelections();
const fixture = createWorkoutDetailFixture();
const machine = accessoryItems(fixture).find(
  (item) => item.movement === 'Incline Chest Press',
);
const freeWeight = accessoryItems(fixture).find(
  (item) => item.movement === 'Dumbbell Incline Bench',
);
const highRow = accessoryItems(fixture).find(
  (item) => item.movement === 'Iso-Lateral High Row with Independent Converging Arms',
);
assert.ok(machine);
assert.ok(freeWeight);
assert.ok(highRow);
assert.equal(isMachineAccessoryItem(machine), true);
assert.equal(isMachineAccessoryItem(freeWeight), false);
assert.equal(activeEquipmentIdentity(machine)?.manufacturer?.display_name, 'Hammer Strength');
assert.equal(needsEquipmentSelection(machine), false);
assert.equal(needsEquipmentSelection(freeWeight), false);

for (const executionContext of [
  'real-athlete-assigned-session',
  'owner-admin-athlete-mobile-mode-self-session',
  'coach-logging-athlete-session',
]) {
  const legacyMachine = {
    id: 9001,
    movement: 'Lat Pulldown',
    execution_context: executionContext,
    movement_identity: null,
    performed_movement_identity: null,
  };
  assert.equal(
    isMachineAccessoryItem(legacyMachine),
    true,
    `${executionContext} must classify a legacy machine movement from movement semantics, not actor role.`,
  );
  assert.equal(
    needsEquipmentSelection(legacyMachine),
    true,
    `${executionContext} must require equipment selection before logging a legacy machine movement.`,
  );
}

const incompleteLegacyMachineIdentity = {
  id: 9002,
  movement: 'Leg Extension',
  movement_identity: {
    id: 9102,
    key: 'legacy_leg_extension',
    display_name: 'Leg Extension',
    identity_specificity: 'exact',
  },
  performed_movement_identity: null,
};
assert.equal(isMachineAccessoryItem(incompleteLegacyMachineIdentity), true);
assert.equal(activeEquipmentIdentity(incompleteLegacyMachineIdentity), null);
assert.equal(needsEquipmentSelection(incompleteLegacyMachineIdentity), true);

const authoritativePortableIdentity = {
  id: 9003,
  movement: 'Machine Chest Press',
  movement_identity: {
    id: 9103,
    key: 'barbell_chest_press',
    display_name: 'Barbell Chest Press',
    identity_specificity: 'exact',
    equipment_type: 'barbell',
    loading_implementation: 'barbell',
    load_convention: 'barbell_total',
  },
  performed_movement_identity: null,
};
assert.equal(
  isMachineAccessoryItem(authoritativePortableIdentity),
  false,
  'Authoritative portable equipment metadata must override the legacy name fallback.',
);
assert.equal(
  isMachineAccessoryItem({
    id: 9004,
    movement: 'Dumbbell Lat Pulldown',
    movement_identity: null,
    performed_movement_identity: null,
  }),
  false,
  'Portable movement markers must not be promoted into machine configuration.',
);
assert.ok(
  accessoryItems(fixture)
    .filter((item) => isMachineAccessoryItem(item) && activeEquipmentIdentity(item))
    .every((item) => {
      const identity = activeEquipmentIdentity(item);
      return (
        identity.family_id == null
        && identity.family_display_name == null
        && identity.equipment_model == null
        && identity.material_parameters == null
      );
    }),
  'Existing canonical machine selections must be normalized to manufacturer plus type.',
);
assert.deepEqual(
  WORKOUT_DETAIL_EQUIPMENT_VARIANTS.map((variant) => variant.label),
  ['Plate Loaded', 'Selectorized'],
  'The type step must contain exactly Plate Loaded and Selectorized.',
);

const cleared = applyWorkoutDetailMachineIdentity(machine, null);
assert.equal(activeEquipmentIdentity(cleared), null);
assert.equal(needsEquipmentSelection(cleared), true);
assert.deepEqual(
  cleared.set_logs,
  machine.set_logs,
  'Clearing active equipment must not rewrite prior set evidence.',
);

const choices = workoutDetailMachineIdentityChoices(
  '',
  machine.movement_identity.family_id,
);
const ordered = orderEquipmentChoices(choices, machine.performed_movement_identity.id);
assert.equal(
  choices.length,
  MANUFACTURER_REGISTRY.length + 1,
  'The picker must expose the complete manufacturer registry plus Other.',
);
assert.deepEqual(
  new Set(choices.map((choice) => choice.manufacturer?.display_name).filter(Boolean)),
  new Set(MANUFACTURER_REGISTRY.map((manufacturer) => manufacturer.displayName)),
  'Every registry manufacturer must be available without a truncated fixture subset.',
);
assert.equal(
  ordered[0].manufacturer?.display_name,
  'Hammer Strength',
  'The active manufacturer must remain first.',
);
assert.equal(
  ordered.at(-1)?.equipment_context?.option_kind,
  'other',
  'Other must remain the final one-tap fallback.',
);
assert.ok(
  choices.every((choice) => (
    choice.identity_specificity === 'exact'
    && ['catalog', 'other'].includes(choice.equipment_context?.option_kind)
  )),
  'The DEV catalog must not expose unknown or session-only equipment choices.',
);
assert.equal(
  workoutDetailMachineIdentityChoices(
    'manufacturer-that-does-not-exist',
    machine.movement_identity.family_id,
    machine.movement,
  ).length,
  0,
  'An empty list is allowed only after a non-matching search query.',
);
assert.ok(
  choices.every((choice) => (
    !choice.equipment_context?.current_location_match
    && !choice.equipment_context?.location
    && !choice.material_parameters?.location
  )),
  'Equipment choices must not carry the deferred gym/location tracking concept.',
);
assert.ok(
  choices.every((choice) => (
    choice.family_id == null
    && choice.family_display_name == null
    && choice.equipment_model == null
    && choice.material_parameters == null
    && choice.comparison_policy?.comparison_scope === 'manufacturer_equipment_type'
  )),
  'Equipment identities must contain manufacturer and type without movement, model, or location dimensions.',
);

const highRowChoices = workoutDetailMachineIdentityChoices(
  '',
  highRow.movement_identity.family_id,
  highRow.movement_identity.family_display_name || highRow.movement,
);
assert.equal(
  highRowChoices.length,
  MANUFACTURER_REGISTRY.length + 1,
  'Every machine family must open with the complete manufacturer catalog.',
);
assert.ok(
  highRowChoices.every(
    (choice) => (
      choice.family_id == null
      && choice.family_display_name == null
      && choice.equipment_model == null
    ),
  ),
  'Equipment choices must remain independent from the selected movement identity.',
);
assert.equal(
  workoutDetailMachineIdentityChoices(
    'prime',
    highRow.movement_identity.family_id,
    highRow.movement,
  ).at(0)?.manufacturer?.display_name,
  'Prime Fitness',
  'Search must filter the already-populated manufacturer catalog.',
);

const highRowHammer = highRowChoices.find(
  (choice) => choice.manufacturer?.display_name === 'Hammer Strength',
);
const highRowHammerPlate = workoutDetailMachineVariantIdentity(
  highRowHammer,
  'plate_loaded',
);
assert.ok(highRowHammerPlate);
assert.equal(
  highRowHammerPlate.id,
  activeEquipmentIdentity(machine).id,
  'The same manufacturer and type must resolve to one identity across movements.',
);
const selectedHighRow = applyWorkoutDetailMachineIdentity(
  highRow,
  highRowHammerPlate.id,
  highRowHammerPlate,
);
assert.equal(
  selectedHighRow.performed_movement_identity.id,
  highRowHammerPlate.id,
  'A variant selection must commit the manufacturer-plus-type identity.',
);
assert.deepEqual(
  selectedHighRow.movement_history.related_reference_history,
  [],
  'A newly selected family must not receive unrelated Incline Chest Press history.',
);

const highRowOther = highRowChoices.find(
  (choice) => choice.equipment_context?.option_kind === 'other',
);
const highRowOtherSelectorized = workoutDetailMachineVariantIdentity(
  highRowOther,
  'selectorized',
);
assert.ok(highRowOtherSelectorized);
assert.equal(highRowOtherSelectorized.manufacturer, null);
assert.equal(
  highRowOtherSelectorized.equipment_context?.option_kind,
  'other',
  'Other must use the same manufacturer-plus-variant resolution path.',
);

const prime = ordered.find(
  (choice) => choice.manufacturer?.display_name === 'Prime Fitness',
);
const primePlateLoaded = workoutDetailMachineVariantIdentity(prime, 'plate_loaded');
const primeSelectorized = workoutDetailMachineVariantIdentity(prime, 'selectorized');
assert.ok(primePlateLoaded);
assert.ok(primeSelectorized);
assert.notEqual(
  primePlateLoaded.id,
  primeSelectorized.id,
  'Plate Loaded and Selectorized must resolve to distinct exact identities.',
);
assert.notEqual(
  workoutDetailEquipmentIdentityKey(primePlateLoaded),
  workoutDetailEquipmentIdentityKey(primeSelectorized),
  'The same manufacturer with different equipment types must remain separate.',
);
assert.equal(primePlateLoaded.manufacturer.display_name, 'Prime Fitness');
assert.equal(primePlateLoaded.equipment_type, 'Plate Loaded');
assert.equal(primeSelectorized.equipment_type, 'Selectorized');
assert.equal(
  WORKOUT_DETAIL_MACHINE_IDENTITIES.length,
  (MANUFACTURER_REGISTRY.length + 1) * WORKOUT_DETAIL_EQUIPMENT_VARIANTS.length,
  'Every registry manufacturer plus Other must expose both default variants.',
);
const selectedPrime = applyWorkoutDetailMachineIdentity(
  cleared,
  primeSelectorized.id,
);
assert.equal(selectedPrime.performed_movement_identity.id, primeSelectorized.id);
assert.equal(
  selectedPrime.movement_history.movement_definition_id,
  primeSelectorized.id,
);
assert.equal(
  selectedPrime.movement_history.most_recent_logged_set.weight_kg,
  180 * 0.45359237,
  'Exact machine history must immediately follow the selected identity.',
);
assert.equal(
  selectedPrime.movement_history.canonical_key,
  workoutDetailEquipmentIdentityKey(primeSelectorized),
  'Machine history must group by the manufacturer-plus-type key.',
);
assert.ok(
  selectedPrime.movement_history.related_reference_history.every(
    (row) => row.reference_only === true && row.loads_comparable === false,
  ),
  'Changing equipment must not make related-machine loads comparable.',
);

const other = ordered.find(
  (choice) => choice.equipment_context?.option_kind === 'other',
);
assert.ok(other, 'Other must remain available as a generic fallback identity.');
const otherPlateLoaded = workoutDetailMachineVariantIdentity(other, 'plate_loaded');
const otherSelectorized = workoutDetailMachineVariantIdentity(other, 'selectorized');
assert.ok(otherPlateLoaded);
assert.ok(otherSelectorized);
assert.notEqual(otherPlateLoaded.id, otherSelectorized.id);
const selectedOther = applyWorkoutDetailMachineIdentity(
  cleared,
  otherPlateLoaded.id,
);
assert.equal(
  selectedOther.performed_movement_identity.id,
  otherPlateLoaded.id,
  'Other + variant must resolve without collecting any free-text fields.',
);

rememberWorkoutDetailEquipmentSelection(
  fixture.workout.id,
  machine.id,
  primeSelectorized,
);
const rehydrated = hydrateWorkoutDetailEquipmentSelections(
  createWorkoutDetailFixture(),
);
const rehydratedMachine = accessoryItems(rehydrated).find(
  (item) => item.id === machine.id,
);
assert.equal(
  rehydratedMachine.performed_movement_identity.id,
  primeSelectorized.id,
  'Active equipment must survive a DEV logger remount/navigation refresh.',
);
resetRememberedWorkoutDetailEquipmentSelections();

rememberWorkoutDetailEquipmentSelection(
  fixture.workout.id,
  highRow.id,
  highRowHammerPlate,
);
const rehydratedHighRow = accessoryItems(
  hydrateWorkoutDetailEquipmentSelections(createWorkoutDetailFixture()),
).find((item) => item.id === highRow.id);
assert.equal(
  rehydratedHighRow.performed_movement_identity.id,
  highRowHammerPlate.id,
  'A manufacturer-plus-type identity must survive a DEV logger remount.',
);
resetRememberedWorkoutDetailEquipmentSelections();

const detailedLegacyIdentity = {
  ...primeSelectorized,
  id: 123456789,
  key: 'legacy-prime-incline-at-iron-house',
  display_name: 'Prime Incline Chest Press at Iron House',
  family_id: 991100,
  family_display_name: 'Incline Chest Press',
  equipment_model: {
    id: 991102,
    key: 'prime-incline-specific-model',
    display_name: 'Prime Incline Chest Press',
  },
  material_parameters: {
    note: 'Seat 4 at Iron House',
    custom_manufacturer_name: 'Prime',
  },
  implementation_key: 'iron-house:prime:incline:seat-4',
};
assert.equal(
  workoutDetailEquipmentIdentityKey(detailedLegacyIdentity),
  workoutDetailEquipmentIdentityKey(primeSelectorized),
  'Model, movement, location, and notes must not affect equipment comparison.',
);
const normalizedLegacySelection = applyWorkoutDetailMachineIdentity(
  cleared,
  detailedLegacyIdentity.id,
  detailedLegacyIdentity,
);
assert.equal(
  normalizedLegacySelection.performed_movement_identity.id,
  primeSelectorized.id,
  'Detailed mock identities must normalize to manufacturer plus type.',
);
assert.equal(normalizedLegacySelection.performed_movement_identity.equipment_model, null);
assert.equal(normalizedLegacySelection.performed_movement_identity.material_parameters, null);
assert.equal(normalizedLegacySelection.performed_movement_identity.family_id, null);
assert.equal(
  normalizedLegacySelection.movement_history.most_recent_logged_set.weight_kg,
  180 * 0.45359237,
  'History must resolve without requiring an exact machine model.',
);

const savedPrimeSnapshot = equipmentSnapshotForSet(
  selectedPrime.performed_movement_identity,
);
const changedToHammer = applyWorkoutDetailMachineIdentity(
  selectedPrime,
  machine.performed_movement_identity.id,
);
assert.equal(
  savedPrimeSnapshot.performed_movement_definition_id,
  primeSelectorized.id,
  'A saved set snapshot must retain the equipment active when it was logged.',
);
assert.equal(
  savedPrimeSnapshot.equipment_model_id,
  null,
  'DEV set evidence must not snapshot an exact machine model.',
);
assert.equal(
  savedPrimeSnapshot.implementation_key_snapshot,
  workoutDetailEquipmentIdentityKey(primeSelectorized),
  'DEV set evidence must snapshot only the manufacturer-plus-type key.',
);
assert.notEqual(
  savedPrimeSnapshot.performed_movement_definition_id,
  changedToHammer.performed_movement_identity.id,
  'Changing equipment may affect future logs only.',
);

assert.match(
  routeSource,
  /machineAccessory \? \([\s\S]*?>Equipment<\/Text>/,
  'Machine accessories must expose the Equipment action.',
);
assert.match(
  routeSource,
  /needsEquipmentSelection\(item\)[\s\S]*kind: 'accessory_set'/,
  'Log Set must gate unresolved machine equipment.',
);
assert.match(
  routeSource,
  /kind: 'group_round'[\s\S]*groupLabel: group\.group[\s\S]*roundIndex/,
  'Grouped logging must retain its exact continuation when equipment is missing.',
);
assert.match(
  routeSource,
  /resumeAfterEquipmentSelection[\s\S]*openAccessoryWheel\(nextItem, true\)[\s\S]*openSupersetRoundLogger\(group, continuation\.roundIndex\)/,
  'Selection must continue directly into the interrupted logger flow.',
);
assert.match(
  routeSource,
  /setIdentityPickerManufacturer\(identity\)[\s\S]*Which version are you using\?[\s\S]*MACHINE_EQUIPMENT_TYPES\.map[\s\S]*chooseEquipmentVariant\(variant\.key\)/,
  'DEV selection must move directly from manufacturer to the lightweight variant picker.',
);
assert.match(
  routeSource,
  /workoutDetailMachineVariantIdentity\([\s\S]*identityPickerManufacturer,[\s\S]*variant,[\s\S]*\)[\s\S]*commitPerformedIdentity\(identity\)/,
  'Manufacturer plus variant must resolve before the exact identity is committed.',
);
assert.doesNotMatch(
  routeSource,
  /Save Equipment|Confirm Equipment/,
  'Variant selection must not add a confirmation action.',
);
assert.match(
  routeSource,
  /equipmentSnapshotForSet\(activeEquipmentIdentity\(accessoryItem\)\)/,
  'DEV standard accessory logs must snapshot active equipment evidence.',
);
assert.match(
  routeSource,
  /equipmentSnapshotForSet\(activeEquipmentIdentity\(item\)\)/,
  'DEV grouped logs must snapshot each movement’s equipment evidence.',
);
assert.match(
  routeSource,
  /CURRENT EQUIPMENT[\s\S]*ManufacturerBrandMark/,
  'Expanded machine cards must expose their current equipment context.',
);
assert.match(
  routeSource,
  /Choose Manufacturer[\s\S]*CURRENT[\s\S]*USED BEFORE[\s\S]*NEVER USED[\s\S]*ManufacturerBrandMark compact manufacturerName=\{manufacturerName\}/,
  'Equipment choices must resolve local manufacturer branding through the shared component.',
);
assert.match(
  routeSource,
  /const initialRows = isIdealWorkoutDetailPreview[\s\S]*workoutDetailMachineIdentityChoices\([\s\S]*setIdentityPickerRows\(initialRows\)/,
  'The canonical picker must synchronously seed the complete registry before it opens.',
);
assert.match(
  routeSource,
  /!identityPickerLoading && identityPickerQuery\.trim\(\) && !identityPickerRows\.length[\s\S]*No manufacturers match/,
  'The canonical empty state must require a non-empty search query.',
);
assert.doesNotMatch(
  routeSource,
  /Other Equipment|Machine name or description|How to identify this machine|Use Equipment|customEquipment/,
  'The manufacturer picker must not retain the secondary custom-equipment workflow.',
);
assert.doesNotMatch(
  routeSource,
  /currentEquipmentLocation|current_location_match/,
  'The DEV equipment workflow must not render or prioritize gym-location context.',
);
assert.match(
  manufacturerSource,
  /MANUFACTURER_LOGO_ASSETS[\s\S]*resolveManufacturerBrand/,
  'Equipment selection must reuse the centralized manufacturer registry and asset catalog.',
);
assert.match(
  loggerSource,
  /activeSecondaryActionRow[\s\S]*canonicalMovementCard \? auxAction[\s\S]*>History</,
  'Equipment and History must share the canonical logger secondary action row.',
);
assert.doesNotMatch(
  routeSource,
  /const EQUIPMENT_MANUFACTURER_REGISTRY|const MACHINE_LOGO_REGISTRY/,
  'The Equipment workflow must not introduce a duplicate manufacturer registry.',
);

console.log('Equipment selection checks passed.');
