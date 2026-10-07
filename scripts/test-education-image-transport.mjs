import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { assertEducationTransport, assertOtaAssetLimit, transportFiles } from './education-image-transport.mjs';
const root = process.cwd();
assert.equal(assertEducationTransport(root).images, 17);
const contract = JSON.parse(fs.readFileSync('config/education-image-transport.json'));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-image-transport-test-'));
try {
  fs.symlinkSync(path.join(root, '.git'), path.join(fixture, '.git'));
  for (const file of [...transportFiles, ...contract.components, ...contract.images.map(row => row.path)]) {
    const target = path.join(fixture, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, file), target);
  }
  assertEducationTransport(fixture);
  function rejects(file, changed, message) {
    const target = path.join(fixture, file), original = fs.readFileSync(target);
    fs.writeFileSync(target, changed);
    assert.throws(() => assertEducationTransport(fixture), message);
    fs.writeFileSync(target, original);
  }
  const carrier = fs.readFileSync(path.join(fixture, transportFiles[2]), 'utf8');
  rejects(transportFiles[2], carrier.replace('base64,iVBOR', 'base64,xVBOR'), /byte-identical/);
  rejects(contract.images[0].path, Buffer.from('broken image'), /original education image changed/);
  const component = fs.readFileSync(path.join(fixture, contract.components[0]), 'utf8');
  rejects(contract.components[0], component.replace('athlete-session-20261001.png', 'coach-home-20261001.png'), /screen behavior/);
  rejects(contract.components[0], component + '\nexport const hiddenBehavior = true;\n', /screen behavior/);
  rejects(transportFiles[1], fs.readFileSync(path.join(fixture, transportFiles[1]), 'utf8').replace('return image;', 'return images["coach-home-20261001.png"];'), /resolver behavior/);
  assert.throws(() => assertEducationTransport(fixture, { bundle: Buffer.from('no images') }), /actual bundle is missing/);
  assert.throws(() => assertEducationTransport(fixture, { sourceCommit: 'wrong' }), /actual observed native source/);
  assert.equal(assertOtaAssetLimit({ fileMetadata: { ios: { assets: Array(999).fill({}) } } }), 1000);
  assert.throws(() => assertOtaAssetLimit({ fileMetadata: { ios: { assets: Array(1000).fill({}) } } }), /1001\/1000/);
} finally { fs.rmSync(fixture, { recursive: true, force: true }); }
console.log('Lossless education transport PASS: all 17 PNG bytes/dimensions and four screen bindings preserved; corrupted payload/original, wrong image/resolver, changed screen, absent artifact and excess OTA assets rejected.');
