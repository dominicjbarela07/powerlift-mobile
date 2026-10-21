import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import { normalizeCurrentWorkoutItem } from '../lib/current-session-movement.ts';
import { canonicalArtworkInputFromDefinition } from '../lib/canonical-movement-art-subject.ts';
import { canonicalArtworkInputForLoggerItem } from '../lib/logger-movement-identity.ts';
import { resolveApprovedExactMovementArtwork as approved } from '../lib/movement-artwork-hero.ts';
import { governedCoreChoices } from '../lib/governed-movement-classes.ts';

const read = file => JSON.parse(fs.readFileSync(file));
const catalog = read('config/governed-movement-art-taxonomy.json').movements;
const live = read('docs/validation/rdl-artwork-2026-10-21/live-rdl-input.json');
const liveCore = read('docs/validation/rdl-artwork-2026-10-21/live-core-inventory.json');
const policy = read('artwork-review/runtime-policy.json');
const unchanged = structuredClone(live);
const rdl = approved(canonicalArtworkInputForLoggerItem(live), true);
assert.equal(rdl?.key, 'accessory_romanian_deadlift', 'actual Production RDL must retain its original approved exact art');
assert.equal(rdl.movement_definition_id, live.movement_definition_id, 'artwork never substitutes DEV identity for the server movement');
assert.equal(rdl.app_sha256, 'b40bd7faf76a792a368b59765ef5662ac35a1a012ac609a4c5e233b484033b14');
assert.deepEqual(live, unchanged, 'read-only artwork resolution preserves server evidence');

let definitions = 0, relocated = 0, collisions = 0, liveCoreCount = 0, coreOnly = 0;
// Execute the actual presentation adapters, including JSX inputs. A resolver
// test cannot catch a consumer that silently drops its stable catalog key.
const injectDroppedKey = process.argv.includes('--inject-dropped-core-key');
const parse = file => {
  const source = fs.readFileSync(file, 'utf8');
  return ts.createSourceFile(file, injectDroppedKey ? source.replace(/key: movement.key,/g, '') : source,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
};
const run = (source, context) => vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const variants = parse('components/ledger/VariantsExperience.tsx');
const variantFn = variants.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'variantArtwork');
assert.ok(variantFn);
const variantArtwork = run(variantFn.getText(variants) + '\nvariantArtwork;', {});
const jsxInputs = [];
for (const [file, surface] of [
  ['app/(tabs)/workout/session-workspace/[workoutId].tsx', 'session-workspace-core-search'],
  ['components/coach-mobile/athlete-workspace/CoachAthletePerformance.tsx', 'CoachAthletePerformance'],
]) {
  const ast = parse(file);
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'CanonicalMovementArtwork') {
      const props = node.attributes.properties;
      if (props.some(prop => prop.name?.getText(ast) === 'surface' && prop.initializer?.text === surface)) {
        const input = props.find(prop => prop.name?.getText(ast) === 'movement');
        assert.ok(input?.initializer && ts.isJsxExpression(input.initializer));
        const expression = input.initializer.expression.getText(ast);
        if (expression.includes('core_movement')) jsxInputs.push({ surface, expression });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
assert.equal(jsxInputs.length, 3, 'cover both Core picker classes and coach variant history');
function check(definition, expected, id, coreId) {
  const identity = { ...definition, id, ownership_scope: 'global', core_movement_definition_id: coreId };
  const item = { movement_identity_contract: 1, movement_definition_id: id, movement_identity: identity,
    lift: 'AX', variant: 'ACC', mode: 'RIR',
    core_movement: coreId ? { id: coreId, key: definition.key, family: definition.family, kind: definition.core_kind } : null };
  const normalized = normalizeCurrentWorkoutItem(item);
  assert.equal(normalized.movement_definition_id, id, definition.key);
  assert.equal(normalized.movement_identity.key, definition.key, 'an environment-local numeric collision cannot relabel a global definition');
  assert.equal(normalized.core_movement_id, coreId, 'the server owns Core IDs too');
  assert.deepEqual(normalizeCurrentWorkoutItem(normalized), normalized, 'normalization is idempotent');
  for (const input of [canonicalArtworkInputForLoggerItem(item), canonicalArtworkInputForLoggerItem(normalized), canonicalArtworkInputFromDefinition(identity)]) {
    const art = approved(input, true);
    assert.equal(art?.key, expected.key, `${definition.key}: relocated definition must retain the approved image`);
    assert.equal(art.app_sha256, expected.app_sha256, 'no new image or substitution');
    assert.equal(art.candidate_id, expected.candidate_id, 'retain original human receipt');
    assert.deepEqual(art.logger_crop, expected.logger_crop, 'retain original governed crop');
    assert.deepEqual(art.presentation, expected.presentation, 'retain original placement');
    assert.equal(art.movement_definition_id, id, 'retain environment-owned physical movement ID');
    assert.equal(approved(input, true, { ...policy, denied_keys: [...policy.denied_keys, art.key] }), null);
    assert.equal(approved(input, true, { ...policy, approved_exact_artwork: [] }), null);
  }
  const privateItem = { ...item, movement_identity: { ...identity, kind: 'custom', ownership_scope: 'coach' } };
  assert.equal(approved(canonicalArtworkInputForLoggerItem(privateItem), true), null, 'private definitions cannot impersonate a public artwork key');
}
for (const definition of catalog) {
  const expected = approved(canonicalArtworkInputFromDefinition(definition), true);
  if (!expected) continue;
  definitions++;
  check(definition, expected, 1_000_000 + definition.id, definition.core_movement_definition_id ? 2_000_000 + definition.core_movement_definition_id : null);
  relocated++;
  const collision = catalog.find(row => row.id !== definition.id && row.key !== definition.key);
  check(definition, expected, collision.id, definition.core_movement_definition_id ? 3_000_000 + definition.core_movement_definition_id : null);
  collisions++;
  const deployed = liveCore.find(row => row.key === definition.key);
  if (deployed) {
    check(definition, expected, deployed.id, deployed.core_movement_definition_id);
    liveCoreCount++;
    const core = { id: deployed.core_movement_definition_id, key: definition.key, family: definition.family, kind: definition.core_kind };
    const choice = governedCoreChoices([{ movements: [{ core_movement_id: core.id, core_movement_key: core.key,
      core_movement_family: core.family, core_movement_kind: core.kind, movement_definition_id: deployed.id,
      display_name: definition.display_name }] }])[0];
    assert.equal(choice.core_movement_key, core.key, 'picker retains the actual stable key');
    const movement = { core_movement_id: core.id, key: core.key, family: core.family };
    const inputs = [{ core_movement: core }, canonicalArtworkInputFromDefinition(core),
      canonicalArtworkInputForLoggerItem({ id: -1, core_movement: core, lift: 'VR', variant: 'STRAIGHT' })];
    if (core.kind === 'variant') inputs.push(variantArtwork(movement));
    for (const adapter of jsxInputs) {
      if (adapter.surface === 'CoachAthletePerformance' && core.kind !== 'variant') continue;
      inputs.push(run('(' + adapter.expression + ');', { row: choice, movement }));
    }
    for (const input of inputs) {
      const art = approved(input, true);
      assert.equal(art?.key, expected.key, `${core.key}: actual Core-only consumer must retain approved artwork`);
      assert.equal(art.app_sha256, expected.app_sha256);
      assert.deepEqual(art.logger_crop, expected.logger_crop);
      assert.equal(art.movement_definition_id, undefined, 'Core-only presentation cannot invent a DEV physical definition ID');
    }
    coreOnly++;
  }
}
assert.equal(liveCoreCount, liveCore.length, 'audit every actually deployed Core definition, not RDL alone');
assert.ok(definitions > 400, 'audit complete governed approved inventory');
const unowned = { ...live, movement_identity: { ...live.movement_identity, ownership_scope: undefined } };
assert.equal(approved(canonicalArtworkInputForLoggerItem(unowned), true), null, 'unproven foreign identity remains closed');
const conflict = { ...live, core_movement: { ...live.core_movement, key: 'competition_squat' } };
assert.equal(approved(canonicalArtworkInputForLoggerItem(conflict), true), null, 'contradictory typed Core identity never borrows art');
if (!injectDroppedKey) {
  const negative = spawnSync(process.execPath, ['--import', 'tsx', process.argv[1], '--inject-dropped-core-key'], { encoding: 'utf8' });
  assert.ok(negative.status > 0, 'release protection must reject a deliberately dropped consumer key');
  assert.match(negative.stderr, /actual Core-only consumer must retain approved artwork/);
}
console.log('PASS: ' + JSON.stringify({ pass: true, approved_definitions: definitions, relocated, numeric_collisions: collisions,
  actual_production_core_definitions: liveCoreCount, original_rdl_image_sha256: rdl.app_sha256,
  actual_core_only_consumers: coreOnly, executed_jsx_artwork_adapters: jsxInputs.length,
  dropped_consumer_key_failure_tested: true, private_impersonation_rejected: true, deny_and_missing_approval_rejected: true }));
