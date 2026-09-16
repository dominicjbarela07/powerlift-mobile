import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertHumanArtworkGate, approvedExactArtworkPolicy } from './canonical-art-review-gate.mjs';
import { isMovementArtworkReviewDenied } from '../lib/movement-art-review-policy.ts';

const root = process.cwd();
const state = JSON.parse(fs.readFileSync('artwork-review/review-state.json'));
assert.equal(assertHumanArtworkGate(root).canonical, state.canonical_assets.length);
assert.match(fs.readFileSync('lib/canonical-movement-artwork-assets.ts', 'utf8'), />> = \(__DEV__ \|\| process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL === 'testflight'\) \? \{/,
  'only DEV and explicitly authorized TestFlight exports include the approved family');
assert.match(fs.readFileSync('components/movement/CanonicalMovementArtwork.tsx', 'utf8'), /const approved = accessoryPresentation === 'movement' \? resolveApprovedExactMovementArtwork\(subject\) : null/, 'every exact image requires a positive human receipt; absence retains anatomy');
// Actual decision totals belong to the human and must never be reset by a test.
for (const item of state.items) {
  if (item.status === 'pending' || item.status === 'rejected') assert.equal(item.human_approved, false);
}
assert.equal(isMovementArtworkReviewDenied('example', true, ['example']), true);
assert.equal(isMovementArtworkReviewDenied('different', true, ['example']), false);
assert.equal(isMovementArtworkReviewDenied('example', false, ['example']), false, 'disabled artwork runtime preserves existing fallback');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-art-approval-gate-'));
try {
  const original = state.grandfathered_assets.find(row => row.movement_definition_id === 33);
  const candidate = state.items.find(row => row.candidate_id === original.candidate_id);
  const fixture = {schema_version: 1, items: [structuredClone(candidate)], canonical_assets: [structuredClone(original)], grandfathered_assets: [structuredClone(original)]};
  const write = (file, value) => {
    const target = path.join(temporary, file); fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  write('artwork-review/review-state.json', fixture);
  write('artwork-review/runtime-policy.json', {denied_keys: [], approved_exact_artwork: approvedExactArtworkPolicy(fixture)});
  write('lib/canonical-accessory-artwork-identities.ts', `  33: { key: '${original.key}', primary: 'chest' },`);
  const mapping = `export const fixture = {\n  ${original.key}: {\n    source: require('@/${original.files.app.path}'),\n  },\n};`;
  write('lib/canonical-movement-artwork-assets.ts', mapping);
  for (const role of ['master', 'app', 'thumbnail']) {
    for (const relative of [original.files[role].path, `artwork-review/${candidate.files[role].path}`]) {
      const target = path.join(temporary, relative); fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(path.join(root, relative), target);
    }
  }
  assert.equal(assertHumanArtworkGate(temporary).canonical, 1);
  for (const role of ['thumbnail', 'master']) {
    write('lib/canonical-movement-artwork-assets.ts', mapping + `\nrequire('@/${original.files[role].path}');`);
    assert.throws(() => assertHumanArtworkGate(temporary), /exactly one approved app image/);
  }
  write('lib/canonical-movement-artwork-assets.ts', mapping);
  fixture.items[0].status = 'pending'; fixture.items[0].human_approved = false;
  fixture.canonical_assets[0].approval_source = 'human_review_ui';
  fixture.canonical_assets[0].review = {decision: 'pending', source: 'automation'};
  write('artwork-review/review-state.json', fixture);
  assert.throws(() => assertHumanArtworkGate(temporary), /pending\/rejected/);
  const approval = {action: 'approve', decision: 'approved', source: 'human_review_ui', reviewer_user_id: 1, candidate_sha256: candidate.files.master.sha256};
  fixture.items[0].status = 'approved'; fixture.items[0].human_approved = true;
  fixture.items[0].review_history = [approval]; fixture.items[0].review = approval;
  fixture.canonical_assets[0].review = approval;
  write('artwork-review/review-state.json', fixture);
  write('artwork-review/runtime-policy.json', {denied_keys: [], approved_exact_artwork: approvedExactArtworkPolicy(fixture)});
  assert.equal(assertHumanArtworkGate(temporary).canonical, 1, 'exact approved receipt enables governed mapping');
  const chat = {action: 'approve', decision: 'approved', source: 'explicit_owner_chat',
    owner_instruction: 'Mark this exact image approved.', conversation_id: '01a0a813-c63f-7081-a3c9-475e7bea8368',
    recorded_by: 'codex_at_owner_request', candidate_sha256: candidate.files.master.sha256};
  fixture.items[0].review = chat; fixture.items[0].review_history = [chat];
  fixture.canonical_assets[0].approval_source = chat.source; fixture.canonical_assets[0].review = chat;
  write('artwork-review/review-state.json', fixture);
  write('artwork-review/runtime-policy.json', {denied_keys: [], approved_exact_artwork: approvedExactArtworkPolicy(fixture)});
  assert.equal(assertHumanArtworkGate(temporary).canonical, 1, 'explicit owner chat remains distinct from UI approval');
  chat.owner_instruction = '';
  assert.deepEqual(approvedExactArtworkPolicy(fixture), [], 'missing owner evidence fails closed');
  chat.owner_instruction = 'Mark this exact image approved.';
  fixture.artwork_invalidations = [{rebuild_id: 'isolated-cable-reset',
    movement_definition_ids: [candidate.movement_definition_id],
    invalidated_master_hashes: [candidate.files.master.sha256]}];
  write('artwork-review/review-state.json', fixture);
  assert.deepEqual(approvedExactArtworkPolicy(fixture), [], 'family invalidation overrides an old exact human approval');
  assert.throws(() => assertHumanArtworkGate(temporary), /runtime rejection policy/, 'stale approval manifest cannot re-enable invalidated bytes');
  write('artwork-review/runtime-policy.json', {denied_keys: [original.key], approved_exact_artwork: []});
  assert.equal(assertHumanArtworkGate(temporary).canonical, 1, 'retained historical mapping is safe only with current denial and no positive receipt');
  delete fixture.artwork_invalidations;
  write('artwork-review/review-state.json', fixture);
  write('artwork-review/runtime-policy.json', {denied_keys: [], approved_exact_artwork: approvedExactArtworkPolicy(fixture)});
  write('lib/canonical-movement-artwork-assets.ts', mapping.replace(original.files.app.path, candidate.files.app.path));
  assert.throws(() => assertHumanArtworkGate(temporary), /correct identity/);
  write('lib/canonical-movement-artwork-assets.ts', mapping);
  fs.appendFileSync(path.join(temporary, original.files.app.path), 'unreviewed edit');
  assert.throws(() => assertHumanArtworkGate(temporary), /Unapproved canonical artwork change/);
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}

for (const [folder, file] of [
  ['free-weight-push-family-2026-09-11', 'materialize_assets.py'],
  ['free-weight-pull-family-2026-09-11', 'materialize_assets.py'],
  ['free-weight-completion-2026-09-11', 'materialize_assets.py'],
  ['head-gaze-audit-2026-09-11', 'materialize_corrections.py'],
]) {
  const source = fs.readFileSync(`docs/validation/${folder}/${file}`, 'utf8');
  assert.ok(source.includes('raise SystemExit("Human artwork approval required.'));
  assert.ok(source.indexOf('raise SystemExit') < source.indexOf('shutil.copyfile'));
}
assert.ok(fs.readFileSync('scripts/start-canonical-dev-metro.mjs', 'utf8').includes('assertHumanArtworkGate();'));
console.log('[human-art-review] exact human receipts, pending denial, identity-bound paths, immutable bytes, runtime-gated rejection policy and retired automatic pipelines PASS');
