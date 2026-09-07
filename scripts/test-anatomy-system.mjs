import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ANATOMY_QA_PRESETS,
  GOVERNED_MUSCLE_IDS,
  aggregateProgrammingWeekFocus,
  aggregateSessionMuscleFocus,
  anatomyRenderKey,
  normalizeMuscleRoles,
  resolveAnatomyPresentation,
  resolveAnatomyRegion,
  resolveAnatomyView,
} from '../lib/anatomy-system.ts';

assert.equal(GOVERNED_MUSCLE_IDS.length, 22, 'governed accessory taxonomy coverage drifted');
assert.equal(new Set(GOVERNED_MUSCLE_IDS).size, 22, 'governed muscle IDs must be unique');

assert.equal(resolveAnatomyPresentation({ preference: 'feminine', sex: 'M' }), 'feminine');
assert.equal(resolveAnatomyPresentation({ preference: 'automatic', sex: 'F' }), 'feminine');
assert.equal(resolveAnatomyPresentation({ preference: 'automatic', sex: null }), 'masculine');

assert.equal(resolveAnatomyView(['chest', 'front_delts'], ['triceps'], 'auto', 'card'), 'dual');
assert.equal(resolveAnatomyView(['lats', 'upper_back'], ['rear_delts'], 'auto', 'card'), 'rear');
assert.equal(resolveAnatomyView(['quads', 'glutes', 'hamstrings'], [], 'auto', 'card'), 'dual');
assert.equal(resolveAnatomyView(['quads', 'glutes'], [], 'auto', 'thumbnail'), 'dual');

assert.equal(resolveAnatomyRegion(['chest', 'front_delts'], ['triceps'], 'session'), 'upper');
assert.equal(resolveAnatomyRegion(['lats', 'upper_back'], ['rear_delts'], 'session'), 'torso');
assert.equal(resolveAnatomyRegion(['quads', 'hamstrings', 'glutes'], ['calves'], 'session'), 'lower');
assert.equal(resolveAnatomyRegion(['biceps', 'triceps'], ['forearms'], 'session'), 'arms');
assert.equal(resolveAnatomyRegion(['chest', 'quads', 'lats', 'glutes'], [], 'week'), 'full');
assert.equal(resolveAnatomyRegion(['hamstrings'], ['glutes'], 'movement'), 'full', 'Movement anatomy must preserve complete relationships');
assert.equal(resolveAnatomyRegion(['chest'], [], 'session', 'torso'), 'torso', 'explicit framing must win');

assert.deepEqual(aggregateProgrammingWeekFocus([
  { primary: [{ muscle_id: 'lats', score: 8 }, { muscle_id: 'upper_back', score: 5 }], secondary: [{ muscle_id: 'biceps', score: 3 }] },
  { primary: [{ muscle_id: 'quads', score: 10 }], secondary: [{ muscle_id: 'glutes', score: 4 }] },
  { primary: [{ muscle_id: 'lats', score: 6 }], secondary: [{ muscle_id: 'biceps', score: 2 }, { muscle_id: 'unknown', score: 99 }] },
]), {
  primary: ['lats', 'quads', 'upper_back'],
  secondary: ['biceps', 'glutes'],
});

assert.deepEqual(normalizeMuscleRoles(['chest', 'chest', 'unknown'], ['chest', 'triceps', 'triceps']), {
  primary: ['chest'], secondary: ['triceps'],
});

const focus = aggregateSessionMuscleFocus([
  { primaryMuscle: 'chest', secondaryMuscles: ['front_delts', 'triceps'], prescribedSets: 4 },
  { primaryMuscle: 'chest', secondaryMuscles: ['front_delts'], prescribedSets: 3 },
  { primaryMuscle: 'side_delts', secondaryMuscles: [], prescribedSets: 3 },
], 'planned');
assert.equal(focus.source, 'planned');
assert.equal(focus.primary[0].muscle_id, 'chest');
assert.ok(focus.secondary.some((row) => row.muscle_id === 'front_delts'));

const completed = aggregateSessionMuscleFocus([
  { primaryMuscle: 'quads', secondaryMuscles: ['glutes'], prescribedSets: 4, performedSets: 2 },
  { primaryMuscle: 'hamstrings', secondaryMuscles: ['glutes'], prescribedSets: 4, performedSets: 0 },
], 'performed');
assert.deepEqual(completed.primary, [{ muscle_id: 'quads', score: 2 }]);
assert.ok(!completed.primary.some((row) => row.muscle_id === 'hamstrings'));

const keyA = anatomyRenderKey({ presentation: 'feminine', view: 'dual', primary: ['chest', 'front_delts'], secondary: ['triceps'], size: 'card' });
const keyB = anatomyRenderKey({ presentation: 'feminine', view: 'dual', primary: ['front_delts', 'chest'], secondary: ['triceps'], size: 'card' });
assert.equal(keyA, keyB, 'cache key must be order stable');
assert.notEqual(
  anatomyRenderKey({ presentation: 'feminine', view: 'front', region: 'torso', primary: ['chest'], size: 'card' }),
  anatomyRenderKey({ presentation: 'feminine', view: 'front', region: 'full', primary: ['chest'], size: 'card' }),
  'region-aware frames must not collide in the render cache',
);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const masks = read('components', 'anatomy', 'anatomy-mask-registry.tsx');
const renderer = read('components', 'anatomy', 'MuscleMap.tsx');
const labPath = path.join(root, 'app', '(tabs)', 'dev-mocks', 'anatomy-system.tsx');
const libraryPath = path.join(root, 'dev-mocks', 'library.ts');
const lab = fs.existsSync(labPath) ? fs.readFileSync(labPath, 'utf8') : null;
const library = fs.existsSync(libraryPath) ? fs.readFileSync(libraryPath, 'utf8') : null;
for (const muscle of GOVERNED_MUSCLE_IDS) {
  assert.equal(
    [...masks.matchAll(new RegExp(`\\b${muscle}: \\[`, 'g'))].length,
    4,
    `${muscle} must be explicitly registered for all four presentation/view masters`,
  );
  if (lab) assert.match(lab, new RegExp(`MUSCLE_META\\[muscle\\]`), 'the QA lab must enumerate governed muscle metadata');
}
for (const asset of [
  'masculine-front-v1.png',
  'masculine-rear-v1.png',
  'feminine-front-v1.png',
  'feminine-rear-v1.png',
]) {
  const absolute = path.join(root, 'assets', 'images', 'anatomy-v2', 'masters', asset);
  assert.ok(fs.existsSync(absolute), `missing anatomy master ${asset}`);
  const png = fs.readFileSync(absolute);
  assert.equal(png.readUInt32BE(16), 418, `${asset} width drifted from the registered coordinate system`);
  assert.equal(png.readUInt32BE(20), 941, `${asset} height drifted from the registered coordinate system`);
}
assert.match(masks, /ANATOMY_MASTER_CANVAS = Object\.freeze\(\{ width: 418, height: 941 \}\)/, 'mask canvas must match every master');
assert.match(masks, /REGISTERED_ANATOMY_MASKS[\s\S]*masculine:[\s\S]*feminine:/, 'masculine and feminine geometry must be registered independently');
assert.doesNotMatch(masks, /\btransform\s*=|translate\(|scale\(/, 'registered geometry may not be transferred with corrective transforms');
assert.doesNotMatch(masks, /<(?:Circle|Ellipse|Rect)\b/, 'muscle overlays must use anatomically registered paths, not generic geometric blobs');
assert.match(renderer, /<Mask[\s\S]*maskType="alpha"[\s\S]*BASES\[presentation\]\[view\]/, 'overlays must be silhouette-clipped by the same registered master');
assert.match(renderer, /<G mask=\{`url\(#\$\{bodyMaskId\}\)`\}>/, 'all muscle overlays must be inside the silhouette mask');
assert.ok((renderer.match(/BASES\[presentation\]\[view\]/g) || []).length >= 3, 'base, silhouette, and texture-recovery layers must share one exact master');
if (lab) {
  for (const preset of [
    'Chest + Triceps', 'Lats + Biceps', 'Front + Side Delts',
    'Rear Delts + Upper Back + Traps', 'Quads + Adductors',
    'Hamstrings + Glutes', 'Abductors', 'Calves', 'Abs + Obliques',
    'Lower Back', 'Full Upper Body', 'Full Lower Body', 'Dense Session',
  ]) assert.ok(ANATOMY_QA_PRESETS[preset], `missing required QA preset ${preset}`);
  assert.match(lab, /PRESENTATIONS[\s\S]*masculine[\s\S]*feminine/, 'lab must toggle both presentations');
  assert.match(lab, /VIEWS[\s\S]*front[\s\S]*rear[\s\S]*dual/, 'lab must toggle front, rear, and dual views');
  assert.match(lab, /Size Tests[\s\S]*thumbnail[\s\S]*card[\s\S]*hero/, 'lab must exercise all governed sizes');
}
if (library && lab) {
  assert.match(library, /id: 'anatomy-visualization-system'[\s\S]*route: '\/(?:\(tabs\)\/)?dev-mocks\/anatomy-system'/, 'the interactive anatomy lab must be registered in the UI Mock Library');
  assert.match(lab, /Interactive Lab[\s\S]*Muscle QA[\s\S]*Presets[\s\S]*Size Tests[\s\S]*Platform Previews/, 'the DEV lab must expose every certification section');
}

console.log('anatomy system contract: PASS');
