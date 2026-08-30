import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const logger = readFileSync(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url), 'utf8');

assert.match(
  logger,
  /visible=\{!!identityPickerItem\}[\s\S]*?<KeyboardAvoidingView[\s\S]*?behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/,
  'The machine-brand modal must resize its sheet above the iOS keyboard.',
);
assert.match(
  logger,
  /style=\{\[styles\.movementHistoryList, styles\.equipmentPickerList\]\}[\s\S]*?keyboardShouldPersistTaps="always"[\s\S]*?keyboardDismissMode=\{Platform\.OS === 'ios' \? 'interactive' : 'on-drag'\}/,
  'Filtered manufacturer rows must receive first taps while search remains focused.',
);
assert.match(
  logger,
  /const choosePerformedIdentity = async \(identity: GeneralMovementIdentity\) => \{[\s\S]*?setIdentityPickerManufacturer\(identity\);[\s\S]*?Keyboard\.dismiss\(\);[\s\S]*?\};/,
  'The selected canonical manufacturer must be committed before keyboard dismissal.',
);
assert.match(
  logger,
  /onPress=\{\(\) => void choosePerformedIdentity\(row\)\}/,
  'Every filtered manufacturer row must invoke the one-tap selection path.',
);
assert.match(
  logger,
  /<TouchableOpacity[\s\S]*?onPress=\{\(\) => void choosePerformedIdentity\(row\)\}/,
  'Manufacturer rows must retain immediate TouchableOpacity pressed feedback.',
);

console.log('machine brand keyboard selection contract: PASS');
