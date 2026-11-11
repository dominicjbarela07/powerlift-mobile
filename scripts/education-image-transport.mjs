import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const phaseOneDelta = {
  path: 'config/self-coach-phase1-education-delta.json',
  sha256: 'e3a247b44c9ebb010f78603a0d24188f47900e439bff72fbf4861b10a4f7a659',
  ownerPath: 'docs/design/SELF_COACH_PHASE_1_APPROVAL_2026-11-10.json',
  ownerSha256: '76f1239f71678b3445c098b8f2456668036b82571a878dd7e1b1098a6004cb6b',
};
const sessionLanguageDelta = {
  path: 'config/self-coach-education-session-language-delta.json',
  sha256: 'a3fad983934f599f786e4a43efed01a178b6eab43a9ae41722afd3a45d144510',
};
export const transportFiles = ['config/education-image-transport.json', 'lib/mobile-education-images.ts', 'lib/mobile-education-image-data.js', phaseOneDelta.path, phaseOneDelta.ownerPath, sessionLanguageDelta.path];
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
  const deltaBytes = fs.readFileSync(path.join(root, phaseOneDelta.path));
  const ownerBytes = fs.readFileSync(path.join(root, phaseOneDelta.ownerPath));
  assert.equal(hash(deltaBytes), phaseOneDelta.sha256, 'owner-directed education delta changed');
  assert.equal(hash(ownerBytes), phaseOneDelta.ownerSha256, 'education owner evidence changed');
  const delta = JSON.parse(deltaBytes);
  assert.equal(delta.sourceCommit, contract.sourceCommit, 'education delta must retain the original transport source');
  assert.equal(delta.ownerEvidenceSha256, phaseOneDelta.ownerSha256);
  assert.equal(delta.ownerEvidencePath, phaseOneDelta.ownerPath);
  assert.equal(delta.ownerInstruction, 'Approve these illustrations. Let’s begin phase 1');
  assert.equal(delta.path, 'components/education/SelfCoachEducationOpening.tsx');
  assert.equal(delta.changes.length, 1);
  const languageBytes = fs.readFileSync(path.join(root, sessionLanguageDelta.path));
  assert.equal(hash(languageBytes), sessionLanguageDelta.sha256, 'owner-directed Session terminology delta changed');
  const language = JSON.parse(languageBytes);
  assert.equal(language.path, delta.path);
  const names = new Set();
  for (const file of contract.components) {
    const original = execFileSync('git', ['show', `${contract.sourceCommit}:${file}`], { cwd: root, encoding: 'utf8' });
    let expected = transportedComponent(original);
    if (file === delta.path) {
      assert.equal(delta.changes[0].before, expected, 'education delta lost the exact original source');
      expected = delta.changes[0].after;
      assert.equal(hash(expected), language.beforeSha256, 'Session terminology delta lost the exact Phase 1 source');
      for (const { before, after, count } of language.changes) {
        assert.equal(expected.split(before).length - 1, count, 'Session terminology source occurrence changed');
        expected = expected.replaceAll(before, after);
      }
      assert.equal(hash(expected), language.afterSha256, 'Session terminology delta does not reproduce the exact accepted source');
    }
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), expected, `transport changed screen behavior/layout outside the exact owner delta: ${file}`);
    for (const match of original.matchAll(/require\('@\/assets\/images\/mobile-3-education\/([^']+)'\)/g)) names.add(match[1]);
  }
  assert.deepEqual([...names].sort(), contract.images.map(row => row.name), 'image ownership/binding inventory changed');
  if (bundle) for (const row of contract.images) assert.ok(bundle.includes(fs.readFileSync(path.join(root, row.path)).toString('base64')), `actual bundle is missing original PNG payload: ${row.name}`);
  return { images: 17, originalBytesRetained: true, dimensionsRetained: true,
    screenBehaviorAndLayoutRetained: false, screenBehaviorRetainedOutsideOwnerDelta: true,
    ownerDirectedScreenChanges: [delta.path], files: [...transportFiles, ...contract.components] };
}
export function assertOtaAssetLimit(metadata, platform = 'ios') {
  const assets = metadata.fileMetadata?.[platform]?.assets;
  assert.ok(Array.isArray(assets), 'OTA asset manifest is required');
  const count = assets.length + 1; // Expo counts the launch bundle as one asset too.
  assert.ok(count <= 1000, `OTA asset limit exceeded: ${count}/1000; preserve imagery and change packaging before publishing`);
  return count;
}
