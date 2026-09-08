#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACCESSORY_PICKER_REGIONS } from '../lib/canonical-accessory-discovery.ts';
import {
  ANATOMY_COLORS,
  GOVERNED_MUSCLE_IDS,
  resolveAnatomyPresentation,
  resolveAnatomyView,
} from '../lib/anatomy-system.ts';
import { anatomyBoundsContains, resolveAnatomyFraming } from '../lib/anatomy-framing.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const fullMaster = { x: 0, y: 0, width: 418, height: 941 };
const pngDimensions = (...parts) => {
  const bytes = fs.readFileSync(path.join(root, ...parts));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${parts.at(-1)} must remain a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const pickerMuscles = [...new Set(ACCESSORY_PICKER_REGIONS.flatMap((region) => region.muscles))];
assert.deepEqual([...pickerMuscles].sort(), [...GOVERNED_MUSCLE_IDS].sort(), 'Browse by Muscle Group must audit every governed muscle');

for (const muscle of pickerMuscles) {
  const resolvedView = resolveAnatomyView([muscle], [], 'auto', 'thumbnail');
  const views = resolvedView === 'dual' ? ['front', 'rear'] : [resolvedView];
  for (const view of views) {
    const framing = resolveAnatomyFraming({ primary: [muscle], view, size: 'thumbnail', preset: 'thumbnail', destinationAspectRatio: 1 });
    assert.equal(framing.preset, 'thumbnail', `${muscle}/${view} must use the thumbnail preset`);
    assert.equal(framing.isFullBody, true, `${muscle}/${view} must show an intentional complete humanoid`);
    assert.ok(anatomyBoundsContains(framing.viewBox, fullMaster), `${muscle}/${view} cropped the anatomy master`);
    assert.ok(anatomyBoundsContains(framing.viewBox, framing.targetBounds), `${muscle}/${view} cropped highlighted anatomy`);
  }
}

assert.equal(resolveAnatomyView(['biceps'], [], 'auto', 'thumbnail'), 'front');
assert.equal(resolveAnatomyView(['triceps'], [], 'auto', 'thumbnail'), 'rear');
assert.equal(resolveAnatomyView(['forearms'], [], 'auto', 'thumbnail'), 'front');
assert.equal(resolveAnatomyPresentation({ preference: 'masculine', sex: 'F' }), 'masculine');
assert.equal(resolveAnatomyPresentation({ preference: 'feminine', sex: 'M' }), 'feminine');
assert.deepEqual(ANATOMY_COLORS, {
  primary: '#9C4DFF', primaryEdge: '#D7A8FF', secondary: '#E447B7', secondaryEdge: '#FF9BE2', inactive: '#31343A',
});

for (const presentation of ['masculine', 'feminine']) {
  for (const view of ['front', 'rear']) {
    assert.deepEqual(pngDimensions('assets', 'images', 'anatomy-v2', 'masters', `${presentation}-${view}-v1.png`), { width: 418, height: 941 });
  }
}

const thumbnail = read('components', 'anatomy', 'GovernedMuscleThumbnail.tsx');
const picker = read('components', 'movement', 'GovernedAccessoryPickerModal.tsx');
const logger = read('app', '(tabs)', 'workout', '[workoutId].tsx');
const workspace = read('app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx');

assert.match(thumbnail, /<MuscleMap[\s\S]*framingPreset="thumbnail"[\s\S]*semanticLevel="session"[\s\S]*size="thumbnail"[\s\S]*view="auto"/, 'shared rows must use full-figure thumbnail framing');
assert.doesNotMatch(thumbnail, /\bImage\b|accessoryMuscleRegionAsset|surface=/, 'shared rows must not use pre-cropped fragments or crop surfaces');
assert.match(picker, /<GovernedMuscleThumbnail[\s\S]*testID=\{`swap-muscle-thumbnail-\$\{muscle\}`\}/);
assert.doesNotMatch(picker, /accessoryMuscleRegionAsset|StyleSheet\.absoluteFillObject/);
assert.match(picker, /Browse by Muscle Group[\s\S]*setSelectedRegion\(region\)[\s\S]*selectedRegion\.muscles/);
assert.match(picker, /setSelectedMuscle\(muscle\)[\s\S]*setMode\('muscle'\)[\s\S]*setStep\('results'\)/);
assert.match(logger, /athleteAnatomy=\{\{[\s\S]*anatomy_display_preference[\s\S]*sex:/);
assert.match(workspace, /<GovernedMuscleThumbnail[\s\S]*workspace-muscle-thumbnail-/);
assert.match(workspace, /<CanonicalMovementArtwork[\s\S]*kind: 'accessory'/);
assert.doesNotMatch(workspace, /<MuscleMap/);

console.log(`[swap-muscle-thumbnail-framing] PASS — ${pickerMuscles.length}/${GOVERNED_MUSCLE_IDS.length} governed full-figure thumbnails and exact-movement boundary`);
