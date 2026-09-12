// Build/validation provenance only. Runtime identity selection never imports this.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const json = path => JSON.parse(fs.readFileSync(new URL(path, root)));
export const correctionDocument = 'docs/validation/head-gaze-audit-2026-09-11/';
export const artworkCorrections = json(correctionDocument + 'correction-manifest.json').movements;
const corrections = new Map(artworkCorrections.map(row => [row.id, row]));
const humanState = json('artwork-review/review-state.json');
assert.equal(corrections.size, artworkCorrections.length, 'one reviewed correction per governed ID');

// Historical manifests retain their original hashes. Only an exact reviewed
// old-to-new file transition is allowed, never a broad hash-check exception.
export function reviewedFreeWeightFiles(historicalAsset) {
  const correction = corrections.get(historicalAsset.id);
  const afterHistoricalCorrection = correction ? reviewedHeadCorrection(historicalAsset, correction) : historicalAsset.files;
  const promoted = humanState.canonical_assets.find(row => row.movement_definition_id === historicalAsset.id);
  if (promoted?.approval_source !== 'human_review_ui') return afterHistoricalCorrection;
  const original = humanState.grandfathered_assets.find(row => row.movement_definition_id === historicalAsset.id);
  assert.equal(promoted.key, historicalAsset.key);
  assert.deepEqual(original.files, afterHistoricalCorrection, 'human replacement retains the exact pre-gate source');
  const candidate = humanState.items.find(row => row.candidate_id === promoted.candidate_id);
  assert.equal(promoted.review.source, 'human_review_ui');
  assert.equal(promoted.review.decision, 'approved');
  assert.equal(promoted.review.candidate_sha256, candidate.files.master.sha256);
  assert.ok(candidate.review_history.some(row => JSON.stringify(row) === JSON.stringify(promoted.review)));
  return promoted.files;
}

function reviewedHeadCorrection(historicalAsset, correction) {
  assert.equal(correction.key, historicalAsset.key, 'correction cannot change identity');
  assert.deepEqual(correction.before_files, historicalAsset.files, 'correction must name the exact historical files');
  assert.equal(correction.review.status, 'ACCEPT');
  assert.ok(correction.review.reason);
  const attempt = json(correction.receipt);
  assert.equal(attempt.id, historicalAsset.id);
  assert.equal(attempt.attempt, correction.review.attempt);
  assert.ok(attempt.reference_paths[0].endsWith('/masters/dumbbell-incline-bench-press-v1.png'));
  for (const role of ['master', 'app', 'thumbnail']) {
    assert.equal(correction.files[role].path, historicalAsset.files[role].path, 'correction preserves consumer paths');
    assert.notEqual(correction.files[role].sha256, historicalAsset.files[role].sha256);
  }
  return correction.files;
}
