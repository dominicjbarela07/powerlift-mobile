import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** A release may retain pinned, already-shipped bytes while DEV awaits a
 * separate compatible backend/catalog release. It may not invent product code. */
export function validateReleaseHoldbacks(holdbacks, candidate, git) {
  if (!holdbacks) return new Set();
  assert.match(holdbacks.sourceCommit, /^[a-f0-9]{40}$/);
  assert.ok(holdbacks.reason?.trim().length > 30, 'holdbacks require a concrete release boundary');
  git('merge-base', '--is-ancestor', holdbacks.sourceCommit, candidate);
  const paths = new Set();
  for (const row of holdbacks.files) {
    const source = row.sourceCommit || holdbacks.sourceCommit;
    assert.match(source, /^[a-f0-9]{40}$/);
    git('merge-base', '--is-ancestor', source, candidate);
    assert.ok(row.path && !row.path.startsWith('/') && !row.path.split('/').includes('..'));
    assert.ok(!paths.has(row.path), 'holdbacks must be unique');
    if (row.blob === null) {
      assert.equal(git('ls-tree', '--name-only', source, '--', row.path).trim(), '', 'an excluded DEV-only file must be absent from the shipped baseline');
      assert.equal(git('ls-tree', '--name-only', candidate, '--', row.path).trim(), '', 'an excluded DEV-only file must remain absent from the candidate');
    } else {
      assert.match(row.blob, /^[a-f0-9]{40}$/);
      if (row.sharedFix) {
        assert.match(row.sharedFix.devSourceCommit, /^[a-f0-9]{40}$/);
        const before = git('show', `${source}:${row.path}`);
        assert.equal(applyPublicationProgression(applySharedReleaseFix(before, row.sharedFix), row.publicationProgression), git('show', `${candidate}:${row.path}`), 'holdback must contain only the exact shared fix and owner-authorized publication patch');
      } else {
        assert.equal(git('rev-parse', `${source}:${row.path}`), row.blob, 'holdback must match its shipped provenance');
      }
      if (row.publicationProgression) {
        const original = row.sharedFix ? applySharedReleaseFix(git('show', `${source}:${row.path}`), row.sharedFix) : git('show', `${source}:${row.path}`);
        assert.equal(applyPublicationProgression(original, row.publicationProgression), git('show', `${candidate}:${row.path}`), 'publication progression must prove all candidate bytes');
      } else assert.equal(git('rev-parse', `${candidate}:${row.path}`), row.blob, 'holdback must retain exact shipped bytes');
    }
    paths.add(row.path);
  }
  return paths;
}

export function applyPublicationProgression(source, progression, root=process.cwd()) {
  if (!progression) return source;
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const evidence = fs.readFileSync(path.join(root, progression.ownerEvidencePath), 'utf8');
  assert.equal(hash(evidence), progression.ownerEvidenceSha256);
  assert.ok(progression.ownerInstruction && evidence.includes(progression.ownerInstruction));
  assert.equal(hash(source), progression.before, 'publication patch must begin at the original held source');
  const after = progression.changes.reduce((value, change) => applySharedReleaseFix(value, change), source);
  assert.equal(hash(after), progression.after, 'publication patch must prove its exact endpoint');
  return after;
}

export function applySharedReleaseFix(source, fix) {
  if (fix.additionalChanges) {
    assert.ok(Array.isArray(fix.additionalChanges) && fix.additionalChanges.length > 0, 'additional shared changes require an exact patch list');
    const {additionalChanges, ...first} = fix;
    return additionalChanges.reduce((value, change) => applySharedReleaseFix(value, change), applySharedReleaseFix(source, first));
  }
  assert.ok(fix.before?.length > 20 && fix.after?.length > 20 && fix.before !== fix.after, 'shared fix requires an exact nonempty source change');
  assert.equal(source.split(fix.before).length, 2, 'shared fix must match exactly once');
  return source.replace(fix.before, fix.after);
}

/** A deferred, never-shipped backend feature is not missing from DEV: the
 * shipped file stays pinned, and the same small client fix must occur in both
 * versions. No arbitrary file/hash exemption is accepted. */
export function validateDevReleaseHoldbacks(holdbacks, candidateFiles, devFiles, candidate, git, devGit) {
  const held = validateReleaseHoldbacks(holdbacks, candidate, git);
  const proven = new Set();
  for (const row of holdbacks?.files || []) {
    if (!candidateFiles[row.path] || candidateFiles[row.path] === devFiles[row.path]) continue;
    assert.ok(devFiles[row.path], 'deferred feature must remain in canonical DEV');
    assert.ok(row.devSha256 && row.candidateSha256, 'divergent holdbacks require exact DEV and candidate hashes');
    assert.equal(candidateFiles[row.path], row.publicationProgression?.candidateSha256 || row.candidateSha256, 'holdback candidate changed');
    assert.equal(devFiles[row.path], row.devSha256, 'holdback DEV changed');
    if (row.sharedFix) {
      const base = devGit('show', `${row.sharedFix.devSourceCommit}:${row.path}`);
      let expected = applySharedReleaseFix(base, row.sharedFix);
      if (row.devOnlyProgression) {
        const progression = row.devOnlyProgression;
        assert.ok(progression.ownerInstruction && progression.ownerEvidenceSha256 && progression.reason?.length > 30);
        assert.equal(crypto.createHash('sha256').update(expected).digest('hex'), progression.before, 'DEV-only progression must start from the existing tested shared fix');
        assert.equal(progression.after, row.devSha256, 'DEV-only progression must own the new endpoint');
        expected = progression.changes.reduce((source, change) => applySharedReleaseFix(source, change), expected);
        assert.equal(crypto.createHash('sha256').update(expected).digest('hex'), progression.after, 'DEV-only progression must prove every new byte');
      }
      assert.equal(expected, devGit('show', `HEAD:${row.path}`), 'canonical DEV must contain the identical shared fix plus only exact reviewed DEV additions, preserving its pending feature');
    }
    assert.ok(held.has(row.path));
    proven.add(row.path);
  }
  return proven;
}
