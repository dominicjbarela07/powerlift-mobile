import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = path.join(root, 'assets/images/major-volume-medallions');
const registry = fs.readFileSync(path.join(root, 'lib/major-volume-medallion-assets.ts'), 'utf8');
const recognition = fs.readFileSync(
  path.join(root, 'components/workout-logger/major-volume-milestone-recognition.tsx'),
  'utf8',
);

const families = ['total', 'squat', 'bench', 'deadlift'];
const thresholds = ['100k', '250k', '500k', '1m', '2m', '5m', '10m'];
const expectedRelativePaths = families.flatMap((family) =>
  thresholds.map((threshold) => `${family}/${family}-${threshold}.png`),
);

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function inspectRgbaPng(filePath) {
  const png = fs.readFileSync(filePath);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${filePath} must be a PNG`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  assert.ok(width >= 1200 && height >= 1200, `${filePath} must remain Retina-ready`);
  assert.equal(width, height, `${filePath} must remain square`);
  assert.equal(bitDepth, 8, `${filePath} must use 8-bit channels`);
  assert.equal(colorType, 6, `${filePath} must be RGBA`);
  assert.equal(interlace, 0, `${filePath} must remain non-interlaced for deterministic validation`);

  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  assert.equal(inflated.length, (rowBytes + 1) * height, `${filePath} pixel payload is malformed`);

  let prior = new Uint8Array(rowBytes);
  const alpha = new Uint8Array(width * height);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const row = new Uint8Array(rowBytes);
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[inputOffset + x];
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = prior[x];
      const upLeft = x >= bytesPerPixel ? prior[x - bytesPerPixel] : 0;
      if (filter === 0) row[x] = raw;
      else if (filter === 1) row[x] = (raw + left) & 255;
      else if (filter === 2) row[x] = (raw + up) & 255;
      else if (filter === 3) row[x] = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[x] = (raw + paethPredictor(left, up, upLeft)) & 255;
      else assert.fail(`${filePath} uses unsupported PNG filter ${filter}`);
    }
    inputOffset += rowBytes;
    for (let x = 0; x < width; x += 1) alpha[y * width + x] = row[x * bytesPerPixel + 3];
    prior = row;
  }

  const cornerIndices = [0, width - 1, width * (height - 1), width * height - 1];
  for (const index of cornerIndices) assert.equal(alpha[index], 0, `${filePath} corners must be transparent`);
  const transparentPixels = alpha.reduce((count, value) => count + (value === 0 ? 1 : 0), 0);
  const opaquePixels = alpha.reduce((count, value) => count + (value === 255 ? 1 : 0), 0);
  assert.ok(transparentPixels > alpha.length * 0.2, `${filePath} must have a meaningful transparent cutout`);
  assert.ok(opaquePixels > alpha.length * 0.25, `${filePath} must retain a substantial crisp subject`);
}

for (const relativePath of expectedRelativePaths) {
  const filePath = path.join(assetRoot, relativePath);
  assert.ok(fs.existsSync(filePath), `${relativePath} must exist`);
  inspectRgbaPng(filePath);
  assert.match(
    registry,
    new RegExp(`require\\('@\\/assets\\/images\\/major-volume-medallions\\/${relativePath.replaceAll('.', '\\.')}'\\)`),
    `${relativePath} must have a literal Metro registry entry`,
  );
}

const actualRelativePaths = fs
  .readdirSync(assetRoot, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
  .map((entry) => path.relative(assetRoot, path.join(entry.parentPath, entry.name)).replaceAll(path.sep, '/'))
  .sort();

assert.deepEqual(actualRelativePaths, [...expectedRelativePaths].sort(), 'the canonical library must contain exactly the expected 28 medallions');
assert.equal((registry.match(/require\('@\/assets\/images\/major-volume-medallions\//g) || []).length, 28);
assert.match(recognition, /<Image[\s\S]*source=\{majorVolumeMedallionAsset\(family, thresholdLb\)\}/s);
assert.doesNotMatch(recognition, /react-native-svg|<Svg|<Polygon|artifactThreshold/);

console.log('Major volume medallion assets: 28/28 RGBA Retina assets validated.');
