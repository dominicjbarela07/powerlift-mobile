import assert from 'node:assert/strict';

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
      assert.throws(() => git('cat-file', '-e', `${source}:${row.path}`), 'an excluded DEV-only file must be absent from the shipped baseline');
      assert.throws(() => git('cat-file', '-e', `${candidate}:${row.path}`), 'an excluded DEV-only file must remain absent from the candidate');
    } else {
      assert.match(row.blob, /^[a-f0-9]{40}$/);
      if (row.sharedFix) {
        assert.match(row.sharedFix.devSourceCommit, /^[a-f0-9]{40}$/);
        const before = git('show', `${source}:${row.path}`);
        assert.equal(applySharedReleaseFix(before, row.sharedFix), git('show', `${candidate}:${row.path}`), 'holdback must contain only the exact shared fix on shipped source');
      } else {
        assert.equal(git('rev-parse', `${source}:${row.path}`), row.blob, 'holdback must match its shipped provenance');
      }
      assert.equal(git('rev-parse', `${candidate}:${row.path}`), row.blob, 'holdback must retain exact shipped bytes');
    }
    paths.add(row.path);
  }
  return paths;
}

export function applySharedReleaseFix(source, fix) {
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
    assert.equal(candidateFiles[row.path], row.candidateSha256, 'holdback candidate changed');
    assert.equal(devFiles[row.path], row.devSha256, 'holdback DEV changed');
    if (row.sharedFix) {
      const base = devGit('show', `${row.sharedFix.devSourceCommit}:${row.path}`);
      assert.equal(applySharedReleaseFix(base, row.sharedFix), devGit('show', `HEAD:${row.path}`), 'canonical DEV must contain the identical shared fix without losing its pending feature');
    }
    assert.ok(held.has(row.path));
    proven.add(row.path);
  }
  return proven;
}
