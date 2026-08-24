import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  SHIPPING_ATHLETE_TAB_ROUTES,
  SHIPPING_COACH_TAB_ROUTES,
  SHIPPING_TAB_PRESENTATION,
  SHIPPING_UNLINKED_ATHLETE_TAB_ROUTES,
  shippingTabRouteNames,
} from '../lib/shipping-navigation.ts';

const root = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

assert.deepEqual(
  SHIPPING_ATHLETE_TAB_ROUTES,
  ['athlete-dashboard', 'workout/index', 'athlete-calendar', 'ledger'],
  'the shipping athlete tab tree must end in the canonical Ledger',
);
assert.deepEqual(
  SHIPPING_COACH_TAB_ROUTES,
  ['coach-dashboard', 'coach-calendar', 'messages/index', 'coach-more'],
  'the shipping coach tab tree must expose Home, the canonical Coach Calendar, Messages, and More',
);
assert.ok(!SHIPPING_COACH_TAB_ROUTES.includes('coach-roster'), 'the deprecated All Athletes route must never become a primary tab');
assert.deepEqual(
  SHIPPING_UNLINKED_ATHLETE_TAB_ROUTES,
  ['link-coach', 'settings'],
  'unlinked athletes must remain in the invite/settings state machine',
);
assert.deepEqual(
  shippingTabRouteNames({
    isCoach: false,
    isIndividual: false,
    isUnlinkedAthlete: false,
    viewMode: 'athlete',
    hasMeetPlan: true,
  }),
  ['athlete-dashboard', 'workout/index', 'athlete-calendar', 'athlete-meet-plan', 'ledger'],
  'the optional Meet tab must not replace or hide the Ledger',
);
assert.deepEqual(
  shippingTabRouteNames({
    isCoach: true,
    isIndividual: false,
    isUnlinkedAthlete: false,
    viewMode: 'coach',
    hasMeetPlan: false,
  }),
  [...SHIPPING_COACH_TAB_ROUTES],
);

assert.equal(SHIPPING_TAB_PRESENTATION['athlete-dashboard'].label, 'Today');
assert.equal(SHIPPING_TAB_PRESENTATION.ledger.label, 'Ledger');
assert.equal(SHIPPING_TAB_PRESENTATION.ledger.icon, 'book-outline');
assert.equal(SHIPPING_TAB_PRESENTATION['coach-calendar'].label, 'Calendar');
assert.equal(SHIPPING_TAB_PRESENTATION['coach-calendar'].icon, 'calendar-outline');

for (const routeFile of [
  'app/(tabs)/ledger/_layout.tsx',
  'app/(tabs)/ledger/index.tsx',
  'app/(tabs)/ledger/home.tsx',
  'app/(tabs)/ledger/journey.tsx',
  'app/(tabs)/ledger/strength.tsx',
  'app/(tabs)/ledger/achievements.tsx',
  'app/(tabs)/ledger/archive.tsx',
  'app/(tabs)/ledger/archive/[itemType]/[sourceId].tsx',
]) {
  assert.ok(existsSync(resolve(root, routeFile)), `missing shipping Ledger route ${routeFile}`);
}

const tabs = read('app/(tabs)/_layout.tsx');
const appLayout = read('app/_layout.tsx');
const dashboard = read('app/(tabs)/athlete-dashboard.tsx');
const progression = read('app/(tabs)/athlete-progression.tsx');
const rosterCompatibility = read('app/(tabs)/coach-roster.tsx');
const archive = read('lib/ledger-archive.ts');
const canonicalSources = [
  'components/ledger/route-screen.tsx',
  'components/ledger/routing.ts',
  'components/ledger/experiences.tsx',
  'components/ledger/AchievementsExperience.tsx',
].map(read).join('\n');

assert.match(tabs, /shippingTabRouteNames\(/, 'tab rendering must consume one shipping route policy');
assert.match(tabs, /name="coach-roster"[\s\S]*?href: null/, 'the compatibility route must remain hidden from coach tabs');
assert.doesNotMatch(tabs, /title: 'All Athletes'/, 'the deprecated product title must not survive in the tab shell');
assert.match(rosterCompatibility, /<Redirect[\s\S]*?coach-dashboard/, 'stale roster links must redirect into canonical Coach Home');
assert.doesNotMatch(rosterCompatibility, /CoachRosterV2|All Athletes/, 'the deprecated roster renderer must not remain active');
assert.match(tabs, /name="coach-calendar"[\s\S]*?href: isCoach && !isIndividual && viewMode === 'coach' \? '\/\(tabs\)\/coach-calendar'/, 'the coach Calendar tab must open the canonical Coach Calendar');
assert.match(tabs, /usesCoachHomeSelection[\s\S]*?route\.name === 'coach-dashboard'/, 'secondary athlete-management routes must retain Coach Home tab context');
assert.match(tabs, /name="ledger"/, 'the shipping Ledger route must be registered');
assert.match(tabs, /router\.navigate\('\/\(tabs\)\/ledger\/home'/, 'Ledger tab presses must open the canonical home');
assert.match(tabs, /name="athlete-progression"[\s\S]*?href: null/, 'legacy Progression must not appear as a shipping tab');
assert.match(tabs, /name="reflection"[\s\S]*?href: null/, 'legacy Reflection must not appear as a shipping tab');
assert.match(dashboard, /router\.push\('\/\(tabs\)\/ledger\/home'/, 'dashboard Ledger entry must open the canonical Ledger');
assert.match(progression, /Redirect href="\/\(tabs\)\/ledger\/strength"/, 'legacy progression deep links must forward to the canonical Strength room');
assert.match(appLayout, /router\.push\('\/\(tabs\)\/ledger\/archive'/, 'archive notifications must open the canonical Ledger archive');
assert.match(archive, /`\/\(tabs\)\/ledger\/archive\//, 'archive detail links must remain within the canonical Ledger route tree');
assert.doesNotMatch(canonicalSources, /@\/dev-mocks\//, 'shipping Ledger components must not import DEV-only modules');
assert.doesNotMatch(canonicalSources, /if \(!__DEV__\) return null/, 'shipping Ledger screens must not disappear in release builds');
assert.doesNotMatch(canonicalSources, /LoadedSleeve3D|expo-three|expo-gl/, 'shipping Ledger must not require a new native 3D dependency');

console.log('[shipping-navigation-parity] athlete, coach, unlinked, Meet, and canonical Ledger route guards passed');
