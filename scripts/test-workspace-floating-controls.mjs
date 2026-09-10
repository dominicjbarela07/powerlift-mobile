import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatCalculatedWeightFromKg, kilogramsToDisplayValue, normalizeDisplayWeightUnit } from '../lib/display-units.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const directory = 'components/coach-mobile/athlete-workspace/';
const shell = read(`${directory}CoachAthleteWorkspaceShell.tsx`);
const performance = read(`${directory}CoachAthletePerformance.tsx`);
const provider = read(`${directory}CoachAthleteWorkspaceContext.tsx`);
const brief = read(`${directory}CoachAthleteBrief.tsx`);
const visuals = read(`${directory}PerformanceVisuals.tsx`);

// The workspace, not a Performance mount, owns the canonical display lens.
assert.match(provider, /useSurfaceWeightUnit\(user\?\.preferred_units\)/);
assert.match(provider, /ReturnType<typeof useSurfaceWeightUnit>/);
assert.match(performance, /const \{ unit, setUnit \} = workspace/);
assert.match(brief, /unit=\{workspace\.unit\}/);
assert.doesNotMatch(performance, /useSurfaceWeightUnit|useAuth|preferred_units|AsyncStorage|setUnit\]\s*=\s*useState/);
assert.doesNotMatch(provider, /preferred_units\s*:|AsyncStorage/, 'A display toggle must not rewrite saved account preferences.');

// Both controls share the dock material and slot geometry. No custom FAB style.
assert.match(shell, /<FloatingControlCoordinator context="tab-screen">/);
assert.match(shell, /<FloatingControlStack context="tab-screen" slot=\{0\}/);
assert.match(shell, /<FloatingUtilityButton\s+accessibilityLabel="Open athlete actions"\s+icon="add"\s+onPress=\{\(\) => setToolkitOpen\(true\)\}/);
assert.doesNotMatch(shell, /<Pressable\s+accessibilityLabel="Open athlete actions"/);
assert.doesNotMatch(shell, /floatingToolkit|toolkitFab|shadowColor: COACH_V2\.violet|backgroundColor: COACH_V2\.violet\b/);
assert.match(shell, /<SLFloatingNavigationDock\s+bottomInset=\{insets\.bottom\}/);
assert.match(performance, /<FloatingDisplayUnitRegistration unit=\{unit\} onChange=\{setUnit\} slot=\{1\}/);
assert.ok(performance.indexOf('<FloatingDisplayUnitRegistration') < performance.indexOf('<ScrollView'), 'Registration must be outside scrolling content.');
assert.match(performance, /floatingControlBottom\(\{ context: 'tab-screen', safeAreaBottom: insets\.bottom, slot: 1 \}\)\s*\+ SL_FLOATING_CONTROL\.size \+ SL_FLOATING_CONTROL\.gap/);
assert.match(performance, /paddingBottom: floatingClearance/);
assert.doesNotMatch(performance, /paddingBottom:\s*\d+|<FloatingControlStack|2\.2046|0\.45359/);

// Exercise the governed formatter in both directions without mutating evidence.
const canonicalKg = Object.freeze({ total: 591, squat: 217, heaviest: 185.9729, accessory: 49.89516, variant: 83.91459, bodyweight: 90 });
const expected = {
  total: ['1,303 lb', '591 kg', '1,303 lb'],
  squat: ['478.5 lb', '217 kg', '478.5 lb'],
  heaviest: ['410 lb', '186 kg', '410 lb'],
  accessory: ['110 lb', '49.9 kg', '110 lb'],
  variant: ['185 lb', '83.9 kg', '185 lb'],
  bodyweight: ['198.5 lb', '90 kg', '198.5 lb'],
};
for (const [kind, kg] of Object.entries(canonicalKg)) {
  assert.deepEqual(['lb', 'kg', 'lb'].map((unit) => formatCalculatedWeightFromKg(kg, unit)), expected[kind], kind);
}
assert.deepEqual(['lb', 'kg', 'lb'].map((unit) => Math.round(kilogramsToDisplayValue(10600, unit))), [23369, 10600, 23369]);
assert.equal(normalizeDisplayWeightUnit('lbs'), 'lb');
assert.equal(normalizeDisplayWeightUnit('kg'), 'kg');

// Every weight-bearing chapter consumes the same display lens and governed helpers.
for (const expression of [
  'loadLabel(lenses?.weight_on_bar.heaviest_kg, unit)',
  'loadLabel(careerEstimate.best_value, unit)',
  'kgToDisplay(context?.volume_kg || 0, unit)',
  'loadLabel(progress.prior.weight_kg, unit)',
  'loadLabel(progress.current.weight_kg, unit)',
  'loadLabel(movement.latest_progression.prior.weight_kg, unit)',
  'loadLabel(movement.latest_progression.current.weight_kg, unit)',
  'loadLabel(event.current_value, unit)',
  'loadLabel(latestWeight, unit)',
  'kgToDisplay(point.reported_bodyweight_kg, unit)',
]) assert.ok(performance.includes(expression), `Unit coverage missing: ${expression}`);
assert.match(performance, /<StrengthHero data=\{data\} unit=\{unit\}/);
assert.match(performance, /<WeeklyWork points=\{context\?\.weekly \|\| \[\]\} unit=\{unit\}/);
assert.match(visuals, /displayCalculatedWeight\(headline, unit\)/);
assert.match(visuals, /displayCalculatedWeight\(lift\.current_e1rm_kg, unit\)/);
assert.match(visuals, /kgToDisplay\(point\.value_kg!, unit\)/);

// Toolkit actions retain the workspace subject and existing destinations.
for (const label of ['New Session', 'Message Athlete', 'Add Coach Note', 'Adjust Program', 'Edit Next Session', 'Review Next Item']) {
  assert.ok(shell.includes(`label="${label}"`), `${label} must remain available under its existing conditions.`);
}
assert.match(shell, /athleteId: String\(athlete\.id\), athleteName: athlete\.name/);
assert.match(shell, /pathname: '\/\(tabs\)\/workout\/session-workspace\/\[workoutId\]'[\s\S]*athleteId: String\(athlete\.id\)/);
assert.match(shell, /navigate\('messages'\)/);
assert.match(shell, /navigate\('reviews'\)/);
assert.match(shell, /router\.push\(`\$\{basePath\}\/notes`/);
console.log('Workspace floating controls: shared ownership, material, slots, clearance, weight coverage and scoped toolkit PASS.');
