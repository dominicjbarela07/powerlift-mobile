import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeCurrentWorkoutItem as current, normalizeSessionMovementResponse as response } from '../lib/current-session-movement.ts';
import { canonicalArtworkInputForLoggerItem as subject, resolveLoggerMovementIdentity as logger } from '../lib/logger-movement-identity.ts';
import { resolveCanonicalMovementArtwork as art } from '../lib/canonical-movement-artwork.ts';
import { resolveMovementHistoryLaunchForItem as history } from '../lib/movement-history-launch.ts';
import { isMachineAccessoryItem as machine } from '../lib/equipment-selection.ts';
const catalog = JSON.parse(fs.readFileSync('config/governed-movement-art-taxonomy.json','utf8')).movements;
const semantics = row => ({id: row.movement_definition_id, subject: subject(row), art: art(subject(row)), history: history({athleteId: 7,item: row}), equipment: machine(row), title: logger(row).displayName});
for (const d of catalog) {
  const stale = catalog.find(x => x.id !== d.id && x.kind === d.kind);
  const raw = { id: 9001, movement_identity_contract: 1, movement_definition_id: d.id,
    movement_identity: null, effective_movement_definition_id: stale.id, effective_movement_identity: stale,
    performed_canonical_movement_definition_id: stale.id, performed_canonical_movement_identity: stale,
    movement: 'Stale display text', is_substituted: true, lift: d.kind === 'core' ? 'VR' : 'AX', variant: d.kind === 'core' ? 'STRAIGHT' : 'ACC' };
  const initial = response({workout: {core_items: [],accessory_groups:[{items:[raw]}]}}).workout.accessory_groups[0].items[0];
  const swap = response({item: {...raw, movement_identity:d, effective_movement_definition_id:d.id, effective_movement_identity:d}}).item;
  assert.equal(initial.movement_definition_id,d.id,d.key);
  assert.deepEqual(semantics(initial),semantics(swap),`${d.key}: X to X must change nothing`);
  assert.notEqual(art(subject(initial)).kind,'neutral',`${d.key}: governed current identity cannot be ?`);
  assert.deepEqual(current(initial),initial,`${d.key}: normalization idempotent`);
  const changed = current({...initial,movement_definition_id:stale.id});
  assert.equal(changed.movement_identity.id,stale.id);
  assert.equal(changed.movement_identity.key,stale.key);
  assert.equal(raw.movement_identity,null,'normalization is pure');
}
const machineTriceps = {id:60001,key:'custom_machine_overhead_triceps',display_name:'Machine Overhead Triceps Extension',primary_muscle_group:'triceps',equipment_type:'machine'};
const cableTriceps = catalog.find(d => d.key === 'accessory_cable_overhead_triceps_extension');
const witness = current({movement_identity_contract:1,movement_definition_id:machineTriceps.id,movement_identity:machineTriceps,effective_movement_identity:cableTriceps,performed_canonical_movement_identity:cableTriceps});
assert.equal(logger(witness).effective.id,machineTriceps.id);
assert.equal(history({athleteId:7,item:witness}).target.movementDefinitionId,machineTriceps.id);
assert.equal(machine(witness),true);
const log={performed_canonical_movement_definition_id:cableTriceps.id,performed_label_snapshot:'Historical cable'};
assert.deepEqual(response({workout:{core_items:[],accessory_groups:[{items:[{...witness,set_logs:[log]}]}]}}).workout.accessory_groups[0].items[0].set_logs,[log]);
assert.equal(current({movement_identity_contract:1,movement_definition_id:null,effective_movement_identity:machineTriceps}).movement_definition_id,null);
console.log(`Single current ID: ${catalog.length} governed definitions; initial/Swap, stale aliases, real Swap, anatomy, equipment, history, immutable evidence PASS.`);

if (process.argv[2]) {
  const audit=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  let governed=0, repairs=0, unresolved=0;
  for (const row of audit.rows) {
    const initial=current({...row.stored,...row.initial,id:row.item_id,lift:row.lift,variant:row.variant});
    const equivalent=row.same_swap || row.same_swap_materialized;
    if (!equivalent || !initial.movement_definition_id) continue;
    const after=current({...row.stored,...equivalent,id:row.item_id,lift:row.lift,variant:row.variant});
    governed++;
    if (JSON.stringify(semantics(initial)) !== JSON.stringify(semantics(after))) repairs++;
    if (art(subject(initial)).kind === 'neutral') unresolved++;
  }
  console.log(JSON.stringify({actual_database_mobile_audit:true,governed,swap_would_repair:repairs,governed_unresolved_art:unresolved}));
  assert.equal(repairs,0); assert.equal(unresolved,0);
}
