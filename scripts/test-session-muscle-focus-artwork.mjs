import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveProgrammingRegionArtwork } from '../lib/programming-visual-semantics.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

assert.deepEqual(resolveProgrammingRegionArtwork([], 'session'), [], 'missing identity must fail neutral');
assert.deepEqual(
  resolveProgrammingRegionArtwork(['quads', 'glutes', 'adductors'], 'session'),
  ['quads', 'glutes'],
  'whole-Session mixed focus keeps the two dominant governed regions',
);
assert.deepEqual(
  resolveProgrammingRegionArtwork(['lats', 'upper_back'], 'session'),
  ['back_region'],
  'compatible back emphasis uses the purpose-built regional asset',
);

const artwork = source('components/anatomy/ProgrammingMuscleRegionArt.tsx');
assert.match(artwork, /Session muscle focus unavailable/);
assert.match(artwork, /MuscleMap/);
assert.match(artwork, /athlete=\{athlete\}/, 'aggregate anatomy must preserve the existing athlete presentation preference');
assert.doesNotMatch(artwork, /accessoryRegionalArtworkAsset/);

const coachHome = source('components/coach-mobile/CoachActivityHome.tsx');
assert.match(coachHome, /session\.muscle_focus/);
assert.match(coachHome, /activity\.artwork\?\.muscle_focus \|\| activity\.evidence\.muscle_focus/);
assert.doesNotMatch(coachHome, /function anatomyKeys/);
assert.doesNotMatch(coachHome, /<MuscleMap/, 'aggregate consumers must route through the shared framing wrapper');

const manager = source('app/(tabs)/workout/index.tsx');
assert.match(manager, /ProgrammingMuscleRegionArt[^>]*framingPreset="thumbnail"[^>]*level="session"[^>]*primary=\{focus\.primary\}[^>]*secondary=\{focus\.secondary\}/);
assert.doesNotMatch(manager, /storyboardSessionLiftArtwork/);

for (const relative of [
  'components/training-hub/AthleteTrainingHubExperience.tsx',
  'components/training-hub/AthleteBlockDetailsSheet.tsx',
  'components/training-hub/AthleteProgramTimeline.tsx',
  'components/home/AthleteHomeV3.tsx',
  'components/coach-mobile/CoachAthleteHubV2.tsx',
  'components/coach-mobile/CoachAthleteHubSheet.tsx',
  'components/coach-mobile/CompletedSessionRecap.tsx',
  'app/(tabs)/coach-calendar.tsx',
]) {
  assert.match(source(relative), /ProgrammingMuscleRegionArt/, `${relative} must use canonical Session region artwork`);
}
assert.match(
  source('app/(tabs)/workout/session-workspace/[workoutId].tsx'),
  /GovernedMuscleThumbnail/,
  'Session Workspace muscle drill-down must use the governed aggregate thumbnail wrapper',
);
assert.match(
  source('components/home/AthleteHomeV3.tsx'),
  /<ProgrammingMuscleRegionArt athlete=\{today\.athlete\}/,
  'Athlete Home aggregate anatomy must use the athlete preference returned by its payload',
);
assert.match(
  source('components/coach-mobile/CompletedSessionRecap.tsx'),
  /<ProgrammingMuscleRegionArt athlete=\{recap\.athlete\}/,
  'post-Session aggregate anatomy must use the reviewed athlete preference',
);

console.log('[session-muscle-focus-artwork] canonical projection and cross-surface aggregate anatomy contracts passed');
