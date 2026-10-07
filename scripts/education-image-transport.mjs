import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const transportFiles = ['config/education-image-transport.json', 'lib/mobile-education-images.ts', 'lib/mobile-education-image-data.js'];
export const helperSource = `import type { ImageURISource } from 'react-native';

// These are the original PNG bytes inside the launch bundle, with their original dimensions.
// This avoids consuming a separate OTA asset slot for each introduction capture.
const images = require('./mobile-education-image-data') as Record<string, ImageURISource>;
export function educationImage(name: string): ImageURISource {
  const image = images[name];
  if (!image) throw new Error(\`Unknown education image: \${name}\`);
  return image;
}
`;
export function carrierSource(root, contract) {
  const images = {};
  for (const row of contract.images) {
    const bytes = fs.readFileSync(path.join(root, row.path));
    assert.equal(hash(bytes), row.sha256, `original education image changed: ${row.name}`);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [row.width, row.height], 'image dimensions changed');
    images[row.name] = { uri: `data:image/png;base64,${bytes.toString('base64')}`, width: row.width, height: row.height, scale: 1 };
  }
  return '// Generated losslessly from the retained PNG originals; regenerate with scripts/generate-education-image-transport.mjs.\nmodule.exports = ' + JSON.stringify(images) + ';\n';
}
export function transportedComponent(before) {
  return "import { educationImage } from '@/lib/mobile-education-images';\n" + before.replace(/require\('@\/assets\/images\/mobile-3-education\/([^']+)'\)/g, (_, name) => `educationImage('${name}')`).replaceAll('source: number', 'source: ReturnType<typeof educationImage>');
}
export function assertEducationTransport(root, { bundle, sourceCommit } = {}) {
  const contract = JSON.parse(fs.readFileSync(path.join(root, transportFiles[0])));
  assert.equal(contract.version, 1);
  if (sourceCommit) assert.equal(contract.sourceCommit, sourceCommit, 'transport must start at the actual observed native source');
  assert.equal(contract.images.length, 17);
  assert.equal(new Set(contract.images.map(row => row.name)).size, 17);
  assert.deepEqual(contract.components, ['AthleteEducationOpening','CoachEducationOpening','MobileEducationRolePreview','SelfCoachEducationOpening'].map(name => `components/education/${name}.tsx`));
  assert.equal(fs.readFileSync(path.join(root, transportFiles[2]), 'utf8'), carrierSource(root, contract), 'embedded PNG transport is not byte-identical to the originals');
  const helper = fs.readFileSync(path.join(root, transportFiles[1]), 'utf8');
  assert.equal(helper, helperSource, 'image resolver behavior changed');
  const names = new Set();
  for (const file of contract.components) {
    const original = execFileSync('git', ['show', `${contract.sourceCommit}:${file}`], { cwd: root, encoding: 'utf8' });
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), transportedComponent(original), `transport changed screen behavior/layout: ${file}`);
    for (const match of original.matchAll(/require\('@\/assets\/images\/mobile-3-education\/([^']+)'\)/g)) names.add(match[1]);
  }
  assert.deepEqual([...names].sort(), contract.images.map(row => row.name), 'image ownership/binding inventory changed');
  if (bundle) for (const row of contract.images) assert.ok(bundle.includes(fs.readFileSync(path.join(root, row.path)).toString('base64')), `actual bundle is missing original PNG payload: ${row.name}`);
  return { images: 17, originalBytesRetained: true, dimensionsRetained: true, screenBehaviorAndLayoutRetained: true, files: [...transportFiles, ...contract.components] };
}
export function assertOtaAssetLimit(metadata, platform = 'ios') {
  const assets = metadata.fileMetadata?.[platform]?.assets;
  assert.ok(Array.isArray(assets), 'OTA asset manifest is required');
  const count = assets.length + 1; // Expo counts the launch bundle as one asset too.
  assert.ok(count <= 1000, `OTA asset limit exceeded: ${count}/1000; preserve imagery and change packaging before publishing`);
  return count;
}
