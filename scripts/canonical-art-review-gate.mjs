import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

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
  const identities = fs.readFileSync(path.join(root, 'lib/canonical-movement-artwork.ts'), 'utf8');
  const mapping = fs.readFileSync(path.join(root, 'lib/canonical-movement-artwork-assets.ts'), 'utf8');
  for (const active of state.canonical_assets) {
    const candidate = candidates.get(active.candidate_id);
    assert.ok(candidate && !candidate.test_only, 'canonical artwork must identify its non-QA candidate');
    assert.equal(active.key, candidate.key);
    assert.equal(active.movement_definition_id, candidate.movement_definition_id);
    assert.ok(identities.includes(`${active.movement_definition_id}: { key: '${active.key}',`), 'numeric ID and key must remain governed');
    const prior = grandfathered.get(active.key);
    if (active.approval_source === 'preserved_existing_dev_backfill') {
      assert.deepEqual(active, prior, 'backfill exception permits only the exact pre-gate asset triples');
    } else {
      assert.equal(active.approval_source, 'human_review_ui');
      const approval = active.review;
      assert.equal(approval.decision, 'approved', 'pending/rejected images cannot be promoted');
      assert.equal(approval.source, 'human_review_ui', 'automation cannot grant approval');
      assert.ok(Number.isInteger(approval.reviewer_user_id) && approval.reviewer_user_id > 0);
      assert.equal(approval.candidate_sha256, candidate.files.master.sha256);
      assert.ok(candidate.review_history.some(event => JSON.stringify(event) === JSON.stringify(approval)), 'promotion receipt must match a durable human decision');
    }
    const block = mapping.match(new RegExp(`^  ${active.key}: \\{([\\s\\S]*?)^  \\},`, 'm'))?.[1];
    assert.ok(block, 'each canonical identity needs its own mapping');
    for (const [property, role] of [['source', 'app'], ['thumbnail', 'thumbnail']]) {
      assert.ok(block.includes(`${property}: require('@/${active.files[role].path}')`), 'canonical mapping must bind the correct identity and exact approved file');
    }
    if (candidate.status === 'rejected' || (candidate.status === 'pending' && candidate.review_history.length)) denied.push(active.key);
    for (const role of ['master', 'app', 'thumbnail']) {
      const asset = active.files[role];
      const file = path.resolve(root, asset.path);
      assert.ok(fs.realpathSync(file).startsWith(path.join(root, 'assets/images/movement-artwork/')), 'canonical destination must stay outside candidate storage');
      assert.equal(hash(file), asset.sha256, `Unapproved canonical artwork change: ${active.key}/${role}. Register a candidate for human review.`);
      const candidateFile = path.resolve(reviewRoot, candidate.files[role].path);
      assert.ok(fs.realpathSync(candidateFile).startsWith(reviewRoot + path.sep));
      assert.equal(hash(candidateFile), candidate.files[role].sha256, 'reviewed candidate bytes are immutable');
      assert.equal(asset.sha256, candidate.files[role].sha256, 'mapped bytes must be the reviewed bytes');
      allowedPaths.add(asset.path);
    }
  }
  const mappedPaths = [...mapping.matchAll(/require\(['"]@\/(assets\/images\/movement-artwork\/[^'"]+)['"]\)/g)].map(match => match[1]);
  assert.equal(mappedPaths.length, state.canonical_assets.length * 2, 'all governed artwork mappings need approval provenance');
  for (const file of mappedPaths) assert.ok(allowedPaths.has(file), `Unreviewed mapping: ${file}`);
  assert.ok(!mapping.includes('artwork-review/candidates'), 'candidate storage must never be bundled as canonical artwork');
  const policy = JSON.parse(fs.readFileSync(path.join(reviewRoot, 'runtime-policy.json'), 'utf8'));
  assert.deepEqual(policy.denied_keys, [...new Set(denied)].sort(), 'runtime rejection policy must reflect durable human decisions');
  return {canonical: state.canonical_assets.length, denied: denied.length};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('[human-artwork-gate] PASS', assertHumanArtworkGate());
}
