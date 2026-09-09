import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [home, preview, shell, checkIns, surveys, calendar, attention, teamBrief] = await Promise.all([
  read('components/coach-mobile/CoachActivityHome.tsx'),
  read('components/coach-mobile/CoachAthleteHubSheet.tsx'),
  read('components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceShell.tsx'),
  read('components/coach-mobile/CoachCheckInsV2.tsx'),
  read('app/(tabs)/session-surveys.tsx'),
  read('app/(tabs)/coach-calendar.tsx'),
  read('components/coach-mobile/CoachAttentionDetailV2.tsx'),
  read('app/coach-athlete-analytics/[athleteId].tsx'),
]);

assert.match(
  home,
  /const openAthlete = useCallback[\s\S]*pathname: '\/\(tabs\)\/coach-athlete\/\[athleteId\]'[\s\S]*athleteId: String\(athleteId\)/,
  'Coach Home athlete identity must enter the canonical Athlete Workspace directly.',
);
assert.match(home, /CompactAthleteCard[\s\S]*onPress=\{\(\) => openAthlete\(athlete\.id\)\}/);
assert.match(home, /<RosterSheet[\s\S]*setTimeout\(\(\) => openAthlete\(athlete\.id\), 0\)/);
assert.match(home, /Open \$\{activity\.athlete\.name\} Athlete Workspace/);
assert.match(home, /Open \$\{athlete\.name\} Athlete Workspace/);
assert.doesNotMatch(
  home.match(/const openAthlete = useCallback[\s\S]*?\}, \[athleteById, router\]\);/)?.[0] || '',
  /setSelectedAthlete/,
  'the live athlete entry helper must not detour through the legacy preview sheet.',
);

assert.match(preview, /accessibilityLabel="Athlete Quick Preview"/);
assert.match(preview, /testID="coach-athlete-preview-open-workspace"/);
assert.match(preview, /Open Athlete Workspace/);
assert.match(preview, /pathname: '\/\(tabs\)\/coach-athlete\/\[athleteId\]'/);

assert.match(shell, /router\.navigate\('\/(?:\(tabs\)\/)?coach-dashboard'/);
assert.match(shell, /Back to previous Coach context/);
assert.match(shell, /<Text style=\{styles\.headerBackLabel\}>Coach<\/Text>/);

for (const [name, source] of [
  ['Check-Ins', checkIns],
  ['Session feedback', surveys],
  ['Calendar', calendar],
  ['Attention detail', attention],
  ['Team Brief', teamBrief],
]) {
  assert.match(source, /\/\(tabs\)\/coach-athlete\/\[athleteId\]/, `${name} must retain a natural direct Athlete Workspace path.`);
}
assert.match(checkIns, /Open Workspace/);
assert.match(surveys, /Open Athlete Workspace/);
assert.match(attention, /View Athlete Workspace/);

console.log('coach athlete workspace canonical entrypoint and return contract: PASS');
