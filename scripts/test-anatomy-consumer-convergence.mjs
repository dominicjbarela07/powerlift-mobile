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

const directMuscleMapConsumers = productFiles.filter((relative) => {
  const contents = source(relative);
  return /(?:from ['"][^'"]*MuscleMap['"]|<MuscleMap\b)/.test(contents)
    && relative !== 'components/anatomy/MuscleMap.tsx';
});
assert.deepEqual(directMuscleMapConsumers.sort(), [
  'app/(tabs)/dev-mocks/anatomy-system.tsx',
  'components/anatomy/GovernedMuscleThumbnail.tsx',
  'components/anatomy/ProgrammingMuscleRegionArt.tsx',
  'components/ledger/AccessoriesExperience.tsx',
  'components/ledger/exploration-experiences.tsx',
].sort(), 'an aggregate anatomy consumer bypassed the governed renderer boundary or was not inventoried');

const masterAssetConsumers = productFiles.filter((relative) => /anatomy-v2\/masters/.test(source(relative)));
assert.deepEqual(masterAssetConsumers, ['components/anatomy/MuscleMap.tsx'], 'only MuscleMap may load registered full-figure masters');

const maskRegistryConsumers = productFiles.filter((relative) => /anatomy-mask-registry/.test(source(relative)));
assert.deepEqual(maskRegistryConsumers, ['components/anatomy/MuscleMap.tsx'], 'screen code may not import registered overlay geometry');

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
