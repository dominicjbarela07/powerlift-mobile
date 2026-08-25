import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const coordinator = read('components/ui/floating-control-coordinator.tsx');

assert.match(coordinator, /position: 'absolute'/);
assert.match(coordinator, /right: SLSpacing\.md/);
assert.match(coordinator, /minHeight: 48/);
assert.match(coordinator, /minWidth: 48/);
assert.match(coordinator, /pointerEvents="box-none"/);
assert.match(coordinator, /context === 'sheet'[\s\S]*safeBottom \+ 18/);
assert.match(coordinator, /context === 'tab-screen'[\s\S]*safeBottom \+ 70/);
assert.match(coordinator, /slot \* 60/);
assert.doesNotMatch(coordinator, /AsyncStorage|fetchJson|preferred_units\s*:/);

for (const file of [
  'components/home/AthleteHomeV3.tsx',
  'components/training-hub/AthleteTrainingHubExperience.tsx',
  'components/coach-mobile/CompletedSessionRecap.tsx',
  'components/movement-history/CanonicalMovementHistoryScreen.tsx',
  'components/ledger/index-experience.tsx',
  'components/ledger/experiences.tsx',
  'components/ledger/exploration-experiences.tsx',
  'components/ledger/AchievementsExperience.tsx',
  'components/coach-mobile/CoachAthleteHubSheet.tsx',
  'app/(tabs)/workout/session-history.tsx',
  'app/(tabs)/workout/movement-history.tsx',
]) {
  const source = read(file);
  assert.match(source, /FloatingDisplayUnitRegistration/, `${file} must register the floating display-unit control`);
  assert.doesNotMatch(source, /DISPLAY (?:UNIT|WEIGHT)/, `${file} must not retain an inline display-unit row`);
}

for (const file of [
  'app/(tabs)/athlete-dashboard.tsx',
  'app/(tabs)/workout/index.tsx',
  'components/ledger/primitives.tsx',
  'components/coach-mobile/CompletedSessionRecap.tsx',
  'components/movement-history/CanonicalMovementHistoryScreen.tsx',
  'components/ledger/AchievementsExperience.tsx',
  'components/coach-mobile/CoachAthleteHubSheet.tsx',
]) {
  assert.match(read(file), /FloatingControlCoordinator/, `${file} must host fixed controls outside scrolling content`);
}

console.log('Floating display-unit control contracts passed.');
