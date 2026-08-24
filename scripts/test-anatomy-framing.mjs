import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveAnatomyView } from '../lib/anatomy-system.ts';
import {
  anatomyBoundsContains,
  resolveAnatomyFraming,
} from '../lib/anatomy-framing.ts';

const fixtures = [
  { name: 'Quads only', primary: ['quads'], secondary: [] },
  { name: 'Abs only', primary: ['abs'], secondary: [] },
  { name: 'Biceps only', primary: ['biceps'], secondary: [] },
  { name: 'Chest + Front Delts + Triceps', primary: ['chest', 'front_delts'], secondary: ['triceps'] },
  { name: 'Lats + Upper Back + Biceps', primary: ['lats', 'upper_back'], secondary: ['biceps'] },
  { name: 'Glutes + Hamstrings', primary: ['glutes', 'hamstrings'], secondary: [] },
  { name: 'Quads + Glutes', primary: ['quads', 'glutes'], secondary: [] },
  { name: 'Rear Delts + Upper Back', primary: ['rear_delts', 'upper_back'], secondary: [] },
  { name: 'Abs + Biceps', primary: ['abs', 'biceps'], secondary: [] },
  { name: 'Mixed upper + lower', primary: ['chest', 'quads'], secondary: ['biceps', 'calves'] },
  { name: 'True full body', primary: ['chest', 'lats', 'quads', 'glutes', 'abs'], secondary: ['triceps', 'biceps', 'hamstrings', 'calves'] },
];

for (const fixture of fixtures) {
  const resolved = resolveAnatomyView(fixture.primary, fixture.secondary, 'auto', 'card');
  const views = resolved === 'dual' ? ['front', 'rear'] : [resolved];
  for (const view of views) {
    const framing = resolveAnatomyFraming({
      ...fixture,
      view,
      size: 'card',
      destinationAspectRatio: 0.72,
    });
    assert.ok(anatomyBoundsContains(framing.viewBox, framing.targetBounds), `${fixture.name}/${view} cropped a highlighted target`);
    assert.ok(framing.scale > 0 && Number.isFinite(framing.translateX) && Number.isFinite(framing.translateY), `${fixture.name}/${view} emitted invalid transforms`);
    if (fixture.name !== 'True full body' && fixture.name !== 'Mixed upper + lower') {
      assert.ok(framing.viewBox.height < 760, `${fixture.name}/${view} retained generic full-body framing`);
    }
    if (fixture.name === 'Mixed upper + lower') {
      assert.ok(framing.viewBox.height < 900, `${fixture.name}/${view} failed to frame its actual broad target span`);
    }
  }
}

const quads = resolveAnatomyFraming({ primary: ['quads'], view: 'front', size: 'card', destinationAspectRatio: 0.72 });
const absAndArms = resolveAnatomyFraming({ primary: ['abs', 'biceps'], view: 'front', size: 'card', destinationAspectRatio: 0.72 });
const fullBody = resolveAnatomyFraming({
  primary: ['chest', 'lats', 'quads', 'glutes', 'abs'],
  secondary: ['triceps', 'biceps', 'hamstrings', 'calves'],
  view: 'front',
  size: 'card',
  destinationAspectRatio: 0.72,
});
assert.ok(quads.viewBox.y > 300 && quads.viewBox.height < 500, 'W4 Legs must frame hips through the upper legs');
assert.ok(absAndArms.viewBox.y > 100 && absAndArms.viewBox.height < 520, 'W4 Abs / Misc must frame torso and arms tightly');
assert.ok(fullBody.isFullBody && fullBody.viewBox.height === 941, 'true full-body emphasis must pull back honestly');

const sparseQuads = resolveAnatomyFraming({ primary: ['quads'], view: 'front', size: 'card', destinationAspectRatio: 0.72 });
const broadLegs = resolveAnatomyFraming({ primary: ['quads', 'adductors', 'calves'], view: 'front', size: 'card', destinationAspectRatio: 0.72 });
assert.ok(sparseQuads.viewBox.height < broadLegs.viewBox.height, 'sparse target sets must zoom more tightly than broad target sets');

for (const ratio of [0.45, 0.72, 1, 1.6]) {
  const framing = resolveAnatomyFraming({ primary: ['lats', 'upper_back'], secondary: ['biceps'], view: 'rear', size: 'card', destinationAspectRatio: ratio });
  assert.ok(anatomyBoundsContains(framing.viewBox, framing.targetBounds), `responsive ${ratio} crop lost target evidence`);
  assert.ok(Math.abs(framing.viewBox.width / framing.viewBox.height - framing.destinationAspectRatio) < 0.001, `responsive ${ratio} crop distorted the destination composition`);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const sharedArt = source('components/anatomy/ProgrammingMuscleRegionArt.tsx');
assert.match(sharedArt, /<MuscleMap/);
assert.doesNotMatch(sharedArt, /accessoryRegionalArtworkAsset|resizeMode="contain"/);

for (const relative of [
  'components/home/AthleteHomeV3.tsx',
  'components/coach-mobile/CoachActivityHome.tsx',
  'components/coach-mobile/CoachAthleteHubV2.tsx',
  'components/coach-mobile/CoachAthleteHubSheet.tsx',
  'components/training-hub/AthleteTrainingHubExperience.tsx',
  'components/training-hub/AthleteBlockDetailsSheet.tsx',
  'components/training-hub/AthleteProgramTimeline.tsx',
  'components/coach-mobile/CompletedSessionRecap.tsx',
  'app/(tabs)/coach-calendar.tsx',
  'app/(tabs)/workout/index.tsx',
  'app/(tabs)/workout/session-workspace/[workoutId].tsx',
]) {
  assert.match(source(relative), /ProgrammingMuscleRegionArt/, `${relative} bypasses the shared aggregate anatomy renderer`);
}

const canonicalArtwork = source('lib/canonical-movement-artwork.ts');
assert.match(canonicalArtwork, /focusedAccessoryMuscleRegionKey/, 'individual accessory artwork must remain governed by focused muscle-region PNG identity');
assert.doesNotMatch(canonicalArtwork, /MuscleMap/, 'individual movement resolver must not regain aggregate humanoid fallback');

console.log('[anatomy-framing] target-aware aggregate framing contracts passed');
