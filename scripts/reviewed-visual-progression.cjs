const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

// Original visual registers stay intact. Each new design proves its complete
// source from a retained preimage and the owner's exact implementation scope.
module.exports = function reviewedVisualSource(root, file) {
  const review = JSON.parse(fs.readFileSync(path.join(root, 'config/testflight-release-3-1-20261111/visual-review.json'), 'utf8'));
  const row = review.rows.find(row => row.path === file);
  if (!row) return null;
  const evidence = fs.readFileSync(path.join(root, row.ownerEvidencePath), 'utf8');
  assert.equal(hash(evidence), row.ownerEvidenceSha256);
  assert.ok(evidence.includes(row.ownerInstruction) && row.reason.length > 30);
  assert.ok(row.beforePath.startsWith('config/testflight-release-') && !row.beforePath.split('/').includes('..'));
  let source = fs.readFileSync(path.join(root, row.beforePath), 'utf8');
  assert.equal(hash(source), row.before, 'Original visual review source changed');
  if (source === '' && typeof row.addedSource === 'string') source = row.addedSource;
  else for (const change of row.changes) {
    assert.ok(change.before.length > 20 && change.after.length > 20);
    assert.equal(source.split(change.before).length, 2, 'Visual patch must match exactly once');
    source = source.replace(change.before, change.after);
  }
  assert.equal(hash(source), row.after, 'Visual progression endpoint changed');
  assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), source, 'reviewed values changed in exact Self-Coach visual source');
  return source;
};
