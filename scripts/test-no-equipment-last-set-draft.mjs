import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');
const selection = fs.readFileSync('lib/equipment-selection.ts', 'utf8');
for (const source of [route, selection]) {
  assert.doesNotMatch(source, /Use last Set as a draft\?|offerEquipmentLastSetDraft|EquipmentLastSetDraft|equipmentLastSetDraft|equipmentDraftDisplayWeight/);
}
assert.match(route, /resumeAfterEquipmentSelection\(confirmedItem!, continuation, dataRef\.current \|\| undefined\)/,
  'confirmed equipment resumes the established Logger action directly');
assert.doesNotMatch(route, /equipmentPrefill|selectedDraft/,
  'neither accessory nor superset Logger may prefill from historical equipment evidence');
assert.match(route, /const restoredDraft = journal\?\.draft/,
  'the current Set journal remains available for interrupted logging');
assert.match(route, /presentEquipmentHistory\(identityPickerManufacturer/,
  'historical equipment evidence remains visible in the picker');
assert.match(route, /lastExposure|Last Exposure/i,
  'the intentional Last Exposure surface remains available');
console.log('No unsolicited historical Set draft; normal Logger and evidence surfaces preserved PASS');
