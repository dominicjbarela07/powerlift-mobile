import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const redirect = read('app/dev-strength-tier-certification.tsx');
const achievementsRoute = read('app/(tabs)/ledger/achievements.tsx');
const routeScreen = read('components/ledger/route-screen.tsx');
const tabsLayout = read('app/(tabs)/_layout.tsx');
const rootLayout = read('app/_layout.tsx');

assert.match(redirect, /<Redirect[\s\S]*pathname: '\/\(tabs\)\/ledger\/achievements'/, 'the legacy certification URL must enter the real tabbed Ledger route');
assert.match(redirect, /devStrengthTierCertification: '1'/, 'the redirect must preserve an explicit DEV-only fixture marker');
assert.doesNotMatch(redirect, /<AchievementsExperience/, 'the root certification URL must not render a bare Ledger experience outside the app shell');

assert.match(achievementsRoute, /if \(!__DEV__ \|\| devStrengthTierCertification !== '1'\) return undefined/, 'fixture injection must fail closed outside DEV');
assert.match(achievementsRoute, /strengthTierCertificationFixture\(sex === 'F' \? 'F' : 'M', resolvedScenario\)/, 'the real Ledger route must retain deterministic sex/scenario evidence');
assert.match(achievementsRoute, /<LedgerRouteScreen achievementsDevFixture=\{devFixture\} screen="achievements" \/>/, 'the fixture must flow through the shipping Ledger route boundary');
assert.match(routeScreen, /<AchievementsExperience devFixture=\{__DEV__ \? devFixture : undefined\}/, 'the shipping Achievements room must receive the DEV-only fixture');
assert.match(routeScreen, /onBack=\{\(\) => router\.replace\(ledgerHrefFor\('home'\)/, 'the visible back control must return to the real Ledger home');

assert.match(tabsLayout, /<StrengthLedgerAppHeader/, 'the tab shell must retain the canonical app header');
assert.match(tabsLayout, /tabBar=\{\(props\) => \([\s\S]*<FilteredTabBar/, 'the tab shell must retain the canonical floating tab row');
assert.doesNotMatch(rootLayout, /pathname === '\/dev-session-recap-certification' \|\| pathname === '\/dev-strength-tier-certification'/, 'the redirected strength fixture must not bypass normal app-shell authentication readiness');

console.log('[strength-tier certification app shell] canonical header, tab row, DEV fixture, and reachable back action passed');
