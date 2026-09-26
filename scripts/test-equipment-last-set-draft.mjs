import assert from 'node:assert/strict';
import fs from 'node:fs';
import { equipmentLastSetDraft } from '../lib/equipment-selection.ts';

const record = {
  id: 111, workout_id: 40, date: '2026-09-16', performed_at: '2026-09-16T18:00:00',
  equipment: { id: 649, manufacturer: { id: 7 } },
  set_count: 3, best_set: { id: 123, weight_kg: 50, reps: 8, rir: 2 },
  last_set: { id: 124, weight_kg: 45.3592, reps: 12, rir: 1 },
};
const row = { manufacturer: { id: 7 }, equipment_context: {
  equipment_latest_exposures: { '649': record },
} };
assert.deepEqual(equipmentLastSetDraft([row], 649, 50), {
  equipmentDefinitionId: 649, weightKg: 45.3592, reps: 12, rir: 1, date: '2026-09-16',
});
assert.equal(equipmentLastSetDraft([row], 650, 50), null, 'no neighboring equipment history');
assert.equal(equipmentLastSetDraft([row], 649, 40), null, 'current Session cannot prefill from itself');
assert.equal(equipmentLastSetDraft([{...row, manufacturer: {id: 8}}], 649, 50), null,
  'manufacturer mismatch fails closed');
assert.equal(equipmentLastSetDraft([{...row, equipment_context: {
  equipment_latest_exposures: {'649': {...record, equipment: {id: 650, manufacturer: {id: 7}}}},
}}], 649, 50), null, 'record identity mismatch fails closed');
assert.equal(equipmentLastSetDraft([{...row, equipment_context: {
  equipment_latest_exposures: {'649': {...record, last_set: {...record.last_set, rir: null}}},
}}], 649, 50), null, 'RPE must not be presented as RIR');

const route = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');
assert.match(route, /offerEquipmentLastSetDraft\(confirmedItem!, continuation, evidenceRows/,
  'offer happens after the saved identity is confirmed');
assert.match(route, /onPress: \(\) => finish\(draft\)/, 'the athlete explicitly chooses the prefill');
assert.match(route, /openAccessoryWheel\(nextItem, true, draft\)/, 'the choice opens editable Logger inputs');
assert.doesNotMatch(route.slice(route.indexOf('const offerEquipmentLastSetDraft'),
  route.indexOf('const commitPerformedIdentity')), /queueAccessoryWheelLog|setPendingAccessoryLogItemId/,
  'offer does not submit a Set');
console.log('Exact-equipment last Set draft and editable, opt-in Logger offer PASS');
