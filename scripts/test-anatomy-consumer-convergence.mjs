import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function filesBelow(relative) {
  const result = [];
  const visit = (absolute) => {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const target = path.join(absolute, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) result.push(path.relative(root, target));
    }
  };
  visit(path.join(root, relative));
  return result;
}

const productFiles = ['app', 'components', 'lib'].flatMap(filesBelow);
const hasDevAnatomyLab = fs.existsSync(path.join(root, 'app/(tabs)/dev-mocks/anatomy-system.tsx'));

const directMuscleMapConsumers = productFiles.filter((relative) => {
  const contents = source(relative);
  return /(?:from ['"][^'"]*MuscleMap['"]|<MuscleMap\b)/.test(contents)
    && relative !== 'components/anatomy/MuscleMap.tsx';
});
assert.deepEqual(directMuscleMapConsumers.sort(), [
  ...(hasDevAnatomyLab ? ['app/(tabs)/dev-mocks/anatomy-system.tsx'] : []),
  'components/anatomy/GovernedMuscleThumbnail.tsx',
  'components/anatomy/ProgrammingMuscleRegionArt.tsx',
  'components/ledger/AccessoriesExperience.tsx',
  'components/ledger/exploration-experiences.tsx',
].sort(), 'an aggregate anatomy consumer bypassed the governed renderer boundary or was not inventoried');

const masterAssetConsumers = productFiles.filter((relative) => /anatomy-v2\/masters/.test(source(relative)));
assert.deepEqual(masterAssetConsumers, ['components/anatomy/MuscleMap.tsx'], 'only MuscleMap may load registered full-figure masters');

const maskRegistryConsumers = productFiles.filter((relative) => /anatomy-mask-registry/.test(source(relative)));
assert.deepEqual(maskRegistryConsumers.sort(), [
  ...(hasDevAnatomyLab ? ['app/(tabs)/dev-mocks/anatomy-system.tsx'] : []),
  'components/anatomy/MuscleMap.tsx',
].sort(), 'only the canonical renderer and DEV lab may import registered segment geometry');

const aggregateWrapper = source('components/anatomy/ProgrammingMuscleRegionArt.tsx');
assert.match(aggregateWrapper, /athlete\?: ProgrammingAthleteAnatomy \| null/, 'aggregate wrapper must accept governed athlete anatomy preference');
assert.match(aggregateWrapper, /<MuscleMap[\s\S]*athlete=\{athlete\}/, 'aggregate wrapper must forward governed athlete anatomy preference');
assert.match(aggregateWrapper, /framingPreset = 'card'/, 'aggregate wrapper must default to a full-figure card preset');
assert.match(aggregateWrapper, /framingPreset=\{framingPreset\}/, 'aggregate wrapper must forward its presentation preset');

const athleteHome = source('components/home/AthleteHomeV3.tsx');
assert.match(athleteHome, /<ProgrammingMuscleRegionArt athlete=\{today\.athlete\}/, 'Athlete Home must honor the athlete anatomy preference');

const trainingHub = source('components/training-hub/AthleteTrainingHubExperience.tsx');
assert.match(trainingHub, /<ProgrammingMuscleRegionArt athlete=\{athlete\}/, 'Training Hub session evidence must honor the athlete anatomy preference');

const completedRecap = source('components/coach-mobile/CompletedSessionRecap.tsx');
assert.match(completedRecap, /<ProgrammingMuscleRegionArt athlete=\{recap\.athlete\}/, 'post-Session evidence must honor the reviewed athlete anatomy preference');

for (const relative of productFiles) {
  const contents = source(relative);
  if (relative !== 'components/anatomy/MuscleMap.tsx') {
    assert.doesNotMatch(contents, /anatomy-v2\/materials/, `${relative} bypassed the canonical material renderer`);
  }
  assert.doesNotMatch(contents, /muscle(?:Overlay|Position|Offset|Transform)\s*[:=]/i, `${relative} introduced prohibited runtime-positioned anatomy`);
  assert.doesNotMatch(contents, /<MuscleMap\b[^>]*\bsurface=/s, `${relative} reintroduced a destructive anatomy crop surface`);
}

const renderer = source('components/anatomy/MuscleMap.tsx');
assert.match(renderer, /preserveAspectRatio="xMidYMid meet"/, 'canonical anatomy must preserve the authored aspect ratio');
assert.match(renderer, /effectiveFramingPreset[\s\S]*size === 'thumbnail'[\s\S]*size === 'hero'/, 'unannotated consumers must fail safe by governed size');
assert.doesNotMatch(source('lib/anatomy-framing.ts'), /fitAspect|classifySurface|forceFullBody/, 'target-driven crop machinery must not return');

for (const relative of [
  'components/home/AthleteHomeV3.tsx',
  'components/coach-mobile/CoachActivityHome.tsx',
  'components/coach-mobile/CoachAthleteHubV2.tsx',
  'components/coach-mobile/CoachAthleteHubSheet.tsx',
  'components/coach-mobile/CompletedSessionRecap.tsx',
  'components/training-hub/AthleteTrainingHubExperience.tsx',
  'components/training-hub/AthleteBlockDetailsSheet.tsx',
  'components/training-hub/AthleteProgramTimeline.tsx',
  'app/(tabs)/coach-calendar.tsx',
  'app/(tabs)/workout/index.tsx',
]) {
  assert.match(source(relative), /ProgrammingMuscleRegionArt/, `${relative} must render aggregate evidence through ProgrammingMuscleRegionArt`);
}

assert.match(source('app/(tabs)/workout/session-workspace/[workoutId].tsx'), /GovernedMuscleThumbnail/, 'Programming muscle drill-down must use governed aggregate thumbnails');
assert.doesNotMatch(source('components/ledger/AccessoriesExperience.tsx'), /libraryAnatomy:\s*\{[^}]*transform/s, 'Accessories thumbnails may not apply a private geometry transform');
assert.doesNotMatch(source('components/ledger/exploration-experiences.tsx'), /muscleRowAnatomy:\s*\{[^}]*transform/s, 'Ledger muscle rows may not apply a private geometry transform');
assert.doesNotMatch(source('components/coach-mobile/CoachActivityHome.tsx'), /anatomy:\s*\{[^}]*transform/s, 'Coach activity may not apply a private geometry transform');
assert.doesNotMatch(source('app/(tabs)/coach-calendar.tsx'), /sessionAnatomy:\s*\{[^}]*bottom:\s*-/s, 'Calendar session anatomy may not be pushed out of its frame');
assert.doesNotMatch(source('components/training-hub/AthleteTrainingHubExperience.tsx'), /sessionArtwork:\s*\{[^}]*resizeMode/s, 'Training Hub anatomy may not use photographic resize rules');

// Exact movement surfaces intentionally retain focused movement artwork. Full
// figures are aggregate evidence and would violate the Individual Movement
// Artwork Law by erasing stable movement identity.
for (const relative of [
  'components/workout-logger/core-loggers.tsx',
  'components/workout-logger/substitution-confirmation-sheet.tsx',
  'components/coach-mobile/SessionEditingWorkspace.tsx',
  'app/(tabs)/workout/session-workspace/[workoutId].tsx',
  'components/movement/GovernedAccessoryPickerModal.tsx',
  'components/movement-history/CanonicalMovementHistoryScreen.tsx',
  'components/ledger/AccessoriesExperience.tsx',
  'components/ledger/exploration-experiences.tsx',
  'components/ledger/index-experience.tsx',
  'components/coach-mobile/CompletedSessionRecap.tsx',
]) {
  assert.match(source(relative), /CanonicalMovementArtwork/, `${relative} lost exact governed movement artwork`);
}
assert.doesNotMatch(source('lib/canonical-movement-artwork.ts'), /MuscleMap|anatomy-v2\/masters/, 'individual movement resolution may not fall back to aggregate anatomy');

console.log('[anatomy-consumer-convergence] shared renderer and exact-movement boundary: PASS');
