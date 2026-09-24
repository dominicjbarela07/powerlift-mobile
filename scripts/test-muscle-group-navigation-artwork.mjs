import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { ACCESSORY_MUSCLE_GROUPS, ACCESSORY_PICKER_REGIONS } from '../lib/canonical-accessory-discovery.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
// Evaluate the real registry/resolver; Node represents Metro PNG imports as paths.
const exports = {};
const compiled = ts.transpileModule(read('lib/accessory-muscle-region-assets.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('require', 'exports', compiled)((relative) => {
  assert.match(relative, /^\.\.\/assets\/images\/muscle-regions\/[a-z-]+\.png$/);
  const absolute = path.resolve(root, 'lib', relative);
  const bytes = fs.readFileSync(absolute);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  return absolute;
}, exports);

const { canonicalMuscleGroupArtwork: resolve } = exports;
const missing = ['neck', 'serratus'];
const audited = [];
for (const [key, label] of ACCESSORY_MUSCLE_GROUPS) {
  const asset = resolve(key);
  if (missing.includes(key)) {
    assert.equal(asset, null, `${label} must report missing dedicated art, not use another muscle's image`);
  } else {
    assert.ok(asset, `${label} dedicated artwork is missing`);
    assert.equal(path.basename(asset.source), `${key.replaceAll('_', '-')}.png`, `${label} must use its exact established image`);
  }
  audited.push({ key, label, file: asset ? path.basename(asset.source) : null });
}
for (const region of ACCESSORY_PICKER_REGIONS) {
  const asset = resolve(region.artwork);
  assert.equal(Boolean(asset), region.key !== 'other', `${region.label} parent coverage`);
  region.muscles.forEach((key) => assert.ok(ACCESSORY_MUSCLE_GROUPS.some(([known]) => key === known)));
}
assert.equal(path.basename(resolve(ACCESSORY_PICKER_REGIONS.find(({ key }) => key === 'legs').artwork).source), 'quads.png', 'Legs parent remains unchanged');
assert.equal(path.basename(resolve('back_region').source), 'back-region.png');
for (const key of [null, undefined, '', 'unknown', 'Quads', 'toString', '__proto__']) {
  assert.equal(resolve(key), null, 'unknown keys must not silently select any image');
}
// Legacy consumers stay compatible; strict navigation alone rejects their aliases.
assert.equal(path.basename(exports.accessoryMuscleRegionAsset('serratus').source), 'chest.png');
assert.equal(path.basename(exports.accessoryMuscleRegionAsset('neck').source), 'traps.png');

const component = read('components/movement/CanonicalMuscleGroupArtwork.tsx');
assert.match(component, /canonicalMuscleGroupArtwork\(group\)/);
assert.match(component, /resizeMode="contain" source=\{asset.source\}/);
assert.match(component, /Art unavailable/);
assert.doesNotMatch(component, /MuscleMap|GovernedMuscleThumbnail|anatomy-system|require\(/);
const picker = read('components/movement/GovernedAccessoryPickerModal.tsx');
assert.match(picker, /context: 'in-session-substitution' \| 'in-session-addition'/);
assert.match(picker, /<CanonicalMuscleGroupArtwork group=\{region.artwork\}/);
assert.match(picker, /<CanonicalMuscleGroupArtwork group=\{selectedRegion.artwork\}/);
assert.match(picker, /<CanonicalMuscleGroupArtwork group=\{muscle\}/);
assert.doesNotMatch(picker, /MuscleMap|GovernedMuscleThumbnail|accessoryRegionalArtworkAsset/);
const logger = read('app/(tabs)/workout/[workoutId].tsx');
assert.match(logger, /GovernedAccessorySubstitutionPickerModal/);
assert.match(logger, /ActiveCompositionEditor/);
const composition = read('components/workout-logger/active-composition-editor.tsx');
assert.match(composition, /GovernedAccessorySubstitutionPickerModal/);
assert.match(composition, /context="in-session-addition"/);
assert.match(logger, /context="in-session-substitution"/);
const workspace = read('app/(tabs)/workout/session-workspace/[workoutId].tsx');
assert.equal((workspace.match(/<AnatomyTargetArt\b/g) || []).length, 1, 'only the combined custom targeting review keeps anatomy');
assert.match(workspace, /<CanonicalMuscleGroupArtwork group=\{option.key\}/);
assert.doesNotMatch(workspace, /region.artwork_key \|\| 'full_body'/, 'missing server artwork must remain missing');
assert.match(workspace, /<CanonicalMovementArtwork/);
console.log(JSON.stringify({ parents: ACCESSORY_PICKER_REGIONS.length, muscleGroups: audited, missingDedicatedArt: missing }, null, 2));
console.log('[muscle-group-navigation-artwork] shared Add/Swap + Programming taxonomy, strict missing state, and anatomy boundary PASS');
