import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveAnatomyView } from '../lib/anatomy-system.ts';
import {
  ANATOMY_FRAMING_PRESETS,
  anatomyBoundsContains,
  resolveAnatomyFraming,
} from '../lib/anatomy-framing.ts';

const FULL_MASTER = Object.freeze({ x: 0, y: 0, width: 418, height: 941 });
const fixtures = [
  { name: 'Quads only', primary: ['quads'], secondary: [] },
  { name: 'Abs only', primary: ['abs'], secondary: [] },
  { name: 'Biceps only', primary: ['biceps'], secondary: [] },
  { name: 'Chest + Front Delts + Triceps', primary: ['chest', 'front_delts'], secondary: ['triceps'] },
  { name: 'Lats + Upper Back + Biceps', primary: ['lats', 'upper_back'], secondary: ['biceps'] },
  { name: 'Glutes + Hamstrings', primary: ['glutes', 'hamstrings'], secondary: [] },
  { name: 'Mixed upper + lower', primary: ['chest', 'quads'], secondary: ['biceps', 'calves'] },
];
const presets = ['thumbnail', 'card', 'hero', 'dual'];

for (const fixture of fixtures) {
  const resolved = resolveAnatomyView(fixture.primary, fixture.secondary, 'auto', 'card');
  const views = resolved === 'dual' ? ['front', 'rear'] : [resolved];
  for (const view of views) {
    for (const preset of presets) {
      const expected = ANATOMY_FRAMING_PRESETS[preset];
      for (const ratio of [0.45, 0.72, 1, 1.6, 2.4]) {
        const framing = resolveAnatomyFraming({
          ...fixture,
          view,
          size: preset === 'thumbnail' ? 'thumbnail' : preset === 'hero' ? 'hero' : 'card',
          preset,
          destinationAspectRatio: ratio,
        });
        assert.equal(framing.isFullBody, true, `${fixture.name}/${view}/${preset} must remain full body`);
        assert.equal(framing.preset, preset, `${fixture.name}/${view} lost its requested preset`);
        assert.ok(anatomyBoundsContains(framing.viewBox, FULL_MASTER), `${fixture.name}/${view}/${preset} cropped the master silhouette`);
        assert.ok(anatomyBoundsContains(framing.viewBox, framing.targetBounds), `${fixture.name}/${view}/${preset} cropped highlighted evidence`);
        assert.deepEqual(framing.viewBox, {
          x: -expected.horizontalSafePadding,
          y: -expected.verticalSafePadding,
          width: 418 + expected.horizontalSafePadding * 2,
          height: 941 + expected.verticalSafePadding * 2,
        }, `${fixture.name}/${view}/${preset} lost canonical safe padding`);
        assert.ok(framing.scale > 0 && Number.isFinite(framing.translateX) && Number.isFinite(framing.translateY), `${fixture.name}/${view}/${preset} emitted invalid transforms`);
      }
    }
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const renderer = source('components/anatomy/MuscleMap.tsx');
const framingSource = source('lib/anatomy-framing.ts');
const sharedArt = source('components/anatomy/ProgrammingMuscleRegionArt.tsx');

assert.match(renderer, /preserveAspectRatio="xMidYMid meet"/, 'canonical anatomy must preserve its authored aspect ratio');
assert.match(renderer, /effectiveFramingPreset[\s\S]*size === 'thumbnail'[\s\S]*size === 'hero'/, 'missed consumers must fail safe to a full-body preset');
assert.doesNotMatch(framingSource, /fitAspect|classifySurface|forceFullBody|surface:/, 'target-aware crop machinery must not return');
assert.match(sharedArt, /framingPreset = 'card'/, 'aggregate wrapper must fail safe to non-destructive card framing');
assert.match(sharedArt, /framingPreset=\{framingPreset\}/, 'aggregate wrapper must forward its governed preset');

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
]) {
  assert.match(source(relative), /ProgrammingMuscleRegionArt/, `${relative} bypasses the shared aggregate anatomy renderer`);
}
assert.match(source('components/home/AthleteHomeV3.tsx'), /framingPreset="card"[\s\S]*framingPreset="thumbnail"/, 'Home hero and compact cards must use governed framing presets');
assert.doesNotMatch(source('app/(tabs)/coach-calendar.tsx'), /sessionAnatomy:\s*\{[^}]*bottom:\s*-/s, 'Calendar anatomy must not use a negative crop offset');
assert.doesNotMatch(source('components/training-hub/AthleteTrainingHubExperience.tsx'), /sessionArtwork:\s*\{[^}]*resizeMode/s, 'Training Hub anatomy containers must not use photographic resize rules');

assert.match(source('app/(tabs)/workout/session-workspace/[workoutId].tsx'), /GovernedMuscleThumbnail/, 'Session Workspace muscle discovery must keep shared governed group thumbnails');
assert.match(source('lib/canonical-movement-artwork.ts'), /focusedAccessoryMuscleRegionKey/, 'individual accessories must retain exact governed movement artwork');
assert.doesNotMatch(source('lib/canonical-movement-artwork.ts'), /MuscleMap/, 'individual movement artwork must not regain an aggregate humanoid fallback');

console.log('[anatomy-framing] full-master, safe-padded, aspect-preserving presentation contracts passed');
