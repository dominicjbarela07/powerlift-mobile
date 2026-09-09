import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [route, home, hubSheet, workspaceLayout, workspaceShell, trainingRoute, tabs] = await Promise.all([
  read('app/(tabs)/coach-dashboard.tsx'),
  read('components/coach-mobile/CoachActivityHome.tsx'),
  read('components/coach-mobile/CoachAthleteHubSheet.tsx'),
  read('app/(tabs)/coach-athlete/[athleteId]/_layout.tsx'),
  read('components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceShell.tsx'),
  read('app/(tabs)/coach-athlete/[athleteId]/training/index.tsx'),
  read('app/(tabs)/_layout.tsx'),
]);

assert.match(route, /<CoachActivityHome\s*\/>/);
assert.doesNotMatch(route, /CoachHomeV2|@\/dev-mocks\//);
assert.match(home, /fetchJson<CoachHomeResponse>\('\/coach\/mobile\/home'/);
assert.match(home, /fetchJson<CoachRosterResponse>\('\/coach\/mobile\/roster'/);
assert.match(home, /<CoachAthleteHubSheet[\s\S]*athlete=\{selectedAthlete\}/);
assert.match(home, /contextKeyRef\.current === requestContext/);
assert.match(home, /activeRequestRef/);
assert.match(home, /signal: controller\.signal/);
for (const section of ['Coaching Queue', 'Coming Up', 'Your Athletes']) {
  assert.match(home, new RegExp(section));
}
assert.ok(home.indexOf('Coaching Queue') < home.indexOf('Coming Up'));
assert.ok(home.indexOf('Coming Up') < home.indexOf('Your Athletes'));

assert.match(hubSheet, /presentationStyle="overFullScreen"/);
assert.match(hubSheet, /coach-athlete\/\[athleteId\]/);
assert.match(workspaceLayout, /<CoachAthleteWorkspaceProvider>/);
assert.match(workspaceLayout, /<CoachAthleteWorkspaceShell>/);
for (const tab of ["key: 'brief'", "key: 'training'", "key: 'reviews'", "key: 'messages'"]) {
  assert.match(workspaceShell, new RegExp(tab));
}
assert.match(workspaceShell, /Back to previous Coach context/);
assert.match(workspaceShell, /router\.navigate\('\/(?:\(tabs\)\/)?coach-dashboard'/);
assert.match(workspaceShell, /workspace\.subjectKey/);
assert.match(workspaceShell, /<SLFloatingNavigationDock/);
assert.match(tabs, /<SLFloatingNavigationDock/);
assert.doesNotMatch(workspaceShell, /workspaceDock|navItemActive|activeIndicator|navIcon|navLabel/);
assert.match(trainingRoute, /import TrainingIndexScreen from '@\/app\/\(tabs\)\/workout'/);
assert.match(trainingRoute, /return <TrainingIndexScreen \/>/);
assert.doesNotMatch(trainingRoute, /athlete-workspace\/CoachAthleteTraining/);
assert.match(tabs, /normalizedPathname\.startsWith\('\/coach-athlete\/'\)[\s\S]*return null/);

console.log('coach mobile live routes and athlete workspace contract: PASS');
