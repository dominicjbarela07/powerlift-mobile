import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { applySharedReleaseFix } from './release-holdback-policy.mjs';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
export function assertProgressionEvidence(root, row) {
  const evidence = fs.readFileSync(path.join(root, row.ownerEvidencePath), 'utf8');
  assert.equal(hash(evidence), row.ownerEvidenceSha256, 'reviewed progression owner evidence changed');
  assert.ok(row.ownerInstruction && evidence.includes(row.ownerInstruction), 'reviewed progression requires the exact owner instruction');
}
export function assertExactReleaseProgression(root, state, file, before, after) {
  const row = state.reviewedPublication?.sourceProgressions.find(row => row.path === file && row.before === hash(before) && row.after === hash(after));
  assert.ok(row, `unreviewed release source progression: ${file}`);
  assertProgressionEvidence(root, row);
  assert.equal(row.changes.reduce((source, change) => applySharedReleaseFix(source, change), before.toString()), after.toString(), `unreviewed bytes: ${file}`);
  return row;
}
export function assertReviewedPublicationSource(root, state, files) {
  const scope = state.reviewedPublication;
  if (!scope) return;
  assertProgressionEvidence(root, scope);
  for (const [file, expected] of Object.entries(scope.requiredFiles)) assert.equal(files[file], expected, `reviewed cumulative state disappeared or changed: ${file}`);
  for (const file of new Set(scope.sourceProgressions.map(row => row.path))) {
    const rows = scope.sourceProgressions.filter(row => row.path === file && row.after === files[file]);
    assert.ok(rows.length, `unreviewed cumulative source: ${file}`);
    for (const row of rows) {
      const before = execFileSync('git', ['show', `${row.sourceCommit}:${file}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
      assertExactReleaseProgression(root, state, file, before, fs.readFileSync(path.join(root, file)));
    }
  }
}
export function assertReviewedArtwork(root, state, policy) {
  const changes = state.reviewedPublication?.artworkChanges || [];
  const reviewed = read(root, 'artwork-review/review-state.json');
  for (const change of changes) {
    assertProgressionEvidence(root, change);
    const row = change.after;
    assert.equal(change.before?.movement_definition_id ?? row.movement_definition_id, row.movement_definition_id, 'approved crop cannot transfer movement ownership');
    if (change.before) assert.deepEqual({ ...row, logger_crop: change.before.logger_crop }, change.before, 'crop approval cannot replace artwork or ownership');
    const canonical = reviewed.canonical_assets.find(item => item.key === row.key && item.candidate_id === row.candidate_id);
    assert.ok(canonical && canonical.review.decision === 'approved', 'exact artwork approval is required');
    assert.deepEqual(canonical.review, change.sourceReview, 'source approval receipt changed');
    const crop = reviewed.logger_crop_reviews[row.candidate_id];
    assert.equal(crop.status, 'approved');
    assert.deepEqual(crop.review, change.cropReview, 'human crop receipt changed');
    assert.deepEqual(crop.crop, row.logger_crop);
    assert.equal(crop.review.app_sha256, row.app_sha256);
    assert.equal(hash(fs.readFileSync(path.join(root, canonical.files.app.path))), row.app_sha256, 'approved image bytes changed');
    assert.deepEqual(policy.approved_exact_artwork.find(item => item.key === row.key), row, 'reviewed artwork disappeared or changed');
  }
  for (const prior of state.approvedArtwork) {
    const change = changes.find(item => item.before?.key === prior.key);
    if (change) assert.deepEqual(change.before, prior, 'art progression must retain the original approval pin');
    assert.deepEqual(policy.approved_exact_artwork.find(item => item.key === prior.key), change?.after || prior, `unapproved artwork/crop change: ${prior.key}`);
  }
  const additions = policy.approved_exact_artwork.filter(row => !state.approvedArtwork.some(prior => prior.key === row.key));
  assert.deepEqual(additions, changes.filter(row => !row.before).map(row => row.after), 'every new exact artwork mapping requires its actual human approval');
}
export function assertReviewedCatalog(root, state, catalog) {
  const rows = [...catalog.movements, ...(catalog.compatibility_movements || [])];
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'canonical IDs cannot be duplicated');
  const historical = state.catalogIdentities;
  for (const [id, key] of historical) assert.equal(rows.find(row => row.id === id)?.key, key, 'protected movement identity disappeared or was reassigned');
  const additions = rows.filter(row => !historical.some(([id]) => id === row.id));
  assert.deepEqual(additions, state.reviewedPublication?.catalogAdditions || [], 'unapproved catalog addition or changed ownership');
  for (const row of additions) assert.ok(state.reviewedPublication.artworkChanges.some(change => !change.before && change.after.key === row.key && change.after.movement_definition_id === row.id), 'new canonical art identity must have the exact approved source');
  const snapshot = read(root, 'config/protected-testflight-catalog.json');
  for (const row of catalog.compatibility_movements || []) assert.deepEqual(row, snapshot.movements.find(item => item.id === row.id), 'historical compatibility metadata must remain exact');
}
