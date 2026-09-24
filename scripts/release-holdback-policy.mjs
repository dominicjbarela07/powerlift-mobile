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
    assert.ok(row.path && !row.path.startsWith('/') && !row.path.split('/').includes('..'));
    assert.ok(!paths.has(row.path), 'holdbacks must be unique');
    if (row.blob === null) {
      assert.throws(() => git('cat-file', '-e', `${holdbacks.sourceCommit}:${row.path}`), 'an excluded DEV-only file must be absent from the shipped baseline');
      assert.throws(() => git('cat-file', '-e', `${candidate}:${row.path}`), 'an excluded DEV-only file must remain absent from the candidate');
    } else {
      assert.match(row.blob, /^[a-f0-9]{40}$/);
      assert.equal(git('rev-parse', `${holdbacks.sourceCommit}:${row.path}`), row.blob, 'holdback must match its shipped provenance');
      assert.equal(git('rev-parse', `${candidate}:${row.path}`), row.blob, 'holdback must retain exact shipped bytes');
    }
    paths.add(row.path);
  }
  return paths;
}
