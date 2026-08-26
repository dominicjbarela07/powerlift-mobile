#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(root, 'config', 'protected-fix-manifest.json'), 'utf8'));
const argValue = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const canonicalRef = argValue('--canonical-dev-ref')
  || process.env.STRENGTH_LEDGER_CANONICAL_DEV_REF
  || `refs/remotes/origin/${manifest.canonicalDevBranch}`;
const candidateRef = argValue('--candidate-ref') || 'HEAD';
const git = (...args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

const canonicalSha = git('rev-parse', '--verify', canonicalRef);
const candidateSha = git('rev-parse', '--verify', candidateRef);
const mergeBase = git('merge-base', canonicalSha, candidateSha);
const [behind, ahead] = git('rev-list', '--left-right', '--count', `${canonicalSha}...${candidateSha}`)
  .split(/\s+/)
  .map(Number);

assert.equal(mergeBase, canonicalSha, `release blocked: candidate ${candidateSha} does not descend from canonical DEV ${canonicalSha}`);
assert.equal(behind, 0, `release blocked: canonical DEV contains ${behind} commit(s) absent from the candidate`);

const allowedProjectionPaths = new Set(manifest.releaseProjectionPaths || []);
const candidateOnlyFiles = ahead > 0
  ? git('diff', '--name-only', `${canonicalSha}..${candidateSha}`).split('\n').filter(Boolean)
  : [];
const illegalCandidateFiles = candidateOnlyFiles.filter((file) => !allowedProjectionPaths.has(file));
assert.deepEqual(illegalCandidateFiles, [], `release blocked: candidate-only product changes are forbidden (${illegalCandidateFiles.join(', ')})`);

for (const fix of manifest.protectedFixes || []) {
  const acceptedCommits = fix.acceptedCommits || [];
  assert.ok(acceptedCommits.length, `${fix.id} has no accepted commit provenance`);
  for (const commit of acceptedCommits) {
    assert.doesNotThrow(
      () => git('merge-base', '--is-ancestor', commit, candidateSha),
      `release blocked: ${fix.id} lost accepted commit ${commit}`,
    );
  }
  for (const testPath of fix.behaviorTests || []) {
    assert.ok(existsSync(path.join(root, testPath)), `${fix.id} lost behavioral guard ${testPath}`);
  }
}

console.log(`[release-source-lineage] canonical DEV ${canonicalSha}`);
console.log(`[release-source-lineage] candidate ${candidateSha}`);
console.log(`[release-source-lineage] merge-base ${mergeBase}; ahead=${ahead} behind=${behind}`);
console.log(`[release-source-lineage] candidate-only files: ${candidateOnlyFiles.join(', ') || 'none'}`);
console.log(`[release-source-lineage] protected fixes: ${manifest.protectedFixes.length}/${manifest.protectedFixes.length}`);
