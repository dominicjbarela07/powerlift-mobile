import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [route, home, contract, hubSheet, shell] = await Promise.all([
  read('app/(tabs)/coach-dashboard.tsx'),
  read('components/coach-mobile/CoachActivityHome.tsx'),
  read('lib/coach-mobile.ts'),
  read('components/coach-mobile/CoachAthleteHubSheet.tsx'),
  read('app/(tabs)/_layout.tsx'),
]);

assert.match(route, /<CoachActivityHome\s*\/>/);
assert.doesNotMatch(route, /CoachHomeV2|@\/dev-mocks\//);

assert.match(home, /fetchJson<CoachHomeResponse>\('\/coach\/mobile\/home'/);
assert.match(home, /fetchJson<CoachRosterResponse>\('\/coach\/mobile\/roster'/);
assert.match(home, /The live coaching queue is not available on this release yet/);
assert.doesNotMatch(home, /deriveCoachHomeFromRoster|CoachMetricTile|<CoachKpiSheet/);

for (const section of ['Coaching Queue', 'Coming Up', 'Your Athletes']) {
  assert.match(home, new RegExp(section));
}
assert.ok(home.indexOf('Coaching Queue') < home.indexOf('Coming Up'));
assert.ok(home.indexOf('Coming Up') < home.indexOf('Your Athletes'));

for (const visual of [
  'performed_anatomy',
  'video_thumbnail',
  'pr_medallion',
  'readiness_chart',
  "kind === 'programming'",
  'messageArtwork',
]) {
  assert.match(home, new RegExp(visual));
}
assert.match(home, /<MuscleMap/);
assert.match(home, /thumbnail_url/);
assert.match(home, /function ActivityVideoArtwork/);
assert.match(home, /source=\{\{ uri: thumbnailUrl! \}\}/);
assert.match(home, /resizeMode="cover"/);
assert.match(home, /style=\{styles\.videoThumbnail\}/);
assert.match(home, /onError=\{\(\) => setThumbnailFailed\(true\)\}/);
assert.match(home, /showThumbnail \? <View pointerEvents="none" style=\{styles\.videoScrim\}/);
assert.match(home, /videoThumbnail: \{ \.\.\.StyleSheet\.absoluteFillObject, width: '100%', height: '100%' \}/);
assert.match(home, /videoFallback: \{ \.\.\.StyleSheet\.absoluteFillObject/);
assert.doesNotMatch(home, /VIDEO_FALLBACK/);
assert.doesNotMatch(home, /<VideoView|useVideoPlayer/);
assert.match(home, /PR_MEDALLION/);
assert.match(home, /<ReadinessRing/);
assert.match(home, /PROGRAM_ART/);
assert.match(home, /<SLAthleteAvatar/);
assert.match(home, /formatCoachWeight/);
assert.match(home, /formatCoachVolume/);

assert.match(home, /<SwipeActionRow/);
assert.doesNotMatch(home, /PanResponder\.create/);
assert.match(home, /Swipe left to dismiss/);
assert.match(home, /\/coach\/mobile\/home\/activity\/dismiss/);
assert.match(home, /cleared_activity/);
assert.match(home, /View cleared activity/);
assert.match(home, /state: 'dismissed'/);
assert.match(home, /activeRequestRef\.current\?\.controller\.abort\(\)/);
assert.match(home, /signal: controller\.signal/);
assert.match(home, /loadError\?\.name === 'AbortError'/);
assert.match(home, /state === 'active' && previous !== 'active'/);
assert.match(home, /useFocusEffect/);
assert.match(home, /contextKeyRef\.current === requestContext/);

assert.match(home, /destination\.route === 'athlete_hub'/);
assert.match(home, /<CoachAthleteHubSheet[\s\S]*athlete=\{selectedAthlete\}/);
assert.match(hubSheet, /presentationStyle="overFullScreen"/);
assert.match(home, /Find an Athlete/);
assert.doesNotMatch(home, /router\.(?:push|replace)\('\/\(tabs\)\/coach-roster'/);

for (const type of [
  'completed_session',
  'video_submitted',
  'pr_achieved',
  'readiness_check_in',
  'programming_alert',
  'message_feedback',
]) {
  assert.match(contract, new RegExp(`'${type}'`));
}
assert.match(contract, /state: 'active' \| 'dismissed' \| 'handled' \| 'auto_resolved'/);
assert.match(contract, /destination: CoachDestination/);

assert.match(shell, /<StrengthLedgerAppHeader/);
const coachDashboardOptions = shell.match(/name="coach-dashboard"[\s\S]*?<Tabs\.Screen/)?.[0] || '';
assert.doesNotMatch(coachDashboardOptions, /headerShown:\s*false/);

console.log('Coach Home activity-first contract: PASS');
