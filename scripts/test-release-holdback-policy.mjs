import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
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

const moreBefore = 'const visibleAction = oldTitleAction();';
const moreAfter = 'const visibleAction = inlineTitleAction();';
const cumulativeShared = {...shared, additionalChanges:[{before:moreBefore, after:moreAfter}]};
assert.equal(applySharedReleaseFix(`${before} ${moreBefore}`, cumulativeShared), `${after} ${moreAfter}`);
assert.throws(() => applySharedReleaseFix(`${before} ${moreBefore} ${moreBefore}`, cumulativeShared), /exactly once/);
assert.throws(() => applySharedReleaseFix(`${before} unrelated UI bytes`, cumulativeShared), /exactly once/);
assert.throws(() => applySharedReleaseFix(`${before} ${moreBefore}`, {...shared, additionalChanges:[]}), /exact patch list/);
console.log('Cumulative shared fixes retain identical exact patches in DEV and shipped projection; missing or duplicate UI patches fail.');

const originalRoot = process.cwd();
const proofRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-resumed-holdback-'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
try {
  process.chdir(proofRoot);
  fs.writeFileSync('owner.txt', 'Deploy the matching backend and prepare the new mobile release.');
  const dependency = JSON.stringify({ result: 'PASS', servingSourceSha: source });
  fs.writeFileSync('backend.json', dependency);
  const resolution = {
    before: hash(before), after: hash(after), changes: [{ before, after }],
    ownerEvidencePath: 'owner.txt', ownerEvidenceSha256: hash(fs.readFileSync('owner.txt')),
    ownerInstruction: 'Deploy the matching backend',
    reason: 'The owner authorized the new client after matching server deployment and compatibility validation.',
    backendEvidencePath: 'backend.json', backendEvidenceSha256: hash(dependency), backendSourceSha: source,
  };
  const resumed = { ...policy, files: [{ path: 'lib/catalog.ts', blob, resolution }] };
  const resumedGit = (...args) => args[0] === 'merge-base' ? '' : args[0] === 'show'
    ? args[1].startsWith(candidate) ? after : before : blob;
  assert.equal(validateReleaseHoldbacks(resumed, candidate, resumedGit).size, 1);
  assert.throws(() => validateReleaseHoldbacks(resumed, candidate, (...args) => args[0] === 'show' && args[1].startsWith(candidate) ? after + ' hidden change' : resumedGit(...args)), /every candidate byte/);
  assert.throws(() => validateReleaseHoldbacks(resumed, candidate, (...args) => args[0] === 'rev-parse' ? 'e'.repeat(40) : resumedGit(...args)), /original shipped provenance/);
  fs.writeFileSync('backend.json', JSON.stringify({ result: 'FAIL', servingSourceSha: source }));
  assert.throws(() => validateReleaseHoldbacks(resumed, candidate, resumedGit), /dependency evidence changed/);
  fs.writeFileSync('backend.json', dependency);
  const added = { ...absent, files: [{ path: 'new.ts', blob: null, resolution: { ...resolution, before: hash(''), addedSource: after } }] };
  const addedGit = (...args) => args[0] === 'show' ? after : '';
  assert.equal(validateReleaseHoldbacks(added, candidate, addedGit).size, 1);
  assert.throws(() => validateReleaseHoldbacks(added, candidate, (...args) => args[0] === 'ls-tree' ? 'new.ts' : addedGit(...args)), /absent from its original baseline/);
  const binary = Buffer.from([137, 80, 78, 71, 13, 10]);
  fs.writeFileSync('asset.png', binary);
  const image = { ...absent, files: [{ path: 'asset.png', blob: null, resolution: { ...resolution, before: hash(''), after: hash(binary), binarySource: true, binaryGitBlob: blob } }] };
  const binaryGit = (...args) => args[0] === 'rev-parse' ? blob : '';
  assert.equal(validateReleaseHoldbacks(image, candidate, binaryGit).size, 1);
  fs.appendFileSync('asset.png', 'changed');
  assert.throws(() => validateReleaseHoldbacks(image, candidate, binaryGit), /binary asset bytes changed/);
  console.log('Resolved holdbacks preserve original pins and ancestry, exact new source, owner scope and serving-backend evidence. Hidden changes and invalid dependency proof fail.');
} finally {
  process.chdir(originalRoot);
  fs.rmSync(proofRoot, { recursive: true, force: true });
}
