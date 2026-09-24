import assert from 'node:assert/strict';
import { validateReleaseHoldbacks } from './release-holdback-policy.mjs';
const source = 'a'.repeat(40), blob = 'b'.repeat(40), candidate = 'c'.repeat(40);
const policy = { sourceCommit: source, reason: 'Retain shipped catalog until separately validated backend migration.', files: [{path:'lib/catalog.ts',blob}] };
const git = (...args) => args[0] === 'merge-base' ? '' : blob;
assert.deepEqual([...validateReleaseHoldbacks(policy, candidate, git)], ['lib/catalog.ts']);
assert.equal(validateReleaseHoldbacks(null, candidate, git).size, 0);
const absent = {...policy, files: [{path:'scripts/held-dev-feature.mjs',blob:null}]};
assert.equal(validateReleaseHoldbacks(absent,candidate,(...args)=>{if(args[0]==='cat-file')throw Error('absent');return '';}).size,1);
assert.throws(()=>validateReleaseHoldbacks(absent,candidate,git),/absent from the shipped baseline/);
for (const bad of [{...policy,reason:''},{...policy,sourceCommit:'unknown'},
  {...policy,files:[...policy.files,...policy.files]},
  {...policy,files:[{path:'../escape',blob}]}]) assert.throws(() => validateReleaseHoldbacks(bad,candidate,git));
assert.throws(() => validateReleaseHoldbacks(policy,candidate,() => { throw Error('source is not an ancestor'); }));
assert.throws(() => validateReleaseHoldbacks(policy,candidate,(...args) => args[0] === 'merge-base' ? '' : args[1].startsWith(source) ? 'd'.repeat(40) : blob), /provenance/);
assert.throws(() => validateReleaseHoldbacks(policy,candidate,(...args) => args[0] === 'merge-base' ? '' : args[1].startsWith(candidate) ? 'd'.repeat(40) : blob), /exact shipped bytes/);
console.log('Release holdbacks: exact prior shipped blobs and ancestor required; arbitrary product changes rejected');
