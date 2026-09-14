import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeCanonicalMovementArtSubject as subject } from '../lib/canonical-movement-art-subject.ts';
import { resolveCanonicalMovementArtwork as art } from '../lib/canonical-movement-artwork.ts';
import { resolveLoggerMovementIdentity as logger } from '../lib/logger-movement-identity.ts';
import { resolveMovementHistoryLaunchForItem as history } from '../lib/movement-history-launch.ts';

const catalog = JSON.parse(fs.readFileSync('config/governed-movement-art-taxonomy.json', 'utf8')).movements;
const semantic = row => {
  const s = subject(row);
  return Object.fromEntries(['domain', 'canonicalIdentityId', 'canonicalKey', 'family', 'primaryMuscleGroup',
    'secondaryMuscleGroups', 'equipmentType', 'coreFamily', 'coreVariant', 'reason'].map(key => [key, s[key]]));
};
let cases = 0;
for (const d of catalog) {
  if (d.kind === 'core') {
    const initial = { core_movement: { id: d.core_movement_definition_id, key: d.key, family: d.family, kind: d.core_kind } };
    assert.deepEqual(semantic(initial), semantic({ ...initial, performed_core_movement: initial.core_movement }));
    cases++;
    continue;
  }
  const base = { id: 987654, item_id: 987654, lift: 'AX', variant: 'ACC', is_substituted: false };
  const shapes = [
    { movement_definition_id: d.id, movement_identity: null },
    { effective_movement_definition_id: d.id, effective_movement_identity: { id: null } },
    { legacy: { state: 'legacy_unresolved', effective_movement_definition_id: d.id, effective_movement_identity: null } },
    { effective_movement_identity: {}, legacy: { effective_movement_definition_id: d.id } },
    { effective_movement_identity: { id: null, family: 'unknown', primary_muscle_group: null }, legacy: { effective_movement_definition_id: d.id } },
    { performed_canonical_movement_identity: { id: null }, effective_movement_identity: {}, movement_identity: d },
    { effective_movement_identity: {}, movement_identity: { key: d.key } },
    { effective_movement_identity: { id: null }, legacy: { effective_movement_definition_id: d.id, effective_movement_identity: d } },
  ];
  for (const shape of shapes) {
    const initial = { ...base, ...shape };
    const untouched = JSON.stringify(initial);
    const materialized = { ...initial, effective_movement_definition_id: d.id, effective_movement_identity: d,
      performed_canonical_movement_definition_id: d.id, performed_canonical_movement_identity: d };
    assert.deepEqual(semantic(initial), semantic(materialized), `${d.key}: initial/Swap subject`);
    assert.deepEqual(art(initial), art(materialized), `${d.key}: initial/Swap artwork`);
    assert.notEqual(art(initial).kind, 'neutral', d.key);
    assert.equal(logger(initial).effective?.id, d.id, `${d.key}: History/Logger initial subject`);
    assert.deepEqual(history({ athleteId: 4, item: initial }), history({ athleteId: 4, item: materialized }));
    assert.equal(JSON.stringify(initial), untouched, 'read normalization must not mutate API payload or materialize performed fields');
    cases++;
  }
}
for (const row of [
  { id: 178, movement: 'Machine Pullover', effective_movement_identity: {} },
  { is_substituted: true, legacy: { effective_movement_definition_id: 178 } },
  { effective_movement_identity: { id: 216, key: 'accessory_machine_pullover' } },
  { effective_movement_definition_id: 178, effective_movement_identity: { id: 216 } },
  { effective_movement_identity: { id: 178 }, performed_canonical_movement_identity: { id: 216 } },
  { performed_movement_identity: { id: 178, key: 'machine_equipment_178' } },
]) assert.equal(art(row).kind, 'neutral', JSON.stringify(row));
assert.equal(logger({ id: 1, effective_movement_identity: { id: 178 }, performed_canonical_movement_identity: { id: 216 } }).effective, null);
assert.equal(subject({ effective_movement_identity: {}, movement_identity: { id: 216 },
  sets: [{ performed_canonical_movement_definition_id: 178, primary_muscle_group_snapshot: 'lats', secondary_muscle_groups_snapshot: [] }] }).canonicalIdentityId, 178);
console.log(`Initial hydration / no-op Swap: ${catalog.length} definitions, ${cases} equivalence cases, 0 governed unresolved; immutable/conflict negatives PASS`);
