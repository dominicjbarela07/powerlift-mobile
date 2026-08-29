import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  COACH_MORE_ACCOUNT_DESTINATIONS,
  COACH_MORE_DESTINATIONS,
  COACH_MORE_TOOL_DESTINATIONS,
  coachMoreDestinationTarget,
} from '../lib/coach-more-navigation.ts';
import { shippingTabRouteNames } from '../lib/shipping-navigation.ts';

const root = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');
const sheet = read('components/navigation/CoachMoreNavigationSheet.tsx');
const primitive = read('components/sheets/StrengthLedgerBottomSheet.tsx');
const tabs = read('app/(tabs)/_layout.tsx');
const compatibilityRoute = read('app/(tabs)/coach-more.tsx');
const athleteHub = read('components/coach-mobile/CoachAthleteHubV2.tsx');
const athleteHubSheet = read('components/coach-mobile/CoachAthleteHubSheet.tsx');

assert.deepEqual(COACH_MORE_TOOL_DESTINATIONS.map((item) => item.label), [
  'Programming',
  'Review Hub',
  'Coach Calendar',
  'Check-Ins',
]);
assert.deepEqual(COACH_MORE_ACCOUNT_DESTINATIONS.map((item) => item.label), ['Team Brief', 'Settings']);
assert.equal(COACH_MORE_DESTINATIONS.length, 6);
assert.equal(new Set(COACH_MORE_DESTINATIONS.map((item) => item.key)).size, 6);

const expectedRoutes = {
  programming: '/(tabs)/workout',
  'review-hub': '/(tabs)/coach-videos',
  'coach-calendar': '/(tabs)/coach-calendar',
  'check-ins': '/(tabs)/check-ins',
  'team-brief': '/coach-team-brief',
  settings: '/(tabs)/settings',
};
for (const destination of COACH_MORE_DESTINATIONS) {
  assert.equal(coachMoreDestinationTarget(destination).pathname, expectedRoutes[destination.key]);
}
assert.deepEqual(
  coachMoreDestinationTarget(COACH_MORE_TOOL_DESTINATIONS[0], { athleteId: '42', athleteName: 'Coach Athlete' }).params,
  { athleteId: '42', athleteName: 'Coach Athlete' },
  'athlete context must reach the canonical Programming destination',
);
assert.equal(
  coachMoreDestinationTarget(COACH_MORE_ACCOUNT_DESTINATIONS[0], { athleteId: '42' }).params,
  undefined,
  'account destinations must not receive unrelated athlete context',
);

assert.match(sheet, /<StrengthLedgerBottomSheet/);
assert.match(sheet, /heightFraction=\{0\.62\}/, 'More must remain a compact sheet rather than a near-full-screen route');
assert.match(sheet, /COACH_MORE_TOOL_DESTINATIONS[\s\S]*COACH_MORE_ACCOUNT_DESTINATIONS/);
assert.match(sheet, /flexDirection: 'row', flexWrap: 'wrap'/, 'destinations must render as a compact two-column grid');
assert.match(sheet, /SLMotionPressable/);
assert.match(sheet, /Haptics\.selectionAsync/);
assert.match(sheet, /pendingDestinationRef[\s\S]*sheetRef\.current\?\.dismiss\(\)/, 'selection must dismiss before navigating');
assert.match(sheet, /setIsOpen\(false\)[\s\S]*router\.(?:navigate|push)/, 'navigation must occur only after sheet dismissal');

assert.match(primitive, /PanResponder\.create/);
assert.match(primitive, /onStartShouldSetPanResponder: \(\) => true/, 'the sheet drag zone must own its gesture from finger-down');
assert.match(primitive, /style=\{styles\.dragZone\}[\s\S]*\.\.\.dragResponder\.panHandlers/, 'the sheet must isolate drag handling to a dedicated drag zone');
assert.match(primitive, /gesture\.dy >= DISMISS_DISTANCE \|\| gesture\.vy >= DISMISS_VELOCITY/);
assert.match(primitive, /Pressable accessibilityLabel=\{`Dismiss \$\{accessibilityLabel\}`\}/, 'backdrop must dismiss');
assert.match(primitive, /Pressable accessibilityLabel=\{`Close \$\{accessibilityLabel\}`\}/, 'X must dismiss');

assert.match(tabs, /CoachMoreNavigationProvider enabled=\{isCoach && !isIndividual && viewMode === 'coach'\}/);
assert.match(tabs, /const isMoreRoute = route\.name === 'coach-more'/);
assert.match(tabs, /if \(isMoreRoute\) \{[\s\S]*?openMore\(\);[\s\S]*?return;/, 'More must open the overlay without emitting route navigation');
assert.match(tabs, /name="coach-more"[\s\S]*?href: null/, 'the compatibility route must not be a normal tab destination');
assert.match(tabs, /isMoreRoute \? isMoreOpen/, 'the launcher must retain selected treatment while open');

assert.match(compatibilityRoute, /useCoachMoreNavigation/);
assert.match(compatibilityRoute, /open\(\{/);
assert.match(compatibilityRoute, /router\.canGoBack\(\)[\s\S]*router\.back\(\)[\s\S]*router\.replace\('\/\(tabs\)\/coach-dashboard'/);
assert.doesNotMatch(compatibilityRoute, /SLScreen|ScrollView|CoachSectionHeading/, 'the legacy route must not retain a competing full-page More UI');
assert.match(athleteHub, /openMoreNavigation\(\{ athleteId:/);
assert.doesNotMatch(athleteHub, /router\.push\(\{ pathname: '\/\(tabs\)\/coach-more'/);
assert.match(athleteHubSheet, /onClose\(\);[\s\S]*openMoreNavigation\(\{ athleteId:/);
assert.doesNotMatch(athleteHubSheet, /navigate\(\{ pathname: '\/\(tabs\)\/coach-more'/);

assert.ok(
  shippingTabRouteNames({ isCoach: true, isIndividual: false, isUnlinkedAthlete: false, viewMode: 'coach', hasMeetPlan: false }).includes('coach-more'),
  'Coach mode keeps More as the rightmost launcher control',
);
assert.ok(
  !shippingTabRouteNames({ isCoach: false, isIndividual: false, isUnlinkedAthlete: false, viewMode: 'athlete', hasMeetPlan: false }).includes('coach-more'),
  'Athlete mode must never expose the Coach launcher',
);

console.log('Coach More compact overlay, destinations, dismissal, compatibility, and role contracts passed.');
