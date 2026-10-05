import assert from 'node:assert/strict';
import { validateReleaseHoldbacks, validateDevReleaseHoldbacks, applySharedReleaseFix } from './release-holdback-policy.mjs';
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
const before = 'if (Number.isNaN(weightInUnit) || weightInUnit <= 0)';
const after = 'if (!Number.isFinite(weightInUnit) || weightInUnit < 0)';
const shared = { devSourceCommit: source, before, after };
assert.equal(applySharedReleaseFix(`start ${before} end`, shared), `start ${after} end`);
assert.throws(() => applySharedReleaseFix('does not contain the approved fix', shared), /exactly once/);
assert.throws(() => applySharedReleaseFix(`${before} ${before}`, shared), /exactly once/);
const projected = {...policy, files:[{path:'app/logger.tsx', blob, sharedFix:shared, devSha256:'dev-fixed', candidateSha256:'shipped-fixed'}]};
const projectionGit = (...args) => args[0] === 'merge-base' ? '' : args[0] === 'show'
  ? args[1].startsWith(candidate) ? `shipped ${after}` : `shipped ${before}` : blob;
const devGit = (...args) => args[1].startsWith('HEAD:') ? `pending ${after}` : `pending ${before}`;
assert.equal(validateDevReleaseHoldbacks(projected, {'app/logger.tsx':'shipped-fixed'}, {'app/logger.tsx':'dev-fixed'}, candidate, projectionGit, devGit).size, 1);
assert.throws(() => validateDevReleaseHoldbacks(projected, {'app/logger.tsx':'shipped-fixed'}, {'app/logger.tsx':'wrong-dev'}, candidate, projectionGit, devGit), /DEV changed/);
assert.throws(() => validateDevReleaseHoldbacks(projected, {'app/logger.tsx':'wrong-release'}, {'app/logger.tsx':'dev-fixed'}, candidate, projectionGit, devGit), /candidate changed/);
assert.throws(() => validateDevReleaseHoldbacks(projected, {'app/logger.tsx':'shipped-fixed'}, {'app/logger.tsx':'dev-fixed'}, candidate, projectionGit, () => 'lost zero fix'), /exactly once|identical shared fix/);
assert.throws(() => validateReleaseHoldbacks(projected, candidate, (...args) => args[0] === 'show' && args[1].startsWith(candidate) ? `shipped ${after} hidden change` : projectionGit(...args)), /only the exact shared fix/);
console.log('Shared client fix projections: exact shipped source + identical fix retained in DEV; stale hash, lost fix, duplicate patch and unrelated candidate changes all fail');
