import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { normalizeCanonicalMovementArtSubject as subject, resolveCanonicalMovementArtwork as resolve } from '../lib/canonical-movement-artwork.ts';
import { canonicalArtworkInputForLoggerItem as logger } from '../lib/logger-movement-identity.ts';
import { resolveApprovedExactMovementArtwork as approved } from '../lib/movement-artwork-hero.ts';

const catalog = JSON.parse(fs.readFileSync('config/governed-movement-art-taxonomy.json', 'utf8')).movements;
assert.ok(catalog.length > 500, 'test the full governed catalog, not a hand-picked art family');
assert.equal(new Set(catalog.map(d => d.id)).size, catalog.length);
assert.equal(new Set(catalog.map(d => d.key)).size, catalog.length);
const counts = { approved_exact: 0, anatomy: 0, core_art: 0, unresolved: 0 };
let contracts = 0;
for (const d of catalog) {
  assert.ok(!d.key.startsWith('machine_equipment_'), 'equipment is never a movement definition');
  if (d.kind === 'core') {
    const result = resolve({ kind: 'core', core_movement_id: d.core_movement_definition_id });
    assert.equal(result.kind, d.core_kind === 'variant' ? 'core_variant' : 'core', d.key);
    assert.equal(result.family, d.family);
    counts.core_art++;
    continue;
  }
  const full = { kind: 'accessory', movement_definition_id: d.id, movement_identity: d };
  const expected = resolve(full);
  assert.equal(expected.kind, 'accessory', d.key);
  assert.ok(expected.regionKey && expected.regionKey !== 'full_body', d.key);
  counts[approved(full, true) ? 'approved_exact' : 'anatomy']++;
  const variants = [
    full,
    { kind: 'accessory', movement_definition_id: d.id },
    { effective_movement_definition_id: d.id },
    { performed_canonical_movement_definition_id: d.id },
    { effective_movement_identity: { id: d.id } },
    { performed_movement_identity: { id: d.id } },
    { movement_identity: { key: d.key } },
    { performed_canonical_movement_identity: { id: d.id }, movement_identity: d },
    { effective_movement_identity: { id: d.id }, movement_identity: d },
    { legacy: { state: 'legacy_unresolved', effective_movement_definition_id: d.id, effective_movement_identity: { id: d.id } } },
    { measurement: { canonical_identity_id: d.id } },
    { sets: [{ performed_canonical_movement_definition_id: d.id, identity_snapshot: { performed_canonical_movement_definition_id: d.id } }] },
    logger({ id: 987654, effective_movement_identity: { id: d.id }, movement_identity: d }),
  ];
  for (const [index, input] of variants.entries()) {
    const actual = resolve(input);
    assert.deepEqual(actual, expected, `${d.key}: lifecycle/thin contract ${index}`);
    const normalized = subject(input);
    assert.equal(normalized.canonicalKey, d.key);
    assert.equal(normalized.family, d.family);
    assert.equal(normalized.equipmentType, d.equipment_type);
    assert.deepEqual(resolve(input, () => true), Object.fromEntries(Object.entries(expected).filter(([k]) => k !== 'artworkKey')),
    `${d.key}: denied photography must retain anatomy`);
    contracts++;
  }
}
assert.equal(counts.unresolved, 0);

// Rich same-ID metadata remains useful even for a new governed definition absent from the bundled projection.
const future = { id: 1000100, key: 'future_governed_definition', family: 'accessory_lats', primary_muscle_group: 'lats', secondary_muscle_groups: ['biceps'], equipment_type: 'machine' };
const enriched = subject({ performed_canonical_movement_identity: { id: future.id }, movement_identity: future });
assert.equal(enriched.taxonomySource, 'matching_reference');
assert.equal(enriched.canonicalKey, future.key);
assert.equal(enriched.primaryMuscleGroup, 'lats');
assert.equal(resolve({ effective_movement_identity: { id: future.id + 1 }, movement_identity: future }).kind, 'neutral', 'never borrow programmed A taxonomy for B');
assert.equal(resolve({ movement_identity: { ...future, primary_muscle_group: 'invalid', family: 'accessory_lats' } }).regionKey, 'lats', 'invalid direct field cannot mask valid governed family');
assert.equal(resolve({ movement_identity: { id: future.id, primary_muscle_group: 'invalid', material_parameters: { accessory_taxonomy: { primary_muscle_group: 'rear_delts' } } } }).regionKey, 'rear_delts');
assert.equal(resolve({ kind: 'accessory', id: 216, movement: 'Chest-Supported Machine Row' }).kind, 'neutral', 'display names and ambiguous row IDs confer no governed identity');
assert.equal(resolve({ effective_movement_identity: { id: 216, key: 'accessory_machine_pullover' } }).kind, 'neutral', 'contradictory ID/key cannot borrow catalog taxonomy');
assert.equal(resolve({ effective_movement_identity: { id: 216, key: 'accessory_machine_pullover', primary_muscle_group: 'lats' } }).kind, 'neutral', 'taxonomy cannot excuse contradictory governed identity');
assert.equal(resolve({ performed_movement_identity: { id: 216, key: 'machine_equipment_216' } }).kind, 'neutral');
assert.equal(resolve({ movement_identity: { id: 33 }, performed_movement_identity: { id: 178 } }).canonicalIdentityId, 178, 'known older performed B outranks programmed A even without taxonomy');
assert.equal(resolve({ movement_identity: { id: 33 }, performed_movement_identity: { id: 178, key: 'accessory_chest_supported_machine_row' } }).kind, 'neutral', 'contradictory older performed identity cannot paint programmed A');
assert.equal(resolve({ kind: 'accessory', movement_definition_id: 1000999 }).kind, 'neutral', 'genuinely unresolved remains neutral');
const renderer = fs.readFileSync('components/movement/CanonicalMovementArtwork.tsx', 'utf8');
assert.match(renderer, /if \(!__DEV__ \|\| resolution.kind !== 'neutral'\) return/);
for (const field of ['movementDefinitionId', 'effectiveId', 'movementKey', 'family', 'primaryMuscle', 'taxonomyPresent', 'exactArtApproved', 'taxonomySource']) assert.ok(renderer.includes(field));
assert.match(renderer, /console.error\('\[movement-artwork\] INVARIANT/);

// The release harness supplies canonical DEV backend explicitly. Detect catalog
// additions/removals before shipping a stale projection; ordinary offline tests
// still exercise every checked-in governed definition.
const backend = process.env.STRENGTH_LEDGER_BACKEND_ROOT;
// A targeted TestFlight patch may deliberately retain its published catalog.
// Validate the entire frozen file against that release, rather than requiring
// unrelated DEV catalog migrations. Normal promotions still require DB parity.
const frozenTestFlightRef = process.env.STRENGTH_LEDGER_FROZEN_TESTFLIGHT_CATALOG_REF;
if (frozenTestFlightRef) {
  assert.ok(/^[a-f0-9]{40}$/.test(frozenTestFlightRef), 'frozen catalog requires an exact published release commit');
  const baseline = file => execFileSync('git', ['show', `${frozenTestFlightRef}:${file}`], { encoding: 'utf8' });
  const released = JSON.parse(baseline('app.json')).expo;
  const candidate = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  assert.equal(released.extra?.releaseTrack, 'testflight');
  assert.equal(candidate.extra?.releaseTrack, 'testflight');
  assert.equal(candidate.version, released.version, 'frozen catalog is limited to the existing TestFlight runtime');
  assert.equal(fs.readFileSync('config/governed-movement-art-taxonomy.json', 'utf8'),
    baseline('config/governed-movement-art-taxonomy.json'), 'targeted patch must preserve the published catalog byte-for-byte');
  console.log(`Frozen TestFlight catalog matches published release ${frozenTestFlightRef}`);
} else if (backend) {
  const result = spawnSync(path.join(backend, 'venv/bin/python'), [path.join(backend, 'scripts/export_movement_art_taxonomy.py'), '--check'], { cwd: backend, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, `${result.stdout || ''}${result.stderr || ''}`);
  const current = JSON.parse(fs.readFileSync(path.join(backend, 'powerlift_mobile/config/governed-movement-art-taxonomy.json'), 'utf8'));
  assert.deepEqual(current.movements, catalog, 'release projection must contain the current validated DEV catalog');
}
console.log(`Governed movement art: ${catalog.length} definitions, ${contracts} lifecycle contracts; ${JSON.stringify(counts)} PASS`);
