#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACCESSORY_PICKER_REGIONS,
} from '../lib/canonical-accessory-discovery.ts';
import {
  ANATOMY_COLORS,
  GOVERNED_MUSCLE_IDS,
  resolveAnatomyPresentation,
  resolveAnatomyView,
} from '../lib/anatomy-system.ts';
import {
  anatomyBoundsContains,
  resolveAnatomyFraming,
} from '../lib/anatomy-framing.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const pngDimensions = (...parts) => {
  const bytes = fs.readFileSync(path.join(root, ...parts));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${parts.at(-1)} must remain a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const pickerMuscles = [...new Set(ACCESSORY_PICKER_REGIONS.flatMap((region) => region.muscles))];
assert.deepEqual(
  [...pickerMuscles].sort(),
  [...GOVERNED_MUSCLE_IDS].sort(),
  'Browse by Muscle Group must audit every governed muscle instead of a hand-picked Arms subset',
);

for (const muscle of pickerMuscles) {
  const resolvedView = resolveAnatomyView([muscle], [], 'auto', 'thumbnail');
  const views = resolvedView === 'dual' ? ['front', 'rear'] : [resolvedView];
  for (const view of views) {
    const framing = resolveAnatomyFraming({
      primary: [muscle],
      view,
      size: 'thumbnail',
      surface: 'square',
      destinationAspectRatio: 1,
    });
    assert.equal(framing.surface, 'square', `${muscle}/${view} must use the deliberate square thumbnail preset`);
    assert.equal(framing.isFullBody, false, `${muscle}/${view} must not shrink an unframed full body into the row tile`);
    assert.ok(anatomyBoundsContains(framing.viewBox, framing.targetBounds), `${muscle}/${view} cropped highlighted anatomy`);
    assert.ok(framing.viewBox.height <= 350, `${muscle}/${view} is too distant to identify at 58 px`);
    assert.ok(
      framing.targetBounds.width * framing.targetBounds.height / (framing.viewBox.width * framing.viewBox.height) >= 0.08,
      `${muscle}/${view} highlight is only a tiny fragment of its tile`,
    );
  }
}

assert.equal(resolveAnatomyView(['biceps'], [], 'auto', 'thumbnail'), 'front', 'Biceps must show the governed front anatomy');
assert.equal(resolveAnatomyView(['triceps'], [], 'auto', 'thumbnail'), 'rear', 'Triceps must show the governed rear anatomy');
assert.equal(resolveAnatomyView(['forearms'], [], 'auto', 'thumbnail'), 'front', 'Forearms must show the governed readable front anatomy');
for (const muscle of ['biceps', 'triceps', 'forearms']) {
  const view = resolveAnatomyView([muscle], [], 'auto', 'thumbnail');
  const framing = resolveAnatomyFraming({ primary: [muscle], view, size: 'thumbnail', surface: 'square', destinationAspectRatio: 1 });
  assert.ok(anatomyBoundsContains(framing.viewBox, framing.targetBounds), `${muscle} row must include its complete highlight`);
}

assert.equal(resolveAnatomyPresentation({ preference: 'masculine', sex: 'F' }), 'masculine');
assert.equal(resolveAnatomyPresentation({ preference: 'feminine', sex: 'M' }), 'feminine');
assert.deepEqual(ANATOMY_COLORS, {
  primary: '#9C4DFF',
  primaryEdge: '#D7A8FF',
  secondary: '#E447B7',
  secondaryEdge: '#FF9BE2',
  inactive: '#31343A',
}, 'thumbnail colors must stay on the canonical violet / magenta / graphite system');

for (const presentation of ['masculine', 'feminine']) {
  for (const view of ['front', 'rear']) {
    assert.deepEqual(
      pngDimensions('assets', 'images', 'anatomy-v2', 'masters', `${presentation}-${view}-v1.png`),
      { width: 418, height: 941 },
      `${presentation}/${view} must use the canonical anatomy master`,
    );
  }
}

const thumbnail = read('components', 'anatomy', 'GovernedMuscleThumbnail.tsx');
const picker = read('components', 'movement', 'GovernedAccessoryPickerModal.tsx');
const logger = read('app', '(tabs)', 'workout', '[workoutId].tsx');
const workspace = read('app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx');

assert.match(thumbnail, /<MuscleMap[\s\S]*semanticLevel="session"[\s\S]*size="thumbnail"[\s\S]*surface="square"[\s\S]*view="auto"/, 'shared rows must use the Dynamic Anatomy System and deliberate square framing');
assert.doesNotMatch(thumbnail, /\bImage\b|accessoryMuscleRegionAsset/, 'shared rows must not fall back to pre-cropped raster fragments');
assert.match(picker, /<GovernedMuscleThumbnail[\s\S]*testID=\{`swap-muscle-thumbnail-\$\{muscle\}`\}/, 'Swap rows must render the shared governed thumbnail');
assert.doesNotMatch(picker, /accessoryMuscleRegionAsset|StyleSheet\.absoluteFillObject/, 'Swap drill-down must not place legacy crops in an overflow-hidden tile');
assert.match(picker, /Browse by Muscle Group[\s\S]*setSelectedRegion\(region\)[\s\S]*selectedRegion\.muscles/, 'Swap region-to-muscle navigation must remain reachable');
assert.match(picker, /setSelectedMuscle\(muscle\)[\s\S]*setMode\('muscle'\)[\s\S]*setStep\('results'\)/, 'muscle selection must still open its governed accessory list');
assert.match(logger, /athleteAnatomy=\{\{[\s\S]*anatomy_display_preference[\s\S]*sex:/, 'Swap must honor the athlete anatomy preference returned by the Session payload');
assert.match(workspace, /<GovernedMuscleThumbnail[\s\S]*workspace-muscle-thumbnail-/, 'Session Workspace drill-down must share the corrected group renderer');
assert.match(workspace, /<CanonicalMovementArtwork[\s\S]*kind: 'accessory'/, 'individual result rows must remain on canonical movement artwork');
assert.doesNotMatch(workspace, /<MuscleMap/, 'Session Workspace must not render aggregate anatomy directly for an individual movement');

console.log(`[swap-muscle-thumbnail-framing] PASS — ${pickerMuscles.length}/${GOVERNED_MUSCLE_IDS.length} governed groups, masculine/feminine masters, navigation, and Session Workspace preservation`);
