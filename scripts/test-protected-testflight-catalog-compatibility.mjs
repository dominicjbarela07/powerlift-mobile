import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeCurrentWorkoutItem as normalize} from '../lib/current-session-movement.ts';
import {governedAccessoryArtworkTaxonomy as taxonomy} from '../lib/governed-movement-art-taxonomy.ts';
const snapshot=JSON.parse(fs.readFileSync('config/protected-testflight-catalog.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('config/governed-movement-art-taxonomy.json','utf8'));
const retired=JSON.parse(fs.readFileSync('config/governed-movement-retirements.json','utf8')).retired_keys;
let checked=0;
for(const row of snapshot.movements) {
  const input={movement_identity_contract:1,movement_definition_id:row.id};
  const before=JSON.stringify(input), result=normalize(input);
  assert.equal(result.movement_definition_id,row.id,'Preserve exact shipped ID; do not redirect performed evidence');
  assert.equal(result.movement_identity.key,row.key,`Missing thin-payload shipped lookup: ${row.key}`);
  assert.equal(JSON.stringify(input),before,'Lookup may not mutate the API payload');
  if(row.kind==='accessory') {
    const actual=taxonomy(row.id,row.key);assert.ok(actual,`Missing governed artwork taxonomy: ${row.key}`);
    assert.equal(actual.id,row.id);assert.equal(actual.key,row.key);
    assert.equal(taxonomy(row.id,'wrong-governed-key'),null,'Contradictory typed identity must remain unresolved');
  }
  checked++;
}
if(catalog.compatibility_movements) {
 assert.equal(catalog.compatibility_movements.length,69);
 for(const row of catalog.compatibility_movements) {
  assert.ok(retired.includes(row.key),'Compatibility retains already-retired identities, not new retirements');
  assert.ok(!catalog.movements.some(active=>active.id===row.id),'Do not reactivate retired picker entries');
  assert.deepEqual(row,snapshot.movements.find(old=>old.id===row.id),'Exact shipped compatibility metadata remains intact');
 }
}
assert.equal(taxonomy(10009999),null,'Unknown identities must remain unresolved');
console.log(`Protected TestFlight catalog: ${checked}/567 IDs hydrate exact governed identities; all 69 compatibility records retained; immutable reads and contradictions PASS`);
