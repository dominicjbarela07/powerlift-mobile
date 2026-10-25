import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertAppleRetirementBaseline, retirementPaths, retirementInstruction} from './apple-retirement-release-scope.mjs';
import {assertClientFixScope} from './owner-directed-client-fix.mjs';
import {execFileSync} from 'node:child_process';
import {assertReviewedPublicationSource} from './reviewed-release-progression.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-apple-retirement-scope-'));
try {
  const write = (name, value) => {const bytes = JSON.stringify(value); fs.writeFileSync(path.join(root, name), bytes); return {path: name, sha256: sha(bytes)};};
  const baseline = {...Object.fromEntries(retirementPaths.map(p => [p, 'old'])), 'assets/approved.png': 'art', 'context/AuthContext.tsx': 'auth'};
  const publication = {id: 'actual-update', gitCommitHash: 'actual-source', servedBundleSha256: 'bundle'};
  const fingerprint = sha(JSON.stringify(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b))));
  const state = {verifiedProduction3Onboarding: {publication, publishedProof: {
    gateC: write('gate.json', {pass: true, missing: [], candidateProductFingerprint: fingerprint, published: publication}),
    assetAudit: write('audit.json', {pass: true, missingOrCorrupt: 0, updateId: publication.id, verified: 1, assets: [{hash: 'asset'}]}),
    exportSource: write('export.json', {candidateSha: publication.gitCommitHash, productFingerprint: fingerprint, bundle: {sha256: 'bundle'}, assetHashes: ['asset']}),
  }}};
  const scope = {scope: 'apple-sign-in-retirement-20261024', baselineUpdateId: publication.id, baselineSourceSha: publication.gitCommitHash,
    baselineProductFingerprint: fingerprint, baselineFiles: write('baseline.json', baseline), productFingerprint: 'candidate', validation: 'OWNER_DIRECTED_CONTRACTS_ONLY',
    ownerInstruction: retirementInstruction, changedProductFiles: Object.fromEntries(retirementPaths.map(p => [p, 'new'])), contracts: Object.fromEntries([
      'scripts/test-apple-retirement-release-scope.mjs', 'scripts/test-apple-sign-in-retirement.mjs', 'scripts/test-onboarding-recovery.mjs',
    ].map(p => [p, 'hash']))};
  const files = {...baseline, ...scope.changedProductFiles};
  const check = (candidate = files, candidateScope = scope) => assertAppleRetirementBaseline({root, scope: candidateScope, state, files: candidate});
  const changes = check();
  const owner = 'Continue with Apple: this removal supersedes the repair request. ' + retirementInstruction;
  assertClientFixScope(scope, 'candidate', changes, owner);
  for (const bad of [{...files, 'context/AuthContext.tsx': 'bypass'}, {...files, 'assets/approved.png': 'changed'}, {...files, 'lib/hidden.ts': 'added'}]) assert.throws(() => check(bad), /unrelated/);
  const lost = {...files}; delete lost['assets/approved.png']; assert.throws(() => check(lost), /remove published/);
  assert.throws(() => check(files, {...scope, baselineUpdateId: 'invented'}), /actual latest/);
  assert.throws(() => check(files, {...scope, baselineSourceSha: 'invented'}), /actual latest/);
  assert.throws(() => assertClientFixScope(scope, 'changed', changes, owner));
  assert.throws(() => assertClientFixScope(scope, 'candidate', changes, retirementInstruction));
  assert.throws(() => assertClientFixScope({...scope, contracts: {}}, 'candidate', changes, owner));
  assert.throws(() => assertClientFixScope({...scope, ownerInstruction: 'Fix Apple'}, 'candidate', changes, 'Fix Apple'));
} finally {fs.rmSync(root, {recursive: true, force: true});}
// Required pins remain immutable while exact owner-authorized source patches can
// progress. This exercises real Git provenance and rejects hidden extra bytes.
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-required-pin-'));
try {
  const git = (...args) => execFileSync('git', args, {cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  const before = '{"protected":"original required policy"}\n';
  const after = '{"protected":"original required policy","ownerRemoval":"Apple"}\n';
  fs.writeFileSync(path.join(repo, 'policy.json'), before);
  git('init'); git('add', 'policy.json'); git('-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', 'commit', '-m', 'Pinned policy fixture');
  fs.writeFileSync(path.join(repo, 'owner.txt'), retirementInstruction);
  fs.writeFileSync(path.join(repo, 'policy.json'), after);
  const row = {path: 'policy.json', sourceCommit: git('rev-parse', 'HEAD'), before: sha(before), after: sha(after),
    ownerInstruction: retirementInstruction, ownerEvidencePath: 'owner.txt', ownerEvidenceSha256: sha(retirementInstruction), changes: [{before, after}]};
  const state = {reviewedPublication: {...row, requiredFiles: {'policy.json': sha(before)}, sourceProgressions: [row]}};
  assertReviewedPublicationSource(repo, state, {'policy.json': sha(after)});
  assert.equal(state.reviewedPublication.requiredFiles['policy.json'], sha(before));
  fs.appendFileSync(path.join(repo, 'policy.json'), 'hidden change');
  assert.throws(() => assertReviewedPublicationSource(repo, state, {'policy.json': sha(after)}));
  fs.writeFileSync(path.join(repo, 'policy.json'), after);
  assert.throws(() => assertReviewedPublicationSource(repo, {...state, reviewedPublication: {...state.reviewedPublication, sourceProgressions: []}}, {'policy.json': sha(after)}));
  row.before = sha('invented original');
  assert.throws(() => assertReviewedPublicationSource(repo, state, {'policy.json': sha(after)}));
} finally {fs.rmSync(repo, {recursive: true, force: true});}
console.log('PASS: Apple removal requires exact correction, source, complete verified 3.0 baseline, two paths and all contracts. Unrelated access/art changes, loss, stale source, old authorization and missing protection rejected.');
