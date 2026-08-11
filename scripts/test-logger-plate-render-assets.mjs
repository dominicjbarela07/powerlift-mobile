import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const registry = read('lib/barbell/logger-plate-render-assets.ts');
const visualContext = read('lib/logger-visual-context.ts');
const movementComponent = read('components/workout-logger/core-loggers.tsx');
const generator = read('scripts/generate-plate-club-hero-renders.mjs');
const blenderStudioBuilder = read('scripts/blender/build_plate_render_studio.py');
const blenderRenderer = read('scripts/blender/render_plate_stack_poc.py');
const blenderRenderWrapper = read('scripts/blender/render_plate_stack_poc.sh');

const assetPaths = Array.from(
  registry.matchAll(/require\('\.\.\/\.\.\/assets\/images\/([^']+\.png)'\)/g),
  (match) => match[1],
);

assert.equal(assetPaths.length, 68, 'the logger catalog must cover all 68 supported exact lift/weight renders');
assert.equal(new Set(assetPaths).size, assetPaths.length, 'logger render paths must be unique');

for (const assetPath of assetPaths) {
  const absolutePath = path.join(root, 'assets/images', assetPath);
  assert.ok(fs.existsSync(absolutePath), `missing logger render: ${assetPath}`);
  const png = PNG.sync.read(fs.readFileSync(absolutePath));
  assert.equal(png.width, 720, `${assetPath} must remain Retina-ready at 720 px`);
  assert.equal(png.height, 480, `${assetPath} must remain Retina-ready at 480 px`);
  assert.equal(png.alpha, true, `${assetPath} must retain alpha`);
  const cornerOffsets = [
    3,
    (png.width - 1) * 4 + 3,
    (png.height - 1) * png.width * 4 + 3,
    ((png.height * png.width) - 1) * 4 + 3,
  ];
  for (const offset of cornerOffsets) {
    const maximumCornerAlpha = assetPath.includes('blender-cycles-poc-v1') ? 32 : 0;
    assert.ok(
      png.data[offset] <= maximumCornerAlpha,
      `${assetPath} must not contain an opaque ground/background rectangle`,
    );
  }
}

const proofPath = path.join(
  root,
  'assets/images/logger-renders/blender-cycles-poc-v1/mobile-hero-240x160@3x/squat/405.png',
);
const proofBytes = fs.readFileSync(proofPath);
const proof = PNG.sync.read(proofBytes);
let visiblePixels = 0;
let partialAlphaPixels = 0;
let greenFringePixels = 0;
for (let offset = 0; offset < proof.data.length; offset += 4) {
  const red = proof.data[offset];
  const green = proof.data[offset + 1];
  const blue = proof.data[offset + 2];
  const alpha = proof.data[offset + 3];
  if (alpha > 0) visiblePixels += 1;
  if (alpha > 0 && alpha < 255) partialAlphaPixels += 1;
  if (alpha > 16 && green > 40 && green > red * 1.45 && green > blue * 1.35) greenFringePixels += 1;
}
const totalPixels = proof.width * proof.height;
assert.ok(proofBytes.byteLength > 200_000, 'Cycles proof render must retain detailed source information');
assert.ok(visiblePixels / totalPixels > 0.25 && visiblePixels / totalPixels < 0.75, 'proof render needs useful crop safety');
assert.ok(partialAlphaPixels > 500, 'proof render must retain antialiased alpha edges');
assert.ok(greenFringePixels / visiblePixels < 0.001, 'proof render must not retain a visible chroma-key fringe');

assert.match(visualContext, /resolvePlateStackRender/);
assert.doesNotMatch(visualContext, /resolveLoggerPlateRenderAsset/);
assert.doesNotMatch(visualContext, /resolveMilestoneRenderAsset/);
assert.match(registry, /LOGGER_PLATE_RENDER_ORIENTATION_STYLE[\s\S]*scaleX: -1/);
assert.doesNotMatch(registry, /LOGGER_PLATE_RENDER_ORIENTATION_STYLE[\s\S]*scaleY/);
assert.match(registry, /source: 'canonical-blender-cycles-poc-v1'/);
assert.match(registry, /blender-cycles-poc-v1\/mobile-hero-240x160@3x\/squat\/405\.png/);
assert.match(visualContext, /catalogKeyLb: render\.catalogKeyLb/);
assert.match(movementComponent, /visualContext\.plateStack\.mode === 'range'/);
assert.match(movementComponent, /endpoint\.plateStack\.presentationStyle/);
assert.doesNotMatch(movementComponent, /activeNextSetPlate(KeyLight|Backlight|FloorReflection|ContactShadow|SleeveHighlight)/);
assert.doesNotMatch(movementComponent, /LinearGradient/);
assert.match(movementComponent, /activeNextSetHero:[\s\S]*position: 'relative'[\s\S]*width: '100%'[\s\S]*overflow: 'visible'/);
assert.match(movementComponent, /activeNextSetHero:[\s\S]*minHeight: 265/);
assert.match(movementComponent, /activeNextSetLoad:[\s\S]*fontFamily: SLFontFamilies\.numeric/);
assert.doesNotMatch(movementComponent, /activeNextSetLoad:[\s\S]*fontFamily: SLFontFamilies\.bodyBold/);
assert.doesNotMatch(movementComponent, /typographyRole="heroNumeric"[\s\S]{0,160}style=\{styles\.activeNextSetLoad\}/);
assert.match(movementComponent, /activeNextSetKicker:[\s\S]*fontFamily: SLFontFamilies\.bodyBold[\s\S]*fontSize: SLTypography\.caption\.fontSize/);
assert.match(movementComponent, /activeNextSetMetricBlock:[\s\S]*flexDirection: 'row'[\s\S]*alignItems: 'baseline'/);
assert.match(movementComponent, /activeNextSetPlate:[\s\S]*width: 390[\s\S]*height: 310/);
assert.match(movementComponent, /activeNextSetPlateStage:[\s\S]*position: 'absolute'[\s\S]*top: -20/);
assert.doesNotMatch(movementComponent, /activeNextSetPlateCompact/);

assert.match(generator, /profile: 'logger'/);
assert.match(generator, /new THREE\.MeshPhysicalMaterial/);
assert.match(generator, /metalness:isPlate\?\.06:\.94/);
assert.match(generator, /key\.shadow\.mapSize\.set\(isLogger\?4096:2048/);
assert.match(generator, /--logger-only/);
assert.match(blenderStudioBuilder, /EXPECTED_SOURCE_NAME = "plate_stack\.blend"/);
assert.match(blenderStudioBuilder, /scene\.render\.engine = "CYCLES"/);
assert.match(blenderStudioBuilder, /preferences\.compute_device_type = "METAL"/);
assert.match(blenderStudioBuilder, /PLATE_COUNT_PER_SIDE = 4/);
assert.match(blenderStudioBuilder, /"sl_orientation_transform"] = "none"/);
assert.match(blenderStudioBuilder, /Studio already exists:[\s\S]*Use --force only to rebuild/);
assert.match(blenderRenderer, /Canonical editable plate-render art workspace/);
assert.match(blenderRenderer, /bpy\.ops\.render\.render\(write_still=True\)/);
assert.doesNotMatch(blenderRenderer, /nodes\.new\(/);
assert.doesNotMatch(blenderRenderer, /\.data\.energy\s*=/);
assert.doesNotMatch(blenderRenderer, /view_settings\.(view_transform|look|exposure|gamma)\s*=/);
assert.doesNotMatch(blenderRenderer, /camera\.data\.(lens|sensor_width)\s*=/);
assert.match(blenderRenderWrapper, /strength-ledger-plate-render-studio\.blend/);
assert.doesNotMatch(blenderRenderWrapper, /assets\/models\/plate_stack\.blend/);

console.log('Logger plate render catalog, editable Blender studio boundary, Cycles proof, Retina dimensions, alpha integrity, orientation, and UI-layer cleanup passed.');
