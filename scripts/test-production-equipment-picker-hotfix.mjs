import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const logger = readFileSync(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url), 'utf8');
const policy = readFileSync(new URL('../lib/equipment-selection.ts', import.meta.url), 'utf8');

assert.match(logger, /needsEquipmentSelection\(item\)/, 'Log Set must gate missing machine equipment.');
assert.match(logger, /equipment-manufacturers/, 'Picker must load canonical manufacturer choices.');
assert.match(logger, /items\/\$\{pickerItem\.id\}\/performed-identity/, 'Picker must persist performed identity.');
assert.match(logger, /manufacturer_key:\s*equipmentPickerManufacturer\.manufacturer\?\.key/, 'Manufacturer must be submitted by stable key.');
assert.match(logger, /equipment_type:\s*equipmentType/, 'Machine type must be persisted separately.');
assert.match(logger, /requestAnimationFrame\(\(\) => openAccessoryWheel\(nextItem, true\)\)/, 'Successful selection must continue into Set Logger.');
assert.match(logger, />Equipment<\/Text>/, 'Expanded movement must expose an Equipment action.');
assert.match(logger, /Sets already logged keep their original equipment identity/, 'Manual equipment changes must preserve logged evidence.');
assert.match(logger, /needsEquipmentSelection\(refreshedItem\)/, 'Movement replacement must re-evaluate equipment requirements.');
assert.match(
  logger,
  /visible=\{!!equipmentPickerItem\}[\s\S]*?<KeyboardAvoidingView[\s\S]*?behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
  'The Production machine-brand modal must resize above the iOS keyboard.',
);
assert.match(
  logger,
  /style=\{styles\.equipmentPickerList\}[\s\S]*?keyboardShouldPersistTaps="always"[\s\S]*?keyboardDismissMode=\{Platform\.OS === 'ios' \? 'interactive' : 'on-drag'\}/,
  'Filtered manufacturer rows must receive the first tap while the keyboard is visible.',
);
assert.match(
  logger,
  /const selectEquipmentManufacturer = \(row: EquipmentIdentityLike\) => \{[\s\S]*?setEquipmentPickerManufacturer\(row\);[\s\S]*?Keyboard\.dismiss\(\);[\s\S]*?\};/,
  'Manufacturer selection must commit on the row tap before dismissing the keyboard.',
);
assert.match(
  logger,
  /onPress=\{\(\) => selectEquipmentManufacturer\(row\)\}/,
  'Every filtered manufacturer row must use the one-tap selection path.',
);

assert.match(policy, /performed_movement_identity/, 'Performed identity must take precedence for equipment state.');
assert.match(policy, /movement_identity/, 'Programmed canonical identity must provide the fallback classification.');
assert.doesNotMatch(policy, /LEGACY_MACHINE_MOVEMENT_TERMS/, 'The Production gate must not guess machine identity from movement labels.');
assert.match(policy, /PORTABLE_TERMS/, 'Portable and bodyweight identities must bypass the machine picker.');
assert.match(policy, /identity_specificity === 'exact'/, 'Only exact configured machine identity may satisfy the gate.');

console.log('production equipment picker hotfix contract: PASS');
