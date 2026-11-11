import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { canonicalArtworkInputFromDefinition } from '../lib/canonical-movement-artwork.ts';
import { approvedLoggerCrop, movementAtmosphereFraming, movementHeroFocal, resolveApprovedExactMovementArtwork, resolveMovementArtworkPresentation } from '../lib/movement-artwork-hero.ts';
import { movementAtmosphereFrame, movementAtmosphereHeaderHeight, movementHeroGeometry, movementHeroSourceFrame } from '../lib/movement-artwork-geometry.mjs';
import { isSelectableLibraryMovement } from '../lib/retired-movement-discovery.ts';
import { assertHumanArtworkGate } from './canonical-art-review-gate.mjs';

// Source bytes, real reviewed framing and canonical identities are inputs to
// this full-catalog regression. Screenshots separately establish visual quality.
assertHumanArtworkGate();
const read = file => JSON.parse(fs.readFileSync(file));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const state = read('artwork-review/review-state.json');
const policy = read('artwork-review/runtime-policy.json');
const definitions = read('config/governed-movement-art-taxonomy.json').movements.filter(isSelectableLibraryMovement);
const widths = [320, 375, 390, 430];
const captionHeights = [64, 100, 148];
const framingPolicy = read('config/movement-atmosphere-framing.json');
assert.deepEqual(Object.keys(framingPolicy.images).sort(), policy.approved_exact_artwork.map(row => row.key).sort(), 'every approved source has an individual framing record');
const background = (frame, width, height, framing) => {
  assert.ok(Object.values(frame).every(Number.isFinite), 'finite raster bounds');
  assert.ok(frame.width >= width * .82 - 1e-7 && frame.height > 0,
    'atmospheric subject stays substantial rather than becoming a small square');
  const top = frame.top + frame.height * framing.top / framing.sourceHeight;
  const bottom = frame.top + frame.height * framing.bottom / framing.sourceHeight;
  assert.ok(top >= 0 && top <= 20, 'individual action starts near the top without dead studio space');
  assert.ok(bottom <= height - 64, 'action and contact points fit above the measured foreground caption');
  assert.ok(bottom > top + width * .2, 'the action remains legible at phone size');
};
const validateFraming = (receipt, dimensions) => {
  const framing = framingPolicy.images[receipt.key];
  assert.ok(framing, `${receipt.key}: individual framing required`);
  assert.equal(framing.candidate_id, receipt.candidate_id);
  assert.equal(framing.app_sha256, receipt.app_sha256, 'framing cannot follow replacement pixels');
  assert.deepEqual([framing.sourceWidth, framing.sourceHeight], dimensions);
  assert.ok(Number.isFinite(framing.top) && Number.isFinite(framing.bottom)
    && framing.top >= 0 && framing.bottom > framing.top && framing.bottom <= framing.sourceHeight);
  assert.ok(Number.isFinite(framing.left) && Number.isFinite(framing.right)
    && framing.left >= 0 && framing.right > framing.left && framing.right <= framing.sourceWidth);
  assert.deepEqual(movementAtmosphereFraming(receipt.key), framing);
  return framing;
};
const images = [];
let rejectedSmallFrames = 0;
for (const receipt of policy.approved_exact_artwork) {
  const mapping = state.canonical_assets.find(row => row.candidate_id === receipt.candidate_id);
  assert.ok(mapping, `${receipt.key}: packaged exact source`);
  assert.equal(sha(mapping.files.app.path), receipt.app_sha256, `${receipt.key}: source pixels unchanged`);
  const png = fs.readFileSync(mapping.files.app.path);
  const sourceWidth = png.readUInt32BE(16), sourceHeight = png.readUInt32BE(20);
  assert.deepEqual([sourceWidth, sourceHeight], mapping.files.app.dimensions);
  const framing = validateFraming(receipt, [sourceWidth, sourceHeight]);
  let checked = 0;
  for (const width of widths) for (const caption of captionHeights) {
    const height = movementAtmosphereHeaderHeight(width, framing, caption);
    const box = movementHeroGeometry(width, height, movementHeroFocal(receipt.key), approvedLoggerCrop(receipt.key));
    const raw = movementHeroSourceFrame(box, sourceWidth, sourceHeight);
    const frame = movementAtmosphereFrame(box, sourceWidth, sourceHeight, width, height, framing);
    background(frame, width, height, framing);
    assert.ok(Math.abs(frame.width / frame.height - sourceWidth / sourceHeight) < 1e-9, 'no image stretching');
    const rejectedScale = Math.min(1, width / raw.width, 210 / raw.height);
    const rejected = { left: width - raw.width * rejectedScale, top: 0, width: raw.width * rejectedScale, height: raw.height * rejectedScale };
    try { background(rejected, width, height, framing); } catch { rejectedSmallFrames++; }
    checked++;
  }
  images.push({ key: receipt.key, candidate: receipt.candidate_id, source: mapping.files.app.path,
    sha256: receipt.app_sha256, dimensions: [sourceWidth, sourceHeight], layouts_checked: checked,
    framing, outcome: 'individual-action-bounds-visible-dead-space-trimmed' });
}
const movements = definitions.map(definition => {
  const input = canonicalArtworkInputFromDefinition(definition), original = structuredClone(input);
  const expected = resolveApprovedExactMovementArtwork(input, true, policy);
  assert.ok(expected, `${definition.key}: exact approved art or explicit governed reuse required`);
  for (const complete of [false, true]) {
    const expanded = resolveMovementArtworkPresentation(input, true, complete, 'atmosphere-regression', true, policy);
    assert.deepEqual(expanded.hero, expected, 'art survives active/completed transitions');
    assert.equal(resolveMovementArtworkPresentation(input, false, complete, 'atmosphere-regression', true, policy).hero, null);
  }
  assert.deepEqual(input, original, 'artwork presentation never mutates history identity');
  return { id: definition.id, key: definition.key, artwork_key: expected.key, candidate: expected.candidate_id,
    states: ['expanded-active', 'expanded-complete', 'collapsed-active', 'collapsed-complete'], outcome: 'resolved' };
});
// The previous numeric containment guard accepted the exact thumbnail the
// owner rejected. The replacement guard must reject that composition directly.
const pushUpFraming = movementAtmosphereFraming('accessory_push_up');
const bad = { left: 180, top: 90, width: 210, height: 210 };
assert.throws(() => background(bad, 390, 370.5, pushUpFraming), /substantial/);
const pushUpHeight = movementAtmosphereHeaderHeight(390, pushUpFraming);
assert.ok(pushUpHeight < 240, 'horizontal Push-Up scene removes the old square-height dead space');
const box = movementHeroGeometry(390, pushUpHeight, movementHeroFocal('accessory_push_up'));
const good = movementAtmosphereFrame(box, 512, 512, 390, pushUpHeight, pushUpFraming);
background(good, 390, pushUpHeight, pushUpFraming);
assert.throws(() => background({ ...good, top: 0 }, 390, 370.5, pushUpFraming), /dead studio space/,
  'old full-square placement with oversized empty top is rejected');
const saved = framingPolicy.images.accessory_push_up;
delete framingPolicy.images.accessory_push_up;
assert.throws(() => validateFraming(policy.approved_exact_artwork.find(row => row.key === 'accessory_push_up'), [512, 512]), /individual framing required/);
framingPolicy.images.accessory_push_up = { ...saved, app_sha256: '0'.repeat(64) };
assert.throws(() => validateFraming(policy.approved_exact_artwork.find(row => row.key === 'accessory_push_up'), [512, 512]), /replacement pixels/);
framingPolicy.images.accessory_push_up = saved;
assert.ok(rejectedSmallFrames > 0, 'full catalog exercises the rejected small-square failure');
assert.deepEqual(movementAtmosphereFrame(bad, 512, 512, 0, 0), { width: 0, height: 0, left: 0, top: 0 });
const report = { movements: movements.length, approved_sources: images.length,
  raster_layout_checks: images.length * widths.length * captionHeights.length,
  widths, captionHeights, header_height: 'individual source action height plus measured caption and 24px edge allowance',
  rejected_small_compositions: rejectedSmallFrames,
  missing: 0, source_pixels_changed: 0, deliberate_thumbnail_rejection: 'PASS', movement_results: movements, image_results: images };
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0) fs.writeFileSync(process.argv[outputIndex + 1], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, movement_results: undefined, image_results: undefined }));
