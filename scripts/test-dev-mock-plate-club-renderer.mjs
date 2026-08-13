import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const milestoneScreen = readFileSync(resolve(root, 'app/(tabs)/dev-mocks/milestones.tsx'), 'utf8');
const renderer = readFileSync(resolve(root, 'components/barbell/LoadedSleeve3D.tsx'), 'utf8');
const renderTuning = readFileSync(resolve(root, 'lib/barbell/sleeve-render-tuning.ts'), 'utf8');
const assetRegistry = readFileSync(resolve(root, 'lib/barbell/milestone-render-assets.ts'), 'utf8');
const plateStackResolver = readFileSync(resolve(root, 'lib/barbell/plate-stack-render-resolver.ts'), 'utf8');
const heroRegistry = readFileSync(resolve(root, 'lib/barbell/hero-render-registry.ts'), 'utf8');
const heroResolver = readFileSync(resolve(root, 'lib/barbell/hero-render-resolver.ts'), 'utf8');
const heroGenerator = readFileSync(resolve(root, 'scripts/generate-plate-club-hero-renders.mjs'), 'utf8');
const captureDirectory = resolve(root, 'assets/images/milestone-renders/plate-club-material-v2');
const heroCaptureDirectory = resolve(root, 'assets/images/hero-renders/plate-club-hero-v2/mobile-card-180x120@3x');
const liftIconDirectory = resolve(root, 'assets/images/lift-icons/achievement-material-v2');

// These are source-level regression guards. Native Expo GL rendering itself is
// validated on-device; this project does not have a native GL test harness.
for (const lift of ['Squat', 'Bench', 'Deadlift']) {
  assert.match(milestoneScreen, new RegExp(`name: '${lift}'`), `${lift} mock data must exist`);
}

assert.match(
  milestoneScreen,
  /resolvePlateStackRender\(\{ weight: current, unit \}\)/,
  'each lift card must resolve its current displayed PR and unit through the shared canonical resolver',
);
assert.match(
  milestoneScreen,
  /onPress=\{\(\) => setUnit\(unit === 'lb' \? 'kg' : 'lb'\)\}/,
  'the approved unit toggle must update the unit supplied to the shared hero resolver',
);
assert.match(milestoneScreen, /source=\{heroRender\.imageSource\}/, 'hero cards must render the resolved immutable image source');
assert.equal(
  [...milestoneScreen.matchAll(/source=\{heroRender\.imageSource\}/g)].length,
  2,
  'each hero must use one untouched base layer and one tint layer from the same resolved asset',
);
assert.match(
  milestoneScreen,
  /\{ width: heroStageWidth, height: heroStageHeight, tintColor: lift\.tone \}/,
  'the hero-only presentation layer must use the existing lift identity color',
);
assert.match(milestoneScreen, /heroRenderTint: \{ opacity: 0\.18 \}/, 'the hero tint must remain restrained');
assert.equal(
  [...milestoneScreen.matchAll(/testID=\{`\$\{liftKey\}-pr-hero-tint`\}/g)].length,
  1,
  'unit changes must render exactly one hero tint layer',
);
assert.doesNotMatch(milestoneScreen, /resolveHeroRender|canonicalHeroLoading/, 'hero cards must not bypass the shared resolver through the legacy lift-specific registry');
assert.match(plateStackResolver, /resolvePlateStackRenderGeometry/, 'the hero boundary must delegate canonical loading and kg geometry mapping');
assert.match(plateStackResolver, /lookupPlateStackRenderCatalogAsset/, 'the hero boundary must return the existing catalog asset');
assert.doesNotMatch(milestoneScreen, /liftKey === 'bench' && \{ tintColor: lift\.tone \}/, 'exported plate materials must never be flattened by a runtime bench tint');
assert.doesNotMatch(
  milestoneScreen,
  /source=\{identityAsset\}[^>]*tintColor/,
  'two-tone lift icons must retain their authored dark detail',
);
for (const lift of ['squat', 'bench', 'deadlift']) {
  assert.match(milestoneScreen, new RegExp(`lift-icons/achievement-material-v2/${lift}\\.png`), `${lift} must use the versioned two-tone icon`);
}
assert.match(milestoneScreen, /requestedFixture === 'asset-review'/, 'the deterministic asset-review fixture must bypass live achievement data');
for (const lift of ['squat', 'bench', 'deadlift']) {
  const icon = readFileSync(resolve(liftIconDirectory, `${lift}.png`));
  assert.ok(icon.byteLength > 100_000, `${lift} icon must contain detailed two-tone artwork`);
  assert.equal(icon[25], 6, `${lift} icon must remain an RGBA PNG with transparency`);
}
assert.match(milestoneScreen, /testID=\{`\$\{liftKey\}-pr-hero-image`\}/, 'hero images must remain independently identifiable');
assert.match(milestoneScreen, /heroRenderImage: \{ position: 'absolute', left: 0, top: 0 \}/, 'canonical catalog heroes must render in their authored orientation');
assert.match(milestoneScreen, /heroRender\?\.imageSource/, 'catalogued hero entries must retain the immutable capture path');
assert.match(milestoneScreen, /testID=\{`\$\{liftKey\}-pr-render-unavailable`\}/, 'a missing hero artifact must remain bounded to the hero stage');
assert.match(milestoneScreen, /\[PlateStackRenderCatalog\] Missing canonical hero asset/, 'missing catalog coverage must emit a DEV diagnostic');
assert.doesNotMatch(milestoneScreen, /cameraPreset="hero"/, 'ordinary hero mount must never parse or render a GLB');
assert.match(milestoneScreen, /cameraPreset="milestone"/, 'uncatalogued milestone loadings must use the approved milestone 3D camera');
assert.match(milestoneScreen, /resolveMilestoneRenderAsset\(liftKey, targetInPounds\)/, 'milestone cells must safely resolve an optional local capture through the registry');
assert.match(milestoneScreen, /testID=\{`\$\{liftKey\}-\$\{targetInPounds\}-milestone-image`\}/, 'milestone images must remain independently identifiable');
assert.match(milestoneScreen, /targetRenderAsset \? <Image/, 'available immutable milestone captures must retain the image path');
assert.match(milestoneScreen, /milestoneSleeveImage: \{[^}]*MILESTONE_RENDER_ORIENTATION_STYLE/, 'milestone captures must use the shared source-orientation correction');
assert.doesNotMatch(
  milestoneScreen,
  /testID=\{`\$\{liftKey\}-\$\{targetInPounds\}-milestone-image`\}[\s\S]{0,180}tintColor/,
  'milestone-row images must not inherit the hero tint',
);
assert.match(assetRegistry, /MILESTONE_RENDER_ORIENTATION_STYLE[\s\S]*scaleY: -1/, 'the shared milestone source correction must remain vertically mirrored');
assert.match(milestoneScreen, /plates=\{targetLoading \?\? \[\]\}/, 'missing milestone captures must use the exact mapped 3D loading instead of throwing');
assert.match(assetRegistry, /export function resolveMilestoneRenderAsset/, 'the milestone registry must expose a non-throwing lookup for render fallbacks');
assert.doesNotMatch(assetRegistry, /milestone-plate-base|silver_plate|_side|silhouette|expo-gl|expo-three|LoadedSleeve3D/, 'the capture registry must contain only approved local render captures');
assert.match(renderer, /<GLView/, 'the live renderer must own a GLView');
assert.doesNotMatch(renderer, /WeakMap|shared renderer|singleton/i, 'no shared renderer ownership is permitted');
assert.doesNotMatch(renderer, /renderReady|MODEL_ASSET_MODULES|cachedModelTemplate/, 'heroes must not be gated by the removed static optimization preload path');
assert.match(renderer, /serializeSleeveRender/, 'live 3D fallbacks must serialize native GL work');
assert.match(renderer, /generation !== renderGeneration\.current/, 'stale renders must stop after a unit switch destroys their GL context');
assert.doesNotMatch(renderer, /console\.error\('LoadedSleeve3D render failed'/, 'recoverable GL fallback failures must not trigger a DEV red-screen overlay');

// Hero grounding is scene presentation only. These exact-value guards keep
// the approved camera and assembly composition immutable while allowing the
// bounds-derived support surface to evolve independently.
for (const lockedHeroValue of [
  'fov: 30',
  'cameraPosition: [1.35, 0.46, 0.58]',
  'lookAt: [0.11, 0.225, 0]',
  'assemblyScale: 1.65',
  'assemblyScaleXYZ: [1, 1, 1]',
  'assemblyOffset: [-0.3, -0.16, 0]',
  'assemblyRotationDegrees: [0, 28, 0]',
  'sleeveTransform: { offset: [0.2, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1] }',
  '45: { offset: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1], gapFromPrevious: 0.002 }',
]) {
  assert.ok(renderTuning.includes(lockedHeroValue), `locked hero tuning must remain exact: ${lockedHeroValue}`);
}

assert.match(renderer, /new THREE\.PlaneGeometry\(HERO_FLOOR_TUNING\.surface\.width, HERO_FLOOR_TUNING\.surface\.depth\)/, 'hero support must use the centralized oversized floor geometry');
assert.doesNotMatch(renderer, /ExtrudeGeometry|roundedRectangleShape/, 'hero support must not expose a plinth lip, sidewall, bevel, or corner');
assert.match(renderer, /new THREE\.ShadowMaterial\(/, 'hero support must receive the native directional cast shadow');
assert.match(renderer, /pow\(abs\(p\.x\), 4\.0\).*pow\(abs\(p\.y\), 2\.0\)/, 'contact shadow must use the tight geometry-scaled superellipse falloff');
assert.match(renderer, /bounds\.min\.y \+ HERO_FLOOR_TUNING\.verticalOffset/, 'the support must meet the transformed assembly rather than moving it');
assert.match(renderer, /if \(isHero\) addHeroFloor\(scene, assembly\)/, 'support geometry must remain hero-only');
assert.match(renderer, /metalness: isHero\s*\? \(isPlate \? HERO_FLOOR_TUNING\.material\.plateMetalness/, 'material refinement must remain hero-only');
assert.match(renderer, /isHero \? HERO_FLOOR_TUNING\.lighting\.rimIntensity : 0\.38/, 'milestone rim lighting must retain its prior value');
assert.match(renderTuning, /surface:\s*\{\s*width: 24,\s*depth: 24,/, 'the hero surface must extend beyond the ten-unit camera range in every horizontal direction');
assert.match(renderTuning, /color: '#0F1722',\s*opacity: 0\.04,/, 'the oversized surface must blend into the transparent hero stage without revealing its viewport boundary');

assert.match(heroRegistry, /PLATE_CLUB_HERO_RENDERER_VERSION = 'plate-club-hero-v2'/, 'the immutable hero renderer version must be explicit');
assert.match(heroRegistry, /PLATE_CLUB_HERO_MATERIAL_LIGHTING_VERSION = 'achievement-material-v2'/, 'the current achievement material namespace must be explicit');
assert.match(heroRegistry, /PLATE_CLUB_HERO_OUTPUT_PROFILE = 'mobile-card-180x120@3x'/, 'the hero output profile must be explicit');
for (const specInput of [
  'PLATE_CLUB_HERO_LOADING_POLICY_VERSION',
  'PLATE_CLUB_HERO_PLATE_INVENTORY_SIGNATURE',
  'PLATE_CLUB_HERO_CAMERA_VERSION',
  'PLATE_CLUB_HERO_MATERIAL_LIGHTING_VERSION',
  'PLATE_CLUB_HERO_OUTPUT_PROFILE',
]) {
  assert.match(heroRegistry, new RegExp(`PLATE_CLUB_HERO_SPEC_KEY[\\s\\S]*${specInput}`), `render spec must include ${specInput}`);
}
assert.match(heroRegistry, /complete render spec -> lift -> canonical loading -> immutable asset/, 'the registry must document its complete immutable identity contract');
assert.doesNotMatch(heroRegistry, /https?:\/\//, 'the V1 bundled registry must not embed mutable remote URLs');
assert.match(heroGenerator, /if \(existsSync\(target\.output\)\)[\s\S]*readFileSync\(target\.output\)\.equals\(bytes\)[\s\S]*bump the renderer namespace/, 'the generator must validate and reuse identical immutable artifacts instead of overwriting them');
assert.match(heroGenerator, /writeFileSync\(target\.output, bytes, \{ flag: 'wx' \}\)/, 'new immutable artifacts must use exclusive-create semantics');
assert.match(heroResolver, /export type HeroRenderDescriptor/, 'the resolver must expose a stable descriptor boundary');
for (const descriptorField of ['lift', 'canonicalLoadingIdentity', 'rendererVersion', 'outputProfile', 'renderSpecKey', 'artifactKey', 'artifactPath', 'artifactSha256', 'readiness', 'imageSource']) {
  assert.match(heroResolver, new RegExp(`\\b${descriptorField}\\b`), `the descriptor must include ${descriptorField}`);
}
assert.match(heroResolver, /return groups\.map\(\(\{ denomination, count \}\) => `\$\{denomination\}x\$\{count\}`\)\.join\('-'\)/, 'canonical loading identity must preserve ordered run-length plate composition');
assert.match(heroResolver, /registeredHeroRenderAsset\(renderSpecKey, lift, canonicalLoadingIdentity\)/, 'the resolver must be the only registry lookup boundary');
assert.doesNotMatch(heroResolver, /LoadedSleeve3D|GLView|expo-gl|expo-three/, 'the resolver must remain independent from live rendering');

const expectedHeroCaptures = {
  squat: ['45x4.png', '45x4-25x1.png', '45x7-25x1.png'],
  bench: ['45x2-25x1.png', '45x3.png'],
  deadlift: ['45x4-25x1.png', '45x5.png'],
};

const actualHeroCaptures = [];
for (const [lift, fileNames] of Object.entries(expectedHeroCaptures)) {
  for (const fileName of fileNames) {
    const relativeAssetPath = `hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/${lift}/${fileName}`;
    assert.match(heroRegistry, new RegExp(relativeAssetPath.replaceAll('.', '\\.')), `${lift} ${fileName} must be registered`);
    const capturePath = resolve(heroCaptureDirectory, lift, fileName);
    assert.ok(existsSync(capturePath), `${lift}/${fileName} must exist`);
    const capture = readFileSync(capturePath);
    assert.ok(capture.byteLength > 8000, `${lift}/${fileName} must contain a nonblank rendered assembly`);
    assert.equal(capture.readUInt32BE(16), 540, `${lift}/${fileName} must retain its exact 3x width`);
    assert.equal(capture.readUInt32BE(20), 360, `${lift}/${fileName} must retain its exact 3x height`);
    assert.equal(capture[25], 6, `${lift}/${fileName} must remain an RGBA PNG with transparency`);
    const sha256 = createHash('sha256').update(capture).digest('hex');
    assert.match(heroRegistry, new RegExp(sha256), `${lift}/${fileName} catalog entry must pin the immutable artifact digest`);
    actualHeroCaptures.push(`${lift}/${fileName}`);
  }
}

const catalogHeroCaptures = Object.keys(expectedHeroCaptures).flatMap((lift) =>
  readdirSync(resolve(heroCaptureDirectory, lift)).map((fileName) => `${lift}/${fileName}`),
);
assert.deepEqual(catalogHeroCaptures.sort(), actualHeroCaptures.sort(), 'the hero registry coverage and V1 capture directory must stay in lockstep');

const expectedCaptures = {
  squat: [95, 110, 135, 185, 220, 225, 275, 315, 330, 365, 405, 440, 455, 495, 545, 550, 585, 635, 660, 675, 725],
  bench: [90, 95, 130, 135, 175, 185, 220, 225, 265, 275, 310, 315, 355, 365, 395, 405, 440, 455, 495, 545, 585],
  deadlift: [95, 135, 185, 220, 225, 275, 315, 330, 365, 405, 440, 455, 495, 545, 550, 585, 635, 660, 675, 725, 765, 770, 815, 855, 880, 895],
};

const expectedFileNames = [];
for (const [lift, weights] of Object.entries(expectedCaptures)) {
  for (const weight of weights) {
    const fileName = `${lift}-${weight}.png`;
    expectedFileNames.push(fileName);
    assert.match(assetRegistry, new RegExp(`milestone-renders/plate-club-material-v2/${lift}-${weight}\\.png`), `${lift} ${weight} lb must be registered`);
    const capturePath = resolve(captureDirectory, fileName);
    assert.ok(existsSync(capturePath), `${fileName} must exist`);
    const capture = readFileSync(capturePath);
    assert.ok(capture.byteLength > 7000, `${fileName} must contain a nonblank rendered assembly`);
    assert.equal(capture.readUInt32BE(16), 282, `${fileName} must retain its approved 3x width`);
    assert.equal(capture.readUInt32BE(20), 180, `${fileName} must retain its approved 3x height`);
    assert.equal(capture[25], 6, `${fileName} must remain an RGBA PNG with transparency`);
  }
}

assert.deepEqual(readdirSync(captureDirectory).sort(), expectedFileNames.sort(), 'the registry coverage and capture directory must stay in lockstep');

console.log('dev mock Plate Club immutable render catalog regression guards passed');
