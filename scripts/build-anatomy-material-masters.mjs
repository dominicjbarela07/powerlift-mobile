import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(root, 'assets', 'images', 'anatomy-v2', 'masters');
const destinationDirectory = path.join(root, 'assets', 'images', 'anatomy-v2', 'materials');

const sources = [
  'masculine-front-v1.png',
  'masculine-rear-v1.png',
  'feminine-front-v1.png',
  'feminine-rear-v1.png',
];

const materialRamps = {
  primary: {
    shadow: [26, 9, 45],
    mid: [116, 45, 206],
    highlight: [224, 184, 255],
  },
  secondary: {
    shadow: [43, 8, 34],
    mid: [178, 39, 132],
    highlight: [255, 178, 230],
  },
};

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function mix(from, to, amount) {
  return from + (to - from) * amount;
}

function materialChannel(ramp, luminance, channel) {
  const normalized = clamp((luminance - 7) / 225, 0, 1);
  if (normalized < 0.58) return mix(ramp.shadow[channel], ramp.mid[channel], normalized / 0.58);
  return mix(ramp.mid[channel], ramp.highlight[channel], (normalized - 0.58) / 0.42);
}

function buildMaterial(source, ramp) {
  const output = new PNG({ width: source.width, height: source.height });
  for (let index = 0; index < source.data.length; index += 4) {
    const red = source.data[index];
    const green = source.data[index + 1];
    const blue = source.data[index + 2];
    const alpha = source.data[index + 3];
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const microContrast = (Math.max(red, green, blue) - Math.min(red, green, blue)) * 0.08;
    output.data[index] = clamp(materialChannel(ramp, luminance, 0) + microContrast);
    output.data[index + 1] = clamp(materialChannel(ramp, luminance, 1));
    output.data[index + 2] = clamp(materialChannel(ramp, luminance, 2) + microContrast);
    output.data[index + 3] = alpha;
  }
  return output;
}

fs.mkdirSync(destinationDirectory, { recursive: true });
for (const sourceName of sources) {
  const sourcePath = path.join(sourceDirectory, sourceName);
  const source = PNG.sync.read(fs.readFileSync(sourcePath));
  if (source.width !== 418 || source.height !== 941) {
    throw new Error(`${sourceName} must remain on the canonical 418 x 941 canvas`);
  }
  for (const [role, ramp] of Object.entries(materialRamps)) {
    const destinationName = sourceName.replace('-v1.png', `-${role}-material-v2.png`);
    fs.writeFileSync(path.join(destinationDirectory, destinationName), PNG.sync.write(buildMaterial(source, ramp), {
      colorType: 6,
      inputColorType: 6,
    }));
  }
}

console.log(`Built ${sources.length * Object.keys(materialRamps).length} master-derived anatomy material layers.`);
