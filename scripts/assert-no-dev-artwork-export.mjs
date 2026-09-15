import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertHumanArtworkGate, approvedExactArtworkPolicy } from './canonical-art-review-gate.mjs';

/** Approval results may ship to TestFlight; candidates, masters and review UI may not.
 * Keep checking actual export bytes so a source-level gate cannot hide missing art
 * or quietly admit pending/rejected images into an OTA. */
export function assertApprovedArtworkExport(exported, { root = process.cwd(), channel = process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL } = {}) {
  assert.ok(exported && fs.existsSync(exported), 'pass the fresh Expo export directory');
  assertHumanArtworkGate(root);
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const state = read('artwork-review/review-state.json');
  const runtime = read('artwork-review/runtime-policy.json');
  const approved = approvedExactArtworkPolicy(state);
  assert.deepEqual(runtime.approved_exact_artwork, approved, 'runtime projection must match human approval');
  const app = read('app.json').expo;
  const testflight = channel === 'testflight';
  if (testflight) {
    assert.equal(app.extra?.releaseTrack, 'testflight', 'approved artwork requires the TestFlight release projection');
    assert.match(app.version, /^2\.1\.\d+$/, 'approved artwork requires the compatible TestFlight runtime');
  }
  const allKnown = new Set([...state.items, ...state.canonical_assets, ...state.grandfathered_assets]
    .flatMap(row => Object.values(row.files || {}).map(file => file.sha256)));
  const equipment = read('docs/validation/equipment-type-art-2026-09-13/asset-manifest.json').assets;
  for (const row of equipment) for (const file of Object.values(row.files)) allKnown.add(file.sha256);
  const allowed = new Set();
  if (testflight) for (const receipt of approved) {
    assert.ok(!runtime.denied_keys.includes(receipt.key));
    const mapping = state.canonical_assets.find(row => row.key === receipt.key && row.candidate_id === receipt.candidate_id);
    assert.ok(mapping, 'only currently approved mapped derivatives may ship');
    allowed.add(mapping.files.app.sha256);
  }
  if (testflight) for (const row of equipment) {
    const bytes = fs.readFileSync(path.join(root, row.files.app.path));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), row.files.app.sha256, 'equipment category bytes must match the validated pair');
    allowed.add(row.files.app.sha256);
  }
  const seen = assertArtworkExportBytes(exported, {knownHashes: allKnown, allowedHashes: allowed});
  return {channel:testflight?'testflight':'disabled',approved_movements:testflight?approved.length:0,approved_derivatives:testflight?seen.size-equipment.length:0,equipment_category_assets:testflight?equipment.length:0,pending_rejected_master_assets:0};
}

export function assertArtworkExportBytes(exported, {knownHashes: allKnown, allowedHashes: allowed}) {
  const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];
  });
  const seen = new Set();
  for (const file of walk(exported)) {
    const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.ok(!allKnown.has(hash) || allowed.has(hash), `Unapproved candidate/master, redundant thumbnail or DEV-only artwork in export: ${file}`);
    if(allowed.has(hash))seen.add(hash);
  }
  assert.deepEqual([...allowed].filter(hash=>!seen.has(hash)),[], 'approved mapped app bytes are missing from the TestFlight OTA');
  return seen;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log('[approved-artwork-export]', JSON.stringify(assertApprovedArtworkExport(process.argv[2])));
}
