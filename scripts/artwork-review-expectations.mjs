import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CANONICAL_ACCESSORY_ARTWORK_IDENTITIES } from '../lib/canonical-accessory-artwork-identities.ts';
import { approvedArtRuntimeEnabled } from '../lib/approved-art-runtime.ts';
import { resolveApprovedExactMovementArtwork } from '../lib/movement-artwork-hero.ts';
const read=file=>JSON.parse(fs.readFileSync(new URL(`../${file}`,import.meta.url)));
const policy=read('artwork-review/runtime-policy.json');
const reuse=read('config/governed-movement-art-reuse.json');
const redirects=[...reuse.shared_artwork_identities,...reuse.legacy_artwork_identities];
// Historical byte/inventory audits remain fixed. Current owner withdrawals may
// remove their direct photograph; approved survivors are checked independently.
const registered=new Set(Object.values(CANONICAL_ACCESSORY_ARTWORK_IDENTITIES).map(row=>row.key));
export const expectedDirectArtworkKey=key=>!registered.has(key) || (approvedArtRuntimeEnabled() && policy.denied_keys.includes(key))?undefined:key;
export function assertReviewedArtworkReuse(input,id,key) {
 const binding=redirects.find(row=>row.movement_definition_id===id && row.key===key);
 const expected=policy.approved_exact_artwork.find(row=>row.key===(binding?.artwork_key||key));
 const actual=resolveApprovedExactMovementArtwork(input,true);
 assert.equal(actual?.candidate_id,expected?.candidate_id,`${id}: current exact owner-approved image`);
 if(actual){assert.equal(actual.app_sha256,expected.app_sha256);assert.equal(actual.movement_definition_id,id);}
}
