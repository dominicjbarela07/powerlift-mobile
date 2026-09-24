import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export const invalidatedArtwork = (state, row) => Boolean(row && (state.artwork_invalidations || []).some(reset =>
  reset.movement_definition_ids.includes(row.movement_definition_id) && reset.invalidated_master_hashes.includes(row.files.master.sha256)));
const catalogExcluded = (state, row) => (state.catalog_exclusions || []).some(exclusion =>
  exclusion.movement_definition_id === row.movement_definition_id && exclusion.family === row.family);
export const consolidatedArtworkBinding = (state, row) => (state.consolidated_artwork_bindings || []).find(binding => {
  const receipt = binding.crop_approval;
  return binding.candidate_id === row.candidate_id && binding.artwork_movement_definition_id === row.movement_definition_id
    && binding.artwork_key === row.key && binding.master_sha256 === row.files.master.sha256
    && binding.app_sha256 === row.files.app.sha256 && binding.source === 'owner_consolidated_artwork_reuse'
    && typeof binding.owner_instruction === 'string' && binding.owner_instruction.trim().length > 0
    && receipt?.action === 'approve' && receipt.source === 'human_logger_crop_ui'
    && Number.isInteger(receipt.reviewer_user_id) && receipt.reviewer_user_id > 0
    && receipt.candidate_sha256 === binding.master_sha256 && receipt.app_sha256 === binding.app_sha256
    && state.logger_crop_reviews?.[row.candidate_id]?.history?.some(event => JSON.stringify(event) === JSON.stringify(receipt))
    && state.catalog_exclusions?.some(exclusion => exclusion.movement_definition_id === row.movement_definition_id
      && exclusion.replacement_movement_definition_id === binding.movement_definition_id);
});
const explicitOwnerChat = review => review?.source === 'explicit_owner_chat'
  && typeof review.owner_instruction === 'string' && review.owner_instruction.trim().length > 0
  && review.owner_instruction.trim().length <= 20000
  && typeof review.conversation_id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(review.conversation_id)
  && review.recorded_by === 'codex_at_owner_request';
const humanSource = review => (review?.source === 'human_review_ui'
  && Number.isInteger(review.reviewer_user_id) && review.reviewer_user_id > 0) || explicitOwnerChat(review);

export function approvedLoggerCropPolicy(state, item) {
  const row = state.logger_crop_reviews?.[item.candidate_id], receipt = row?.review;
  if (row?.status !== 'approved' || receipt?.action !== 'approve'
      || receipt?.source !== 'human_logger_crop_ui' || item.test_only
      || !Number.isInteger(receipt.reviewer_user_id) || receipt.reviewer_user_id <= 0
      || receipt.candidate_sha256 !== item.files.master.sha256 || receipt.app_sha256 !== item.files.app.sha256
      || JSON.stringify(receipt.crop) !== JSON.stringify(row.crop)
      || !row.history?.some(event => JSON.stringify(event) === JSON.stringify(receipt))) return null;
  const crop = row.crop;
  assert.deepEqual(Object.keys(crop).sort(), ['fit', 'x', 'y', 'zoom']);
  assert.ok(['original', 'contain', 'focal'].includes(crop.fit));
  for (const [key, low, high] of [['zoom', .5, 1.6], ['x', -.5, .5], ['y', -.5, .5]]) {
    assert.ok(Number.isFinite(crop[key]) && crop[key] >= low && crop[key] <= high, 'bounded Logger crop');
  }
  return crop;
}

export function approvedExactArtworkPolicy(state) {
  return state.canonical_assets.flatMap(active => {
    const row = state.items.find(candidate => candidate.candidate_id === active.candidate_id);
    if (invalidatedArtwork(state, row) || (row && catalogExcluded(state, row) && !consolidatedArtworkBinding(state, row))) return [];
    const review = row?.review;
    const human = row?.status === 'approved' && review?.decision === 'approved'
      && humanSource(review)
      && row.review_history.some(event => JSON.stringify(event) === JSON.stringify(review));
    const prior = row?.status === 'approved_existing' && review?.decision === 'approved_existing'
      && review.source === 'documented_prior_user_approval';
    if ((!human && !prior) || !row || row.test_only || !['approved', 'approved_existing'].includes(row.status)
        || row.human_approved !== true || row.review?.candidate_sha256 !== row.files.master.sha256
        || !['master', 'app', 'thumbnail'].every(role => active.files[role].sha256 === row.files[role].sha256)) return [];
    const loggerCrop = approvedLoggerCropPolicy(state, row);
    if (['canonical_core_sbd', 'canonical_core_variants'].includes(row.family) && !loggerCrop) return [];
    return [{ key: active.key, movement_definition_id: active.movement_definition_id,
      candidate_id: row.candidate_id, app_sha256: active.files.app.sha256,
      ...(row.presentation ? {presentation: row.presentation} : {}),
      ...(loggerCrop ? {logger_crop: loggerCrop} : {}) }];
  }).sort((a, b) => a.key.localeCompare(b.key));
}

export function assertHumanArtworkGate(root = defaultRoot) {
  root = fs.realpathSync(root);
  const reviewRoot = path.join(root, 'artwork-review');
  const state = JSON.parse(fs.readFileSync(path.join(reviewRoot, 'review-state.json'), 'utf8'));
  assert.equal(state.schema_version, 1);
  const candidates = new Map(state.items.map(row => [row.candidate_id, row]));
  assert.equal(candidates.size, state.items.length, 'unique candidate versions');
  const grandfathered = new Map(state.grandfathered_assets.map(row => [row.key, row]));
  const allowedPaths = new Set();
  const denied = [];
  const identities = fs.readFileSync(path.join(root, 'lib/canonical-accessory-artwork-identities.ts'), 'utf8');
  const coreIdentitiesPath = path.join(root, 'lib/canonical-core-artwork-identities.ts');
  const coreIdentities = fs.existsSync(coreIdentitiesPath) ? fs.readFileSync(coreIdentitiesPath, 'utf8') : '';
  const mapping = fs.readFileSync(path.join(root, 'lib/canonical-movement-artwork-assets.ts'), 'utf8');
  for (const active of state.canonical_assets) {
    const candidate = candidates.get(active.candidate_id);
    assert.ok(candidate && !candidate.test_only, 'canonical artwork must identify its non-QA candidate');
    assert.equal(active.key, candidate.key);
    assert.equal(active.movement_definition_id, candidate.movement_definition_id);
    const registry = ['canonical_core_sbd', 'canonical_core_variants'].includes(candidate.family) ? coreIdentities : identities;
    assert.ok(registry.includes(`${active.movement_definition_id}: { key: '${active.key}',`), 'numeric ID and key must remain governed');
    const prior = grandfathered.get(active.key);
    if (active.approval_source === 'preserved_existing_dev_backfill') {
      assert.deepEqual(active, prior, 'backfill exception permits only the exact pre-gate asset triples');
    } else {
      const approval = active.review;
      assert.equal(approval.decision, 'approved', 'pending/rejected images cannot be promoted');
      assert.equal(active.approval_source, approval.source);
      assert.ok(humanSource(approval), 'a UI decision or explicit owner message is required; QA cannot grant approval');
      assert.equal(approval.candidate_sha256, candidate.files.master.sha256);
      assert.ok(candidate.review_history.some(event => JSON.stringify(event) === JSON.stringify(approval)), 'promotion receipt must match a durable human decision');
    }
    const block = mapping.match(new RegExp(`^  ${active.key}: \\{([\\s\\S]*?)^  \\},`, 'm'))?.[1];
    assert.ok(block, 'each canonical identity needs its own mapping');
    for (const [property, role] of [['source', 'app']]) {
      assert.ok(block.includes(`${property}: require('@/${active.files[role].path}')`), 'canonical mapping must bind the correct identity and exact approved file');
    }
    if (invalidatedArtwork(state, candidate) || (catalogExcluded(state, candidate) && !consolidatedArtworkBinding(state, candidate)) || candidate.status === 'rejected' || (candidate.status === 'pending' && candidate.review_history.length)) denied.push(active.key);
    for (const role of ['master', 'app', 'thumbnail']) {
      const asset = active.files[role];
      const file = path.resolve(root, asset.path);
      assert.ok(fs.realpathSync(file).startsWith(path.join(root, 'assets/images/movement-artwork/')), 'canonical destination must stay outside candidate storage');
      assert.equal(hash(file), asset.sha256, `Unapproved canonical artwork change: ${active.key}/${role}. Register a candidate for human review.`);
      const candidateFile = path.resolve(reviewRoot, candidate.files[role].path);
      assert.ok(fs.realpathSync(candidateFile).startsWith(reviewRoot + path.sep));
      assert.equal(hash(candidateFile), candidate.files[role].sha256, 'reviewed candidate bytes are immutable');
      assert.equal(asset.sha256, candidate.files[role].sha256, 'mapped bytes must be the reviewed bytes');
      if (role === 'app') allowedPaths.add(asset.path);
    }
  }
  const mappedPaths = [...mapping.matchAll(/require\(['"]@\/(assets\/images\/movement-artwork\/[^'"]+)['"]\)/g)].map(match => match[1]);
  assert.equal(mappedPaths.length, state.canonical_assets.length, 'exactly one approved app image per governed runtime mapping');
  for (const file of mappedPaths) assert.ok(allowedPaths.has(file), `Unreviewed mapping: ${file}`);
  assert.ok(!mapping.includes('artwork-review/candidates'), 'candidate storage must never be bundled as canonical artwork');
  const policy = JSON.parse(fs.readFileSync(path.join(reviewRoot, 'runtime-policy.json'), 'utf8'));
  if (state.consolidated_artwork_bindings?.length) {
    const taxonomy = JSON.parse(fs.readFileSync(path.join(root, 'config/governed-movement-art-reuse.json'), 'utf8'));
    for (const binding of state.consolidated_artwork_bindings) {
      assert.ok(consolidatedArtworkBinding(state, candidates.get(binding.candidate_id)), 'reuse retains exact source image and crop approval');
      assert.ok(taxonomy.shared_artwork_identities.some(row => row.movement_definition_id === binding.movement_definition_id
        && row.key === binding.key && row.artwork_movement_definition_id === binding.artwork_movement_definition_id
        && row.artwork_key === binding.artwork_key), 'runtime artwork reuse must match governed catalog projection');
    }
  }
  assert.deepEqual(policy.denied_keys, [...new Set(denied)].sort(), 'runtime rejection policy must reflect durable human decisions');
  assert.deepEqual(policy.approved_exact_artwork, approvedExactArtworkPolicy(state), 'hero eligibility must match positive human approval of mapped bytes');
  return {canonical: state.canonical_assets.length, denied: denied.length};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('[human-artwork-gate] PASS', assertHumanArtworkGate());
}
